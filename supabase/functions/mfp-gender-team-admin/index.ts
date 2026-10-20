import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS", "Content-Type": "application/json" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: cors });
const text = (v: unknown) => typeof v === "string" ? v : "";
const groups = ["male", "female"] as const;
const collections = ["profiles", "posts", "checkingRecords", "workflowEvents", "reportJobs", "reportPackages"];
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
    const db = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: caller, error: callerError } = await db.from("mfp_user_profiles").select("user_id,email,display_name,role,account_status,gender_group,team_key,team_confirmed").eq("user_id", auth.user.id).maybeSingle();
    if (callerError) throw callerError;
    if (!caller || caller.account_status !== "ACTIVE") return json({ error: "An active workspace account is required" }, 403);
    const body = await req.json().catch(() => ({}));
    const action = text(body.action);
    if (action === "assign") {
      if (caller.role !== "ADMIN") return json({ error: "Only Admin can assign gender-group leads" }, 403);
      const genderGroup = text(body.genderGroup).toLowerCase(), adminUserId = text(body.adminUserId);
      if (!groups.includes(genderGroup as any)) return json({ error: "Choose Male/Female group" }, 400);
      if (!adminUserId) { const { error: removeError } = await db.from("mfp_gender_team_admin_assignments").delete().eq("gender_group", genderGroup); if (removeError) throw removeError; return json({ success: true, removed: true, genderGroup }); }
      const { data: target, error: targetError } = await db.from("mfp_user_profiles").select("user_id,role,account_status,display_name,email,gender,gender_group").eq("user_id", adminUserId).maybeSingle();
      if (targetError) throw targetError;
      if (!target || target.account_status !== "ACTIVE" || target.role !== "TEAM_ADMIN") return json({ error: "Gender-group leads must be active Team Admin accounts" }, 400);
      if ((target.gender_group ?? target.gender) !== genderGroup) return json({ error: `Choose a Team Admin whose stored gender group is ${genderGroup}` }, 400);
      const { error: assignError } = await db.from("mfp_gender_team_admin_assignments").upsert({ gender_group: genderGroup, admin_user_id: adminUserId, assigned_by: auth.user.id, updated_at: new Date().toISOString() }, { onConflict: "gender_group" });
      if (assignError) return json({ error: assignError.code === "23505" ? "This Team Admin is already assigned to another gender group" : assignError.message }, 400);
      return json({ success: true, genderGroup, adminUserId, adminName: target.display_name || target.email });
    }
    if (action !== "get") return json({ error: "Unsupported action" }, 400);
    const { data: assignments, error: assignmentsError } = await db.from("mfp_gender_team_admin_assignments").select("gender_group,admin_user_id,assigned_by,created_at,updated_at");
    if (assignmentsError) throw assignmentsError;
    let genderGroup = text(body.genderGroup).toLowerCase();
    const callerAssignment = (assignments ?? []).find((row: any) => row.admin_user_id === auth.user.id);
    if (caller.role === "TEAM_ADMIN") {
      if (caller.team_confirmed !== true || !text(caller.team_key)) return json({ error: "Your functional workspace assignment must be active before accessing the gender-team dashboard" }, 403);
      if (!callerAssignment) return json({ error: "No Male/Female Team Admin group has been assigned to your account" }, 403);
      genderGroup = callerAssignment.gender_group;
    } else if (caller.role !== "ADMIN") return json({ error: "Admin or assigned Gender Team Admin access is required" }, 403);
    if (!groups.includes(genderGroup as any)) genderGroup = "male";
    const { data: groupAdmin, error: groupAdminError } = await db.from("mfp_gender_team_admin_assignments").select("gender_group,admin_user_id").eq("gender_group", genderGroup).maybeSingle();
    if (groupAdminError) throw groupAdminError;
    const { data: memberRows, error: membersError } = await db.from("mfp_user_profiles").select("user_id,email,display_name,role,account_status,gender,gender_group,team_key,team_confirmed").eq("gender_group", genderGroup).limit(3000);
    if (membersError) throw membersError;
    const members = memberRows ?? [];
    const memberById = new Map(members.map((m: any) => [m.user_id, m]));
    const memberByEmail = new Map(members.map((m: any) => [text(m.email).toLowerCase(), m]).filter(([email]) => Boolean(email)));
    const memberByName = new Map(members.map((m: any) => [text(m.display_name).toLowerCase(), m]).filter(([name]) => Boolean(name)));
    const { data: docs, error: docsError } = await db.from("mfp_documents").select("document_id,collection_name,data,owner_uid,team_key,created_at").in("collection_name", collections).order("created_at", { ascending: false }).limit(10000);
    if (docsError) throw docsError;
    const workByTeam: Record<string, number> = { searching: 0, checking: 0, reports: 0, evidence: 0, unassigned: 0 };
    const memberActivity = new Map<string, { userId: string; name: string; email: string; team: string; genderGroup: string; activity: number; profiles: number; posts: number; checks: number; reports: number; completed: number; failed: number }>();
    for (const member of members as any[]) memberActivity.set(member.user_id, { userId: member.user_id, name: member.display_name || member.email, email: member.email, team: text(member.team_key) || "unassigned", genderGroup, activity: 0, profiles: 0, posts: 0, checks: 0, reports: 0, completed: 0, failed: 0 });
    const linkRecords: any[] = [];
    let totalWork = 0, completed = 0, failed = 0;
    for (const row of docs ?? []) {
      const d = (row as any).data ?? {};
      const actorCandidates = [text(d.actorUid), text(d.createdByUid), text(d.checkedByUid), text(d.assignedToUid), text(d.assignedTo), text(d.assignedToEmail), text(d.userId), text(d.createdBy), text(d.createdByEmail), text((row as any).owner_uid)].filter(Boolean);
      const actor = actorCandidates.map((value) => memberById.get(value) || memberByEmail.get(value.toLowerCase()) || memberByName.get(value.toLowerCase())).find(Boolean);
      if (!actor) continue;
      const team = text((row as any).team_key) || text(d.team) || text(d.teamKey) || "unassigned";
      workByTeam[team] = (workByTeam[team] ?? 0) + 1; totalWork++;
      const member = memberActivity.get(actor.user_id) ?? { userId: actor.user_id, name: actor.display_name || actor.email, email: actor.email, team, genderGroup, activity: 0, profiles: 0, posts: 0, checks: 0, reports: 0, completed: 0, failed: 0 };
      member.activity++;
      if ((row as any).collection_name === "profiles") member.profiles++;
      if ((row as any).collection_name === "posts") member.posts++;
      if ((row as any).collection_name === "checkingRecords") member.checks++;
      if (["reportJobs", "reportPackages"].includes((row as any).collection_name)) member.reports++;
      const status = text(d.outcome) || text(d.status) || text(d.currentWorkflowStatus) || text(d.action);
      if (/COMPLETED|VERIFIED|SUCCESS|APPROVED|HANDOFF|DONE/i.test(status)) { member.completed++; completed++; }
      if (/FAILED|BLOCKED|INVALID|REJECTED|ERROR/i.test(status)) { member.failed++; failed++; }
      memberActivity.set(actor.user_id, member);
      if (["profiles", "posts"].includes((row as any).collection_name)) linkRecords.push({ recordType: (row as any).collection_name === "profiles" ? "profile" : "post", publicId: (row as any).collection_name === "profiles" ? (text(d.mfpProfileId) || (row as any).document_id) : (text(d.mfpPostId) || (row as any).document_id), profileId: text(d.mfpProfileId) || text(d.profileId), url: text(d.canonicalUrl) || text(d.originalUrl) || text(d.url), platform: text(d.platform) || "Other", status: text(d.currentWorkflowStatus) || text(d.status) || "UNSET", team, createdAt: (row as any).created_at });
    }
    return json({ success: true, genderGroup, groupAdminUserId: groupAdmin?.admin_user_id ?? null, totalMembers: members.length, activeMembers: members.filter((m: any) => m.account_status === "ACTIVE").length, totalWork, completed, failed, workByTeam, members: [...memberActivity.values()].sort((a, b) => b.activity - a.activity), linkRecords: linkRecords.slice(0, 1000), truncated: (docs ?? []).length >= 10000 || linkRecords.length > 1000, assignments: caller.role === "ADMIN" ? assignments : [] });
  } catch (error) {
    console.error("mfp-gender-team-admin", error);
    return json({ error: error instanceof Error ? error.message : "Unexpected server error" }, 500);
  }
});
