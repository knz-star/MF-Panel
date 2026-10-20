import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS", "Content-Type": "application/json" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: cors });
const text = (value: unknown) => typeof value === "string" ? value : "";
const TEAMS = ["searching", "checking", "reports", "evidence"];
const GENDER_GROUPS = ["male", "female"];
const COLLECTIONS = ["profiles", "posts", "checkingRecords", "workflowEvents", "reportJobs", "reportPackages"];
function isoStart(date: string) { const d = new Date(`${date}T00:00:00.000Z`); return Number.isFinite(d.getTime()) ? d.toISOString() : null; }
function isoEnd(date: string) { const d = new Date(`${date}T23:59:59.999Z`); return Number.isFinite(d.getTime()) ? d.toISOString() : null; }
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const url = Deno.env.get("SUPABASE_URL"), anon = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY"), secret = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !anon || !secret) return json({ error: "Supabase function environment is incomplete" }, 500);
    const header = req.headers.get("Authorization") ?? "", token = header.replace(/^Bearer\s+/i, "");
    if (!token || token === header) return json({ error: "Authentication required" }, 401);
    const authClient = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false } });
    const { data: auth, error: authError } = await authClient.auth.getUser(token);
    if (authError || !auth.user) return json({ error: "Invalid or expired session" }, 401);
    const user = auth.user, db = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: profile, error: profileError } = await db.from("mfp_user_profiles").select("user_id,email,display_name,role,account_status,team_key,team_confirmed,gender,gender_group").eq("user_id", user.id).maybeSingle();
    if (profileError) throw profileError;
    if (!profile || profile.account_status !== "ACTIVE" || !profile.team_confirmed && profile.role !== "ADMIN") return json({ error: "An active, assigned workspace is required" }, 403);
    const body = await req.json().catch(() => ({}));
    if (text(body.action) !== "generate") return json({ error: "Unsupported action" }, 400);
    const period = text(body.period) || "daily";
    const now = new Date();
    let startDate = text(body.startDate), endDate = text(body.endDate);
    if (period !== "custom") {
      endDate = now.toISOString().slice(0, 10);
      const days = period === "daily" ? 1 : period === "weekly" ? 7 : period === "fortnight" ? 14 : period === "monthly" ? 30 : 1;
      startDate = new Date(now.getTime() - (days - 1) * 86400000).toISOString().slice(0, 10);
    }
    const start = isoStart(startDate), end = isoEnd(endDate);
    if (!start || !end || start > end) return json({ error: "Choose a valid report date range" }, 400);
    if (new Date(end).getTime() - new Date(start).getTime() > 366 * 86400000) return json({ error: "A report range cannot exceed 366 days" }, 400);
    const isAdmin = profile.role === "ADMIN";
    const team = text(profile.team_key);
    if (!isAdmin && !TEAMS.includes(team)) return json({ error: "Your account has no supported team assignment" }, 403);
    const { data: rows, error: rowsError } = await db.from("mfp_documents").select("document_id,collection_name,data,owner_uid,team_key,created_at,updated_at").in("collection_name", COLLECTIONS).gte("created_at", start).lte("created_at", end).order("created_at", { ascending: false }).limit(10000);
    if (rowsError) throw rowsError;
    const belongsToTeam = (row: any, teamKey: string) => row.team_key === teamKey || text(row.data?.team) === teamKey || text(row.data?.teamKey) === teamKey;
    const queryTruncated = (rows ?? []).length >= 10000;
    const scopedRows = (rows ?? []).filter((row: any) => isAdmin || belongsToTeam(row, team));
    const counts: Record<string, number> = {};
    for (const collection of COLLECTIONS) counts[collection] = scopedRows.filter((row: any) => row.collection_name === collection).length;
    const teamSummary = Object.fromEntries(TEAMS.map((t) => [t, { profiles: 0, posts: 0, checkingRecords: 0, workflowEvents: 0, reportJobs: 0, reportPackages: 0, total: 0 }]));
    const userMap = new Map<string, { userId: string; email: string; name: string; team: string; activity: number; completed: number; failed: number }>();
    const linkRecords: any[] = [];
    let completed = 0, failed = 0;
    for (const row of scopedRows as any[]) {
      const d = row.data ?? {}, rowTeam = text(row.team_key) || text(d.team) || text(d.teamKey) || "unassigned";
      const summary = teamSummary[rowTeam];
      if (summary) { summary[row.collection_name as keyof typeof summary]++; summary.total++; }
      const actor = text(d.actorUid) || text(d.createdByUid) || text(d.checkedByUid) || text(d.assignedToUid) || text(d.assignedTo) || text(d.userId) || text(d.createdBy) || text(row.owner_uid);
      if (actor) {
        const prior = userMap.get(actor) ?? { userId: actor, email: text(d.createdByEmail) || "", name: text(d.displayName) || text(d.checkedByEmail) || actor, team: rowTeam, activity: 0, completed: 0, failed: 0 };
        prior.activity++;
        const status = text(d.outcome) || text(d.status) || text(d.currentWorkflowStatus) || text(d.action);
        if (/COMPLETED|VERIFIED|SUCCESS|APPROVED|HANDOFF|DONE/i.test(status)) { prior.completed++; completed++; }
        if (/FAILED|BLOCKED|INVALID|REJECTED|ERROR/i.test(status)) { prior.failed++; failed++; }
        userMap.set(actor, prior);
      }
      if (row.collection_name === "profiles" || row.collection_name === "posts") {
        linkRecords.push({ ownerUid: row.owner_uid, createdByUid: text(d.createdByUid) || text(d.createdBy), createdByEmail: text(d.createdByEmail), assignedToUid: text(d.assignedToUid) || text(d.assignedTo), assignedToEmail: text(d.assignedToEmail), recordType: row.collection_name === "profiles" ? "profile" : "post", documentId: row.document_id, publicId: row.collection_name === "profiles" ? (text(d.mfpProfileId) || text(d.profileId) || row.document_id) : (text(d.mfpPostId) || row.document_id), profileId: text(d.mfpProfileId) || text(d.profileId), url: text(d.canonicalUrl) || text(d.originalUrl) || text(d.url), platform: text(d.platform) || "Other", status: text(d.currentWorkflowStatus) || text(d.status) || "UNSET", team: rowTeam, createdAt: row.created_at });
      }
    }
    const { data: memberRows, error: membersError } = await db.from("mfp_user_profiles").select("user_id,email,display_name,role,account_status,team_key,gender,gender_group").limit(2000);
    if (membersError) throw membersError;
    const members = (memberRows ?? []).filter((m: any) => isAdmin || m.team_key === team).map((m: any) => ({ userId: m.user_id, email: m.email, name: m.display_name, role: m.role, status: m.account_status, team: m.team_key, gender: m.gender_group ?? m.gender }));
    const memberById = new Map(members.map((member: any) => [member.userId, member]));
    const memberByEmail = new Map(members.map((member: any) => [text(member.email).toLowerCase(), member]).filter(([email]) => Boolean(email)));
    const memberByName = new Map(members.map((member: any) => [text(member.name).toLowerCase(), member]).filter(([name]) => Boolean(name)));
    const activityMembers = [...userMap.values()].map((entry) => { const member = (memberById.get(entry.userId) || memberByEmail.get(entry.userId.toLowerCase()) || memberByName.get(entry.userId.toLowerCase())) as any; return { ...entry, userId: member?.userId || entry.userId, name: member?.name || entry.name, email: member?.email || entry.email, team: member?.team || entry.team, gender: member?.gender || null, role: member?.role || null, status: member?.status || null }; });
    const requestedShare = Array.isArray(body.shareTeams) ? body.shareTeams.map((v: unknown) => text(v)).filter((v: string) => TEAMS.includes(v)) : [];
    const sharedTeams = isAdmin ? [...new Set(requestedShare)] : [team];
    const requestedGenderShare = Array.isArray(body.shareGenderGroups) ? body.shareGenderGroups.map((v: unknown) => text(v)).filter((v: string) => GENDER_GROUPS.includes(v)) : [];
    const sharedGenderGroups = isAdmin ? [...new Set(requestedGenderShare)] : [];
    const reportId = `ORGREP-${Date.now()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    const report = {
      reportId, title: text(body.title).trim().slice(0, 120) || `${period.toUpperCase()} organization report`, period, startDate, endDate,
      createdAt: now.toISOString(), createdBy: user.id, createdByEmail: user.email ?? "", creatorName: text(profile.display_name) || user.email || "User",
      scope: isAdmin ? "ORGANIZATION" : "TEAM", teamScope: isAdmin ? null : team, sharedTeams, sharedGenderGroups,
      totals: { records: scopedRows.length, profiles: counts.profiles, posts: counts.posts, checkingRecords: counts.checkingRecords, workflowEvents: counts.workflowEvents, reportJobs: counts.reportJobs, reportPackages: counts.reportPackages, completed, failed, activeMembers: members.filter((m: any) => m.status === "ACTIVE").length },
      byCollection: counts, byTeam: isAdmin ? teamSummary : { [team]: teamSummary[team] },
      members: activityMembers.sort((a, b) => b.activity - a.activity).slice(0, 200),
      teamMembers: members,
      linkRecords: linkRecords.slice(0, 1000),
      truncated: queryTruncated || linkRecords.length > 1000,
    };
    const masterStored = { ...report, sharedTeams: isAdmin ? [] : [team], sharedGenderGroups: [] };
    const { error: saveError } = await db.from("mfp_documents").upsert({ collection_name: "organizationReports", document_id: reportId, data: masterStored, owner_uid: user.id, team_key: isAdmin ? null : team, created_at: now.toISOString(), updated_at: now.toISOString() }, { onConflict: "collection_name,document_id" });
    if (saveError) throw saveError;
    // Never expose another team's member-level details in a shared report. Admins
    // retain the private organization master; each selected team receives a scoped copy.
    if (isAdmin) {
      for (const shareTeam of sharedTeams) {
        const teamRows = scopedRows.filter((row: any) => belongsToTeam(row, shareTeam));
        const teamCounts = Object.fromEntries(COLLECTIONS.map((name) => [name, teamRows.filter((row: any) => row.collection_name === name).length]));
        const teamMembers = members.filter((m: any) => m.team === shareTeam);
        const teamActivity = activityMembers.filter((m) => m.team === shareTeam);
        const teamLinks = linkRecords.filter((link) => link.team === shareTeam);
        const teamCompleted = teamActivity.reduce((sum, m) => sum + m.completed, 0);
        const teamFailed = teamActivity.reduce((sum, m) => sum + m.failed, 0);
        const copyId = `${reportId}-${shareTeam}`;
        const sharedCopy = {
          ...report, reportId: copyId, masterReportId: reportId, scope: "TEAM_SHARED_COPY", teamScope: shareTeam, sharedTeams: [shareTeam], sharedGenderGroups: [],
          totals: { records: teamRows.length, profiles: teamCounts.profiles, posts: teamCounts.posts, checkingRecords: teamCounts.checkingRecords, workflowEvents: teamCounts.workflowEvents, reportJobs: teamCounts.reportJobs, reportPackages: teamCounts.reportPackages, completed: teamCompleted, failed: teamFailed, activeMembers: teamMembers.filter((m: any) => m.status === "ACTIVE").length },
          byCollection: teamCounts, byTeam: { [shareTeam]: teamSummary[shareTeam] }, members: teamActivity, teamMembers, linkRecords: teamLinks,
        };
        const { error: copyError } = await db.from("mfp_documents").upsert({ collection_name: "organizationReports", document_id: copyId, data: sharedCopy, owner_uid: user.id, team_key: shareTeam, created_at: now.toISOString(), updated_at: now.toISOString() }, { onConflict: "collection_name,document_id" });
        if (copyError) throw copyError;
      }
    }
    if (isAdmin) {
      for (const genderGroup of sharedGenderGroups) {
        const genderMembers = members.filter((m: any) => m.gender === genderGroup);
        const genderIds = new Set(genderMembers.map((m: any) => m.userId));
        const genderEmails = new Set(genderMembers.map((m: any) => text(m.email).toLowerCase()).filter(Boolean));
        const genderNames = new Set(genderMembers.map((m: any) => text(m.name).toLowerCase()).filter(Boolean));
        const matchesGenderActor = (row: any) => {
          const d = row.data ?? {};
          const actorValues = [text(row.owner_uid), text(d.actorUid), text(d.createdByUid), text(d.checkedByUid), text(d.assignedToUid), text(d.assignedTo), text(d.assignedToEmail), text(d.userId), text(d.createdBy), text(d.createdByEmail)].map((v) => v.toLowerCase()).filter(Boolean);
          return actorValues.some((v) => genderIds.has(v) || genderEmails.has(v) || genderNames.has(v));
        };
        const genderRows = scopedRows.filter(matchesGenderActor);
        const genderCounts = Object.fromEntries(COLLECTIONS.map((name) => [name, genderRows.filter((row: any) => row.collection_name === name).length]));
        const genderActivity = activityMembers.filter((m) => m.gender === genderGroup);
        const genderLinks = linkRecords.filter((link) => genderIds.has(text(link.ownerUid)) || genderIds.has(text(link.createdByUid)) || genderEmails.has(text(link.createdByEmail).toLowerCase()) || genderIds.has(text(link.assignedToUid)) || genderEmails.has(text(link.assignedToEmail).toLowerCase()));
        const genderWorkByTeam: Record<string, number> = {};
        for (const row of genderRows as any[]) {
          const key = text(row.team_key) || text(row.data?.team) || text(row.data?.teamKey) || "unassigned";
          genderWorkByTeam[key] = (genderWorkByTeam[key] ?? 0) + 1;
        }
        const copyId = `${reportId}-gender-${genderGroup}`;
        const genderCopy = {
          ...report, reportId: copyId, masterReportId: reportId, scope: "GENDER_SHARED_COPY", teamScope: null, genderScope: genderGroup,
          sharedTeams: [], sharedGenderGroups: [genderGroup], totals: { records: genderRows.length, profiles: genderCounts.profiles, posts: genderCounts.posts, checkingRecords: genderCounts.checkingRecords, workflowEvents: genderCounts.workflowEvents, reportJobs: genderCounts.reportJobs, reportPackages: genderCounts.reportPackages, completed: genderActivity.reduce((sum, m) => sum + m.completed, 0), failed: genderActivity.reduce((sum, m) => sum + m.failed, 0), activeMembers: genderMembers.filter((m: any) => m.status === "ACTIVE").length },
          byCollection: genderCounts, byTeam: genderWorkByTeam, members: genderActivity, teamMembers: genderMembers, linkRecords: genderLinks,
        };
        const { error: genderCopyError } = await db.from("mfp_documents").upsert({ collection_name: "organizationReports", document_id: copyId, data: genderCopy, owner_uid: user.id, team_key: null, created_at: now.toISOString(), updated_at: now.toISOString() }, { onConflict: "collection_name,document_id" });
        if (genderCopyError) throw genderCopyError;
      }
    }
    return json({ success: true, report });
  } catch (error) {
    console.error("mfp-organization-reports", error);
    return json({ error: error instanceof Error ? error.message : "Unexpected server error" }, 500);
  }
});
