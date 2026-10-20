import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS", "Content-Type": "application/json" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: cors });
const sha256 = async (value: string) => { const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)); return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join(""); };
const millis = (value?: string | null) => value ? new Date(value).getTime() : null;
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
    const publishableKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
    const legacyAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !anonKey || !serviceKey) return json({ error: "Supabase function environment is incomplete" }, 500);
    const body = await req.json().catch(() => ({}));
    const incomingAction = String(body.action ?? "");
    const aliases: Record<string, string> = { redeemEvidencePairing: "redeemPairing", createEvidencePairing: "createPairing", cancelEvidencePairing: "cancelPairing", disconnectEvidenceApp: "disconnect", getEvidenceDashboardSummary: "getSummary", getEvidenceLinksPage: "getLinksPage", recordEvidenceLinksDownload: "recordDownload", listEvidenceConnectionsForAdmin: "listAdmin" };
    const action = aliases[incomingAction] ?? incomingAction;
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    // Supabase SDKs may send either the legacy anon JWT or the newer sb_publishable key as Bearer.
    // Compare against both configured public keys; otherwise a publishable key can be mistaken for a user JWT.
    const isPublicApiKey = !!token && (token === publishableKey || token === legacyAnonKey || token === anonKey);
    const adminClient = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

    // Dedicated unauthenticated entry point for Android's email + one-time pairing code.
    // Only this action accepts the public publishable key; all other actions require a user JWT.
    if (action === "redeemPairing" && (!token || token === authHeader || isPublicApiKey)) {
      const email = String(body.email ?? "").trim().toLowerCase();
      const code = String(body.code ?? "").replace(/\D/g, "");
      if (!email.includes("@") || !/^\d{6}$/.test(code)) {
        return json({ error: "Enter a valid officer email and the 6-digit pairing code." }, 400);
      }
      const emailHash = await sha256(email);
      const { data: attemptRows, error: attemptReadError } = await adminClient
        .from("mfp_evidence_pairing_attempt_limits")
        .select("attempt_count,window_started_at,blocked_until")
        .eq("email_hash", emailHash)
        .maybeSingle();
      if (attemptReadError) throw attemptReadError;
      if (attemptRows?.blocked_until && new Date(attemptRows.blocked_until).getTime() > Date.now()) {
        return json({ error: "Too many attempts for this email. Wait 15 minutes before trying again." }, 429);
      }
      const codeHash = await sha256(code);
      const { data: pairing, error: pairingError } = await adminClient
        .from("mfp_evidence_pairing_requests")
        .select("id,user_id,status,expires_at")
        .eq("code_hash", codeHash)
        .maybeSingle();
      if (pairingError) throw pairingError;
      if (!pairing || pairing.status !== "PENDING" || new Date(pairing.expires_at).getTime() <= Date.now()) {
        const { error: attemptError } = await adminClient.rpc("mfp_record_evidence_pairing_failure", { p_email_hash: emailHash });
        if (attemptError) throw attemptError;
        return json({ error: "Pairing code is invalid, expired, or already used. Generate a fresh code on the website." }, 404);
      }
      const { data: profile, error: profileError } = await adminClient
        .from("mfp_user_profiles")
        .select("user_id,email,display_name,role,account_status,team_key,team_confirmed")
        .eq("user_id", pairing.user_id)
        .maybeSingle();
      if (profileError) throw profileError;
      if (!profile || String(profile.email ?? "").trim().toLowerCase() !== email) {
        const { error: attemptError } = await adminClient.rpc("mfp_record_evidence_pairing_failure", { p_email_hash: emailHash });
        if (attemptError) throw attemptError;
        return json({ error: "The officer email must match the account that generated this pairing code." }, 403);
      }
      const isAdmin = profile.role === "ADMIN" && profile.account_status === "ACTIVE";
      const isEvidenceAuthorized = profile.account_status === "ACTIVE" && (isAdmin || (profile.team_key === "evidence" && profile.team_confirmed === true));
      if (!isEvidenceAuthorized) return json({ error: "This account is not authorized for MF Evidence." }, 403);
      const deviceLabel = String(body.deviceLabel ?? "Android device").slice(0, 120);
      const { data: redeemed, error: redeemError } = await adminClient.rpc("mfp_redeem_evidence_pairing", {
        p_code_hash: codeHash,
        p_user_id: pairing.user_id,
        p_device_label: deviceLabel
      });
      if (redeemError) {
        const msg = redeemError.message || "Pairing could not be redeemed.";
        return json({ error: msg }, 409);
      }
      await adminClient.from("mfp_evidence_pairing_attempt_limits").delete().eq("email_hash", emailHash);
      // Compatibility mirror for the unchanged Android app, which polls public.app_registrations.
      const { error: legacyRegistrationError } = await adminClient.from("mfp_android_app_registrations").upsert({
        user_id: pairing.user_id,
        status: "ACTIVATED",
        team_id: profile.team_key ?? "evidence",
        updated_at: new Date().toISOString()
      }, { onConflict: "user_id" });
      if (legacyRegistrationError) throw legacyRegistrationError;
      return json({ ...(redeemed ?? {}), success: true, userId: pairing.user_id, email: profile.email, displayName: profile.display_name ?? "", teamId: profile.team_key ?? "evidence" });
    }

    if (!token || token === authHeader || isPublicApiKey) return json({ error: "Authentication required" }, 401);
    const userClient = createClient(url, anonKey, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false } });
    const { data: authData, error: authError } = await userClient.auth.getUser(token);
    if (authError || !authData.user) return json({ error: "Invalid or expired session" }, 401);
    const user = authData.user;
    const { data: profile } = await adminClient.from("mfp_user_profiles").select("role,account_status,team_key,team_confirmed,email,display_name").eq("user_id", user.id).maybeSingle();
    const isAdmin = profile?.role === "ADMIN" && profile?.account_status === "ACTIVE";
    const isEvidenceAuthorized = !!profile && profile.account_status === "ACTIVE" && (isAdmin || (profile.team_key === "evidence" && profile.team_confirmed === true));
    if (action === "createPairing") {
      if (!isEvidenceAuthorized) return json({ error: "Active Evidence team authorization is required." }, 403);
      const { count } = await adminClient.from("mfp_evidence_pairing_requests").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("status", "PENDING").gt("expires_at", new Date().toISOString());
      if ((count ?? 0) >= 3) return json({ error: "Too many active pairing requests. Cancel an existing request or wait for expiry." }, 429);
      // Generate an unbiased, cryptographically secure six-digit code. Leading zeroes are valid.
      const max = 0x1_0000_0000;
      const limit = Math.floor(max / 1_000_000) * 1_000_000;
      let created: { id: string } | null = null;
      let code = "";
      let expiresAt = "";
      let lastError: unknown = null;
      for (let attempt = 0; attempt < 5; attempt++) {
        const bytes = new Uint32Array(1);
        do { crypto.getRandomValues(bytes); } while (bytes[0] >= limit);
        code = String(bytes[0] % 1_000_000).padStart(6, "0");
        expiresAt = new Date(Date.now() + 600_000).toISOString();
        const { data, error } = await adminClient.from("mfp_evidence_pairing_requests")
          .insert({ user_id: user.id, code_hash: await sha256(code), expires_at: expiresAt, status: "PENDING" })
          .select("id").single();
        if (!error && data) { created = data; break; }
        lastError = error;
        // A hash collision is extremely unlikely, but retry only for unique-constraint conflicts.
        if ((error as any)?.code !== "23505") throw error;
      }
      if (!created) throw lastError ?? new Error("Could not create a unique pairing code.");
      return json({ code, requestId: created.id, expiresAt: new Date(expiresAt).getTime(), expiresInSeconds: 600 });
    }
    if (action === "redeemPairing") {
      if (!isEvidenceAuthorized) return json({ error: "Active Evidence team authorization is required." }, 403);
      const code = String(body.code ?? "").replace(/\D/g, ""); if (!/^\d{6}$/.test(code)) return json({ error: "Enter the 6-digit pairing code." }, 400);
      const codeHash = await sha256(code);
      const { data: pairing, error } = await adminClient.from("mfp_evidence_pairing_requests").select("id,user_id,status,expires_at").eq("code_hash", codeHash).maybeSingle(); if (error) throw error;
      if (!pairing || pairing.status !== "PENDING" || new Date(pairing.expires_at).getTime() <= Date.now()) return json({ error: "Pairing code is invalid, expired, or already used." }, 404);
      if (pairing.user_id !== user.id) return json({ error: "Sign in with the same MF MPanel account that generated this code." }, 403);
      const { data: redeemed, error: redeemError } = await adminClient.rpc("mfp_redeem_evidence_pairing", { p_code_hash: codeHash, p_user_id: user.id, p_device_label: String(body.deviceLabel ?? "Android device").slice(0, 120) });
      if (redeemError) return json({ error: redeemError.message || "Pairing could not be redeemed." }, 409);
      const { error: legacyRegistrationError } = await adminClient.from("mfp_android_app_registrations").upsert({
        user_id: user.id,
        status: "ACTIVATED",
        team_id: profile?.team_key ?? "evidence",
        updated_at: new Date().toISOString()
      }, { onConflict: "user_id" });
      if (legacyRegistrationError) throw legacyRegistrationError;
      return json(redeemed);
    }
    if (action === "cancelPairing") {
      const id = String(body.requestId ?? ""); const { data: pair, error } = await adminClient.from("mfp_evidence_pairing_requests").select("id,user_id,status").eq("id", id).maybeSingle(); if (error) throw error;
      if (!pair) return json({ success: true }); if (pair.user_id !== user.id && !isAdmin) return json({ error: "You cannot cancel another user's pairing request." }, 403);
      if (pair.status === "PENDING") await adminClient.from("mfp_evidence_pairing_requests").update({ status: "CANCELLED" }).eq("id", id); return json({ success: true });
    }
    if (action === "disconnect") {
      const target = String(body.userId ?? user.id); if (target !== user.id && !isAdmin) return json({ error: "Administrator access is required to disconnect another user." }, 403);
      const { data: reg, error } = await adminClient.from("mfp_evidence_app_registrations").select("id").eq("user_id", target).eq("application_id", "MF_EVIDENCE").order("linked_at", { ascending: false }).limit(1).maybeSingle(); if (error) throw error;
      if (reg) { await adminClient.from("mfp_evidence_app_registrations").update({ status: "REVOKED", activation_status: "INACTIVE", revoked_at: new Date().toISOString() }).eq("id", reg.id); await adminClient.from("mfp_evidence_connection_events").insert({ user_id: target, registration_id: reg.id, event_type: "DISCONNECTED", metadata: { actorUid: user.id, applicationId: "MF_EVIDENCE" } }); }
      const { error: legacyDisconnectError } = await adminClient.from("mfp_android_app_registrations").update({ status: "ACCESS_REVOKED", updated_at: new Date().toISOString() }).eq("user_id", target);
      if (legacyDisconnectError) throw legacyDisconnectError;
      return json({ success: true });
    }
    if (action === "getSummary") {
      if (!isEvidenceAuthorized) return json({ error: "Active Evidence team authorization is required." }, 403);
      const { data: reg } = await adminClient.from("mfp_evidence_app_registrations").select("*").eq("user_id", user.id).eq("application_id", "MF_EVIDENCE").order("linked_at", { ascending: false }).limit(1).maybeSingle(); if (!reg || reg.status !== "ACTIVE") return json({ active: false, totalProfiles: 0, platformCounts: {}, teamId: profile?.team_key ?? null, lastSync: null });
      const counts: Record<string,number> = {}; let totalProfiles = 0, offset = 0;
      while (true) {
        const { data: rows, error } = await adminClient.from("mfp_documents").select("data").eq("collection_name", "profiles").filter("data->>currentWorkflowStatus", "eq", "VERIFIED").range(offset, offset + 999);
        if (error) throw error;
        for (const row of rows ?? []) { const platform = String((row as any).data?.platform ?? "Other"); counts[platform] = (counts[platform] ?? 0) + 1; }
        totalProfiles += rows?.length ?? 0; if ((rows?.length ?? 0) < 1000) break; offset += 1000;
      }
      return json({ active: true, totalProfiles, platformCounts: counts, teamId: reg.team_id, lastSync: millis(reg.last_seen_at) });
    }
    if (action === "getLinksPage") {
      if (!isEvidenceAuthorized) return json({ error: "Active Evidence team authorization is required." }, 403);
      const { data: reg } = await adminClient.from("mfp_evidence_app_registrations").select("id,status,team_authorized").eq("user_id", user.id).eq("application_id", "MF_EVIDENCE").order("linked_at", { ascending: false }).limit(1).maybeSingle(); if (!reg || reg.status !== "ACTIVE" || reg.team_authorized !== true) return json({ error: "Link your MF Evidence application first." }, 403);
      const pageSize = 100; let q = adminClient.from("mfp_documents").select("document_id,data", { count: "exact" }).eq("collection_name", "profiles").filter("data->>currentWorkflowStatus", "eq", "VERIFIED").order("document_id", { ascending: true }).limit(pageSize); const cursor = typeof body.cursor === "string" && body.cursor ? body.cursor : null; if (cursor) q = q.gt("document_id", cursor);
      const { data: rows, count, error } = await q; if (error) throw error; const links = (rows ?? []).map((r: any) => ({ id: r.document_id, profileId: r.document_id, url: r.data?.canonicalUrl ?? r.data?.originalUrl ?? "", platform: r.data?.platform ?? "Other", status: r.data?.currentWorkflowStatus ?? "VERIFIED" })).filter((r: any) => r.url); const last = rows?.[rows.length-1]?.document_id ?? null;
      await adminClient.from("mfp_evidence_app_registrations").update({ last_seen_at: new Date().toISOString() }).eq("id", reg.id); return json({ links, nextCursor: rows?.length === pageSize ? last : null, total: count ?? links.length });
    }
    if (action === "recordDownload") {
      if (!isEvidenceAuthorized) return json({ error: "Active Evidence team authorization is required." }, 403);
      const { data: reg } = await adminClient.from("mfp_evidence_app_registrations").select("id,status,team_authorized").eq("user_id", user.id).eq("application_id", "MF_EVIDENCE").order("linked_at", { ascending: false }).limit(1).maybeSingle(); if (!reg || reg.status !== "ACTIVE" || reg.team_authorized !== true) return json({ error: "Link your MF Evidence application first." }, 403);
      const count = Math.max(0, Math.min(100000, Number(body.count) || 0)); const platforms = body.platforms && typeof body.platforms === "object" ? body.platforms : {}; const { error } = await adminClient.from("mfp_evidence_connection_events").insert({ user_id: user.id, registration_id: reg.id, event_type: "LINKS_DOWNLOADED", metadata: { count, platforms, applicationId: "MF_EVIDENCE" } }); if (error) throw error;
      await adminClient.from("mfp_evidence_app_registrations").update({ last_seen_at: new Date().toISOString() }).eq("id", reg.id); return json({ success: true });
    }
    if (action === "listAdmin") {
      if (!isAdmin) return json({ error: "Administrator access is required." }, 403); const { data: regs, error } = await adminClient.from("mfp_evidence_app_registrations").select("*").order("linked_at", { ascending: false }).limit(500); if (error) throw error;
      const ids = [...new Set((regs ?? []).map((r: any) => r.user_id))]; const { data: users } = ids.length ? await adminClient.from("mfp_user_profiles").select("user_id,email,display_name,team_key").in("user_id", ids) : { data: [] as any[] }; const byId = new Map((users ?? []).map((u: any) => [u.user_id,u]));
      return json({ registrations: (regs ?? []).map((r: any) => { const u: any = byId.get(r.user_id) ?? {}; return { id:r.id,userId:r.user_id,email:u.email ?? "",displayName:u.display_name ?? "",teamId:r.team_id ?? u.team_key ?? "",status:r.status,activationStatus:r.activation_status,deviceLabel:r.device_label ?? "",linkedAt:millis(r.linked_at),lastSeenAt:millis(r.last_seen_at) }; }) });
    }
    return json({ error: "Unsupported action" }, 400);
  } catch (error) { const message = error instanceof Error ? error.message : "Unexpected backend error"; const traceId = crypto.randomUUID(); console.error("mfp-evidence-linking", { traceId, message }); return json({ error: message, traceId }, 500); }
});
