import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: cors });
const periodMs: Record<string, number> = { daily: 86_400_000, weekly: 7 * 86_400_000, monthly: 30 * 86_400_000, days90: 90 * 86_400_000 };
const allowedEvents = new Set(["ASSIGNED", "OPENED", "PENDING", "COMPLETED", "FAILED"]);
const asDate = (value: number) => new Date(value).toISOString();

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const anon = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
    const secret = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !anon || !secret) return json({ error: "Supabase function environment is incomplete" }, 500);
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token || token === authHeader) return json({ error: "Authentication required" }, 401);
    const authClient = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false } });
    const { data: authData, error: authError } = await authClient.auth.getUser(token);
    if (authError || !authData.user) return json({ error: "Invalid or expired session" }, 401);
    const user = authData.user;
    const db = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: profile, error: profileError } = await db.from("mfp_user_profiles").select("user_id,email,role,account_status,team_key,team_confirmed,display_name").eq("user_id", user.id).maybeSingle();
    if (profileError) throw profileError;
    const admin = profile?.role === "ADMIN" && profile?.account_status === "ACTIVE";
    const authorized = !!profile && profile.account_status === "ACTIVE" && (admin || (profile.team_key === "evidence" && profile.team_confirmed === true));
    const body = await req.json().catch(() => ({}));
    const action = String(body.action ?? "");
    const period = String(body.period ?? "monthly");
    const rangeMs = periodMs[period] ?? periodMs.monthly;

    const activeRegistration = async (uid: string) => {
      const { data, error } = await db.from("mfp_evidence_app_registrations").select("id,status,activation_status,team_authorized,last_seen_at").eq("user_id", uid).eq("application_id", "MF_EVIDENCE").order("linked_at", { ascending: false }).limit(1).maybeSingle();
      if (error) throw error;
      return data;
    };
    const getSummary = async (uid: string, selectedPeriod: string) => {
      const range = periodMs[selectedPeriod] ?? periodMs.monthly;
      const since = asDate(Date.now() - range);
      const rows: any[] = [];
      for (let offset = 0; ; offset += 1000) {
        const { data: page, error: eventsError } = await db.from("mfp_evidence_activity_events").select("id,link_id,event_type,platform,created_at").eq("user_id", uid).gte("created_at", since).order("created_at", { ascending: true }).order("id", { ascending: true }).range(offset, offset + 999);
        if (eventsError) throw eventsError;
        rows.push(...(page ?? []));
        if ((page?.length ?? 0) < 1000) break;
      }
      const uniqueCount = (type: string) => new Set(rows.filter((e: any) => e.event_type === type && e.link_id).map((e: any) => e.link_id)).size;
      const assigned = uniqueCount("ASSIGNED");
      const latestOutcome = new Map<string, string>();
      for (const event of rows as any[]) if (event.link_id && (event.event_type === "COMPLETED" || event.event_type === "FAILED")) latestOutcome.set(event.link_id, event.event_type);
      const completed = [...latestOutcome.values()].filter((x) => x === "COMPLETED").length;
      const failed = [...latestOutcome.values()].filter((x) => x === "FAILED").length;
      const processed = completed + failed;
      const score = processed ? Math.round((completed / processed) * 10000) / 100 : null;
      const related: any[] = [];
      for (let offset = 0; ; offset += 1000) {
        const { data: page, error: itemsError } = await db.from("mfp_evidence_work_items").select("link_id,platform,status,assigned_at,completed_at,last_activity_at,last_assigned_to,updated_at").or(`assigned_to.eq.${uid},last_assigned_to.eq.${uid}`).order("updated_at", { ascending: false }).order("link_id", { ascending: true }).range(offset, offset + 999);
        if (itemsError) throw itemsError;
        related.push(...(page ?? []));
        if ((page?.length ?? 0) < 1000) break;
      }
      const pending = related.filter((i: any) => i.status === "ASSIGNED" || i.status === "PENDING").length;
      const activeAssigned = related.filter((i: any) => i.status === "ASSIGNED" || i.status === "PENDING" || i.status === "COMPLETED").length;
      const platformCounts: Record<string, { assigned: number; completed: number; pending: number; returned: number }> = {};
      for (const item of related as any[]) {
        const platform = String(item.platform || "Other");
        platformCounts[platform] ??= { assigned: 0, completed: 0, pending: 0, returned: 0 };
        if (item.status !== "AVAILABLE") platformCounts[platform].assigned++;
        if (item.status === "COMPLETED") platformCounts[platform].completed++;
        if (item.status === "ASSIGNED" || item.status === "PENDING") platformCounts[platform].pending++;
        if (item.status === "AVAILABLE" && item.last_assigned_to === uid) platformCounts[platform].returned++;
      }
      const days = selectedPeriod === "daily" ? 24 : selectedPeriod === "weekly" ? 7 : selectedPeriod === "days90" ? 90 : 30;
      const seriesMap = new Map<string, { date: string; assigned: number; completed: number; failed: number }>();
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date(Date.now() - i * 86_400_000);
        const key = selectedPeriod === "daily" ? `${String(d.getHours()).padStart(2, "0")}:00` : d.toISOString().slice(0, 10);
        seriesMap.set(key, { date: key, assigned: 0, completed: 0, failed: 0 });
      }
      for (const e of rows as any[]) {
        const d = new Date(e.created_at);
        const key = selectedPeriod === "daily" ? `${String(d.getHours()).padStart(2, "0")}:00` : d.toISOString().slice(0, 10);
        const point = seriesMap.get(key);
        if (point && e.event_type === "ASSIGNED") point.assigned++;
        if (point && e.event_type === "COMPLETED") point.completed++;
        if (point && e.event_type === "FAILED") point.failed++;
      }
      const registration = await activeRegistration(uid);
      return {
        userId: uid,
        email: uid === user.id ? (profile?.email ?? user.email ?? "") : undefined,
        displayName: uid === user.id ? (profile?.display_name ?? "") : undefined,
        period: selectedPeriod,
        rangeStart: since,
        assigned,
        completed,
        failed,
        pending,
        activeAssigned,
        score,
        scoreStatus: score === null ? "NO_OUTCOMES" : score < 25 ? "BELOW_THRESHOLD" : score < 60 ? "NEEDS_IMPROVEMENT" : "ON_TRACK",
        platformCounts,
        series: [...seriesMap.values()],
        registrationStatus: registration?.status ?? "NOT_LINKED",
        activationStatus: registration?.activation_status ?? "INACTIVE",
        lastSeenAt: registration?.last_seen_at ?? null,
      };
    };

    if (action === "getPerformance") {
      if (!authorized) return json({ error: "Active Evidence team authorization is required." }, 403);
      const target = String(body.userId ?? user.id);
      if (target !== user.id && !admin) return json({ error: "Administrator access is required." }, 403);
      return json(await getSummary(target, period));
    }

    if (action === "getAdminPerformance") {
      if (!admin) return json({ error: "Administrator access is required." }, 403);
      const { data: users, error } = await db.from("mfp_user_profiles").select("user_id,email,display_name,role,account_status,team_key").eq("team_key", "evidence").order("email").limit(1000);
      if (error) throw error;
      const results = [];
      for (const item of users ?? []) {
        const stats = await getSummary(item.user_id, period);
        results.push({ ...stats, email: item.email, displayName: item.display_name, accountStatus: item.account_status, team: item.team_key });
      }
      return json({ period, users: results, totals: { users: results.length, assigned: results.reduce((n, x) => n + x.assigned, 0), completed: results.reduce((n, x) => n + x.completed, 0), pending: results.reduce((n, x) => n + x.pending, 0) } });
    }

    if (action === "syncWorkActivity") {
      if (!authorized) return json({ error: "Active Evidence team authorization is required." }, 403);
      const registration = await activeRegistration(user.id);
      if (!registration || registration.status !== "ACTIVE" || registration.activation_status !== "ACTIVE" || registration.team_authorized !== true) return json({ error: "Link and activate MF Evidence before syncing work." }, 403);
      const input = Array.isArray(body.events) ? body.events.slice(0, 500) : [];
      if (!input.length) return json({ error: "Provide at least one work activity event." }, 400);
      let saved = 0;
      for (const raw of input) {
        const type = String(raw?.eventType ?? "").toUpperCase();
        const linkId = String(raw?.linkId ?? "").trim().slice(0, 240);
        if (!allowedEvents.has(type) || !linkId) continue;
        const platform = String(raw?.platform ?? "Other").slice(0, 80);
        const urlValue = String(raw?.url ?? "").trim().slice(0, 2048);
        const profileId = String(raw?.profileId ?? linkId).slice(0, 240);
        const batchId = String(raw?.batchId ?? "").slice(0, 160) || null;
        const now = new Date().toISOString();
        if (type === "ASSIGNED") {
          if (!urlValue) continue;
          const { data: existing, error: lookupError } = await db.from("mfp_evidence_work_items").select("assigned_to,status").eq("link_id", linkId).maybeSingle();
          if (lookupError) throw lookupError;
          if (existing?.assigned_to && existing.assigned_to !== user.id && existing.status !== "AVAILABLE") continue;
          const { error } = await db.from("mfp_evidence_work_items").upsert({ link_id: linkId, profile_id: profileId, url: urlValue, platform, batch_id: batchId, assigned_to: user.id, last_assigned_to: user.id, status: "ASSIGNED", assigned_at: now, last_activity_at: now, returned_at: null, metadata: raw?.metadata && typeof raw.metadata === "object" ? raw.metadata : {}, updated_at: now }, { onConflict: "link_id" });
          if (error) throw error;
        } else {
          const { data: ownedItem, error: ownershipError } = await db.from("mfp_evidence_work_items").select("link_id,status").eq("link_id", linkId).eq("assigned_to", user.id).maybeSingle();
          if (ownershipError) throw ownershipError;
          if (!ownedItem) continue;
          const status = type === "COMPLETED" ? "COMPLETED" : type === "PENDING" ? "PENDING" : undefined;
          if (status) {
            const update: Record<string, unknown> = { status, last_activity_at: now, updated_at: now };
            if (status === "COMPLETED") update.completed_at = now;
            const { error } = await db.from("mfp_evidence_work_items").update(update).eq("link_id", linkId).eq("assigned_to", user.id);
            if (error) throw error;
          }
        }
        const { error: eventError } = await db.from("mfp_evidence_activity_events").insert({ user_id: user.id, link_id: linkId, event_type: type, platform, metadata: { batchId, profileId, ...(raw?.metadata && typeof raw.metadata === "object" ? raw.metadata : {}) }, created_at: now });
        if (eventError) throw eventError;
        saved++;
      }
      await db.from("mfp_evidence_app_registrations").update({ last_seen_at: new Date().toISOString() }).eq("id", registration.id);
      const stats = await getSummary(user.id, "monthly");
      let autoRevoked = false;
      await db.from("mfp_evidence_score_snapshots").insert({ user_id: user.id, period_key: "30d", score: stats.score, assigned_count: stats.assigned, completed_count: stats.completed, failed_count: stats.failed, pending_count: stats.pending, auto_action: null });
      // Score completed vs explicitly failed outcomes; untouched pending links do not lower the score.
      // Enforce the configured threshold as soon as at least one outcome produces a score.
      if (stats.score !== null && stats.score < 25 && profile?.role !== "ADMIN") {
        const now = new Date().toISOString();
        const { data: items, error: itemsError } = await db.from("mfp_evidence_work_items").select("link_id,platform,status").eq("assigned_to", user.id).in("status", ["ASSIGNED", "PENDING", "COMPLETED"]);
        if (itemsError) throw itemsError;
        for (const item of items ?? []) {
          await db.from("mfp_evidence_activity_events").insert({ user_id: user.id, link_id: item.link_id, event_type: "AUTO_RETURNED_LOW_SCORE", platform: item.platform, metadata: { reason: "score_below_25", score: stats.score, priorStatus: item.status }, created_at: now });
        }
        if ((items ?? []).length) {
          const { error } = await db.from("mfp_evidence_work_items").update({ status: "AVAILABLE", assigned_to: null, last_assigned_to: user.id, returned_at: now, last_activity_at: now, updated_at: now }).eq("assigned_to", user.id).in("status", ["ASSIGNED", "PENDING", "COMPLETED"]);
          if (error) throw error;
        }
        const { error: regError } = await db.from("mfp_evidence_app_registrations").update({ status: "REVOKED", activation_status: "INACTIVE", team_authorized: false, revoked_at: now }).eq("user_id", user.id).eq("application_id", "MF_EVIDENCE");
        if (regError) throw regError;
        await db.from("mfp_evidence_pairing_requests").update({ status: "CANCELLED" }).eq("user_id", user.id).eq("status", "PENDING");
        await db.from("mfp_evidence_activity_events").insert({ user_id: user.id, event_type: "ACCESS_REVOKED", metadata: { reason: "score_below_25", score: stats.score, returnedLinks: (items ?? []).length }, created_at: now });
        await db.from("mfp_evidence_score_snapshots").insert({ user_id: user.id, period_key: "30d", score: stats.score, assigned_count: stats.assigned, completed_count: stats.completed, failed_count: stats.failed, pending_count: stats.pending, auto_action: "RETURN_LINKS_AND_REVOKE_ACCESS" });
        try { await db.auth.admin.signOut(token, "global"); } catch (e) { console.warn("Global sign-out best-effort failed", e); }
        autoRevoked = true;
      }
      return json({ success: true, saved, autoRevoked, message: autoRevoked ? "Score fell below 25. Links were returned, the app was revoked, and account sessions were invalidated." : "Work activity synced.", performance: stats });
    }

    return json({ error: "Unsupported action" }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected backend error";
    const traceId = crypto.randomUUID();
    console.error("mfp-evidence-performance", { traceId, message });
    return json({ error: message, traceId }, 500);
  }
});
