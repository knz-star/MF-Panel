import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
const cors = { "Access-Control-Allow-Origin":"*", "Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods":"POST, OPTIONS", "Content-Type":"application/json" };
const json = (body: unknown, status=200) => new Response(JSON.stringify(body), {status, headers:cors});
type Team = "searching" | "checking" | "reports" | "evidence";
const TEAMS: Team[] = ["searching","checking","reports","evidence"];
const COLORS: Record<Team,string> = { searching:"#2563eb", checking:"#d97706", reports:"#7c3aed", evidence:"#059669" };
const asText = (v: unknown) => typeof v === "string" ? v : "";
const norm = (v: unknown) => asText(v).trim().toLowerCase();
const dateKey = (d: Date) => d.toISOString().slice(0,10);

// Score defaults are deliberately explicit and easy to tune later in admin settings.
// 150 unique links per rolling 24h is the initial benchmark from the team's example.
const TARGET_LINKS_PER_24H = 150;
const scoreStamp = (row: any) => {
 const d = row?.data ?? {};
 const raw = d.checkedAt ?? d.completedAt ?? d.createdAt ?? d.updatedAt ?? row?.created_at;
 const t = typeof raw === "string" ? Date.parse(raw) : NaN;
 return Number.isFinite(t) ? t : NaN;
};
const actorMatches = (row: any, p: any) => {
 const d = row?.data ?? {};
 const actor = asText(d.checkedByUid ?? d.checkerUid ?? d.createdByUid ?? d.createdBy ?? d.submittedBy ?? d.actorUid ?? d.userId ?? row?.owner_uid);
 return actor === p.user_id || norm(actor) === norm(p.email) || norm(actor) === norm(p.display_name);
};
const productivityScore = (p: any, team: Team, docs: any[], nowMs = Date.now()) => {
 const eligible = docs.filter((row:any) => {
  const d=row.data??{};
  if(d.isTestData===true || !actorMatches(row,p)) return false;
  if(team==="searching") return row.collection_name==="profiles" && !!asText(d.canonicalUrl);
  if(team==="checking") return row.collection_name==="checkingRecords" && !!asText(d.profileId) && !!asText(d.outcome??d.status);
  if(team==="reports") return (row.collection_name==="reportJobs" && !!asText(d.jobId)) || (row.collection_name==="reportPackages" && !!asText(d.packageId));
  return false;
 }).map((row:any)=>({...row, _stamp:scoreStamp(row)})).filter((row:any)=>Number.isFinite(row._stamp)).sort((a:any,b:any)=>a._stamp-b._stamp);
 const cutoff=nowMs-24*60*60*1000;
 const recent=eligible.filter((row:any)=>row._stamp>=cutoff && row._stamp<=nowMs);
 const volumeScore=Math.min(100,recent.length/TARGET_LINKS_PER_24H*100);
 let speedScore=0, avgTurnaroundHours:number|null=null, latestActivityAt:string|null=null;
 if(eligible.length){
  const latest=eligible[eligible.length-1];
  latestActivityAt=new Date(latest._stamp).toISOString();
  if(team==="searching"){
   // Compare the latest observed submission cadence against the 24h target.
   const prior=eligible.length>1?eligible[eligible.length-2]:null;
   const gapHours=prior?(latest._stamp-prior._stamp)/3600000:null;
   const elapsedHours=(nowMs-latest._stamp)/3600000;
   const interval=gapHours===null?elapsedHours:gapHours;
   speedScore=Math.max(0,Math.min(100,(24-Math.max(0,interval))/24*100));
  } else {
   const profilesById=new Map(docs.filter((r:any)=>r.collection_name==="profiles").map((r:any)=>[asText(r.document_id),r]));
   const durations:number[]=[];
   for(const row of eligible){
    const d=row.data??{}, profile=profilesById.get(asText(d.profileId)) as any;
    const pd=profile?.data??{};
    const startRaw=pd.queueAssignedAt??pd.checkingStartedAt??pd.createdAt??profile?.created_at;
    const start=typeof startRaw==="string"?Date.parse(startRaw):NaN;
    const end=row._stamp;
    if(Number.isFinite(start)&&end>=start) durations.push((end-start)/3600000);
   }
   if(durations.length){
    avgTurnaroundHours=durations.reduce((a,b)=>a+b,0)/durations.length;
    speedScore=Math.max(0,Math.min(100,(24-Math.min(24,avgTurnaroundHours))/24*100));
   } else {
    const prior=eligible.length>1?eligible[eligible.length-2]:null;
    const gap=prior?(latest._stamp-prior._stamp)/3600000:(nowMs-latest._stamp)/3600000;
    speedScore=Math.max(0,Math.min(100,(24-Math.max(0,gap))/24*100));
   }
  }
 }
 // 70% real throughput + 30% cadence/turnaround. Faster cadence lifts the score;
 // missing reliable events remain null instead of fabricating a score.
 const score=eligible.length?Math.round((volumeScore*0.7+speedScore*0.3)*100)/100:null;
 return {score,volumeScore:Math.round(volumeScore*100)/100,speedScore:Math.round(speedScore*100)/100,linksLast24h:recent.length,avgTurnaroundHours:avgTurnaroundHours===null?null:Math.round(avgTurnaroundHours*100)/100,latestActivityAt};
};
Deno.serve(async (req: Request) => {
 if (req.method === "OPTIONS") return new Response("ok", {headers:cors});
 if (req.method !== "POST") return json({error:"Method not allowed"},405);
 try {
  const url=Deno.env.get("SUPABASE_URL"), anon=Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY"), secret=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if(!url||!anon||!secret) return json({error:"Supabase function environment is incomplete"},500);
  const header=req.headers.get("Authorization")??"", token=header.replace(/^Bearer\s+/i,"");
  if(!token||token===header) return json({error:"Authentication required"},401);
  const authClient=createClient(url,anon,{global:{headers:{Authorization:`Bearer ${token}`}},auth:{persistSession:false,autoRefreshToken:false}});
  const {data:authData,error:authErr}=await authClient.auth.getUser(token); if(authErr||!authData.user) return json({error:"Invalid or expired session"},401);
  const caller=authData.user, db=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:callerProfile,error:cpErr}=await db.from("mfp_user_profiles").select("user_id,email,display_name,role,account_status,team_key,allowed_modules").eq("user_id",caller.id).maybeSingle();
  if(cpErr) throw cpErr; if(!callerProfile) return json({error:"Account profile required"},403);
  const body=await req.json().catch(()=>({})), action=asText(body.action);
  if(callerProfile.account_status!=="ACTIVE" && action!=="getMyScore") return json({error:"Account is disabled or inactive. Contact your team administrator."},403);
  const {data:assignments,error:assErr}=await db.from("mfp_team_admin_assignments").select("team_key,admin_user_id");
  if(assErr && !String(assErr.message).includes("does not exist")) throw assErr;
  const teamAssignments=(assignments??[]) as Array<{team_key:Team;admin_user_id:string}>;
  const myTeams=teamAssignments.filter(x=>x.admin_user_id===caller.id).map(x=>x.team_key);
  // A global admin is the active ADMIN not assigned as a team lead. A team lead is scoped to their assigned team(s).
  const isSenior=callerProfile.role==="ADMIN" && myTeams.length===0;
  const canManage=(callerProfile.role==="ADMIN" && (isSenior || myTeams.length>0)) || (callerProfile.role==="TEAM_ADMIN" && myTeams.length>0);
  const requireManager=()=>{ if(!canManage) throw new Error("Team manager or senior administrator access is required."); };
  if(action==="getMyScore") {
    const days=Number(body.days)===14?14:7, start=new Date(Date.now()-(days-1)*86400000); start.setUTCHours(0,0,0,0);
    const {data:docs,error:dErr}=await db.from("mfp_documents").select("collection_name,document_id,data,owner_uid,team_key,created_at,updated_at").in("collection_name",["workflowEvents","profiles","posts","checkingRecords","reportJobs","reportPackages"]).gte("created_at",start.toISOString()).limit(10000); if(dErr) throw dErr;
    const {data:events,error:eErr}=await db.from("mfp_evidence_activity_events").select("user_id,event_type,created_at").eq("user_id",caller.id).gte("created_at",start.toISOString()).limit(5000); if(eErr) throw eErr;
    const daysList=Array.from({length:days},(_,i)=>dateKey(new Date(start.getTime()+i*86400000)));
    const points=new Map(daysList.map(d=>[d,{date:d,completed:0,failed:0,activity:0}])); let completed=0,failed=0,activity=0;
    const record=(actor:string,dt:string,kind:string)=>{if(actor!==caller.id && norm(actor)!==norm(caller.email) && norm(actor)!==norm(callerProfile.display_name))return;const point=points.get(dateKey(new Date(dt)));if(!point)return;point.activity++;activity++;if(["COMPLETED","VERIFIED","SUCCESS","APPROVED","HANDOFF","DONE"].includes(kind)||/(COMPLETED|VERIFIED|SUCCESS|APPROVED|HANDOFF|DONE)/.test(kind)){point.completed++;completed++;}if(["FAILED","REJECTED","INVALID","ERROR","FAILED_BLOCKED"].includes(kind)||/(FAILED|BLOCKED|REJECTED|INVALID|ERROR)/.test(kind)){point.failed++;failed++;}};
    for(const row of docs??[]){const d=(row as any).data??{};if(d.isTestData===true)continue;const dt=asText(d.createdAt??d.checkedAt??d.updatedAt??(row as any).created_at);const actor=asText(d.actorUid??d.createdByUid??d.checkedByUid??d.userId??d.ownerUid??d.createdBy??d.checkerUid);if(dt)record(actor,dt,norm(d.eventType??d.action??d.outcome??d.status).toUpperCase());}
    for(const e of events??[])record(asText((e as any).user_id),asText((e as any).created_at),norm((e as any).event_type).toUpperCase());
    const callerTeam=(TEAMS.includes(norm(callerProfile.team_key) as Team)?norm(callerProfile.team_key):"searching") as Team;
    const scoreDetails=productivityScore(callerProfile,callerTeam,docs as any[]);
    const outcomes=completed+failed;
    const score=callerTeam==="evidence"?(outcomes?Math.round(completed/outcomes*10000)/100:null):scoreDetails.score;
    let accountStatus=callerProfile.account_status;
    if(score!==null && score>=25){await db.from("mfp_team_score_warnings").update({status:"CLEARED"}).eq("user_id",caller.id).eq("team_key",asText(callerProfile.team_key)).eq("status","KEPT_ACTIVE");}
    if(score!==null && score<25 && callerProfile.role!=="ADMIN" && callerProfile.role!=="TEAM_ADMIN"){
      const team=(TEAMS.includes(norm(callerProfile.team_key) as Team)?norm(callerProfile.team_key):"searching") as Team;
      const {data:priorWarning}=await db.from("mfp_team_score_warnings").select("id,status").eq("user_id",caller.id).eq("team_key",team).in("status",["PENDING_REVIEW","KEPT_ACTIVE"]).maybeSingle();
      if(priorWarning?.status!=="PENDING_REVIEW" && priorWarning?.status!=="KEPT_ACTIVE"){
        const {error:wErr}=await db.from("mfp_team_score_warnings").insert({user_id:caller.id,team_key:team,score,status:"PENDING_REVIEW"});if(wErr)throw wErr;
        const {data:adminProfiles}=await db.from("mfp_user_profiles").select("user_id").in("role",["ADMIN","TEAM_ADMIN"]).eq("account_status","ACTIVE");
        for(const a of adminProfiles??[])await db.from("mfp_web_notifications").insert({user_id:a.user_id,title:"Low performance score requires review",message:`${asText(callerProfile.display_name)||asText(callerProfile.email)} scored ${score}% for ${team}. Review the score; account access remains active unless an administrator takes action.`,notification_type:"warning"});
      }
    }
    return json({userId:caller.id,name:asText(callerProfile.display_name)||asText(callerProfile.email),team:asText(callerProfile.team_key),score,scoreStatus:score===null?"NO_OUTCOMES":score<25?"BELOW_THRESHOLD":score<60?"NEEDS_IMPROVEMENT":"ON_TRACK",scoreDetails,accountStatus,activity,completed,failed,daily:[...points.values()],days});
  }
  if(action==="assignTeamAdmin") {
    if(!isSenior) return json({error:"Only the senior administrator can assign team administrators."},403);
    const team=asText(body.team) as Team, target=asText(body.userId);
    if(!TEAMS.includes(team)) return json({error:"Unsupported team."},400);
    const {data:priorLead}=await db.from("mfp_team_admin_assignments").select("admin_user_id,previous_role").eq("team_key",team).maybeSingle();
    if(!target){ const {error}=await db.from("mfp_team_admin_assignments").delete().eq("team_key",team); if(error) throw error; if(priorLead?.admin_user_id){const {data:stillLead}=await db.from("mfp_team_admin_assignments").select("team_key").eq("admin_user_id",priorLead.admin_user_id).limit(1);if(!stillLead?.length){await db.from("mfp_user_profiles").update({role:priorLead.previous_role==="TEAM_ADMIN"?"ADMIN":priorLead.previous_role,team_key:null,team_confirmed:true,allowed_modules:["searching","checking","reports","evidence","admin"],updated_at:new Date().toISOString()}).eq("user_id",priorLead.admin_user_id);const {data:doc}=await db.from("mfp_documents").select("id,data").eq("collection_name","users").eq("document_id",priorLead.admin_user_id).maybeSingle();if(doc?.data)await db.from("mfp_documents").update({data:{...doc.data,role:priorLead.previous_role==="TEAM_ADMIN"?"ADMIN":priorLead.previous_role,team:null,teamConfirmed:true,allowedModules:["searching","checking","reports","evidence","admin"],updatedAt:new Date().toISOString()},updated_at:new Date().toISOString()}).eq("id",doc.id);} } return json({success:true}); }
    if(target===caller.id) return json({error:"The senior administrator cannot assign themselves as a team lead."},400);
    const {data:targetProfile,error}=await db.from("mfp_user_profiles").select("user_id,role,account_status,display_name,email,allowed_modules").eq("user_id",target).maybeSingle();
    if(error) throw error; if(!targetProfile||targetProfile.account_status!=="ACTIVE"||!(targetProfile.role==="ADMIN"||targetProfile.role==="TEAM_ADMIN")) return json({error:"Choose an active account with ADMIN or TEAM_ADMIN role first."},400);
    const {data:otherAssignment}=await db.from("mfp_team_admin_assignments").select("team_key").eq("admin_user_id",target).neq("team_key",team).limit(1).maybeSingle();if(otherAssignment)return json({error:`This account already manages ${otherAssignment.team_key}. Assign a different admin to keep team permissions separate.`},400);
    const {error:saveErr}=await db.from("mfp_team_admin_assignments").upsert({team_key:team,admin_user_id:target,assigned_by:caller.id,previous_role:targetProfile.role==="TEAM_ADMIN"?"TEAM_ADMIN":"ADMIN",updated_at:new Date().toISOString()},{onConflict:"team_key"}); if(saveErr) throw saveErr;
    if(priorLead?.admin_user_id && priorLead.admin_user_id!==target){const {data:stillLead}=await db.from("mfp_team_admin_assignments").select("team_key").eq("admin_user_id",priorLead.admin_user_id).limit(1);if(!stillLead?.length){await db.from("mfp_user_profiles").update({role:priorLead.previous_role==="TEAM_ADMIN"?"ADMIN":priorLead.previous_role,team_key:null,team_confirmed:true,allowed_modules:["searching","checking","reports","evidence","admin"],updated_at:new Date().toISOString()}).eq("user_id",priorLead.admin_user_id);const {data:doc}=await db.from("mfp_documents").select("id,data").eq("collection_name","users").eq("document_id",priorLead.admin_user_id).maybeSingle();if(doc?.data)await db.from("mfp_documents").update({data:{...doc.data,role:priorLead.previous_role==="TEAM_ADMIN"?"ADMIN":priorLead.previous_role,team:null,teamConfirmed:true,allowedModules:["searching","checking","reports","evidence","admin"],updatedAt:new Date().toISOString()},updated_at:new Date().toISOString()}).eq("id",doc.id);}}
    await db.from("mfp_user_profiles").update({role:"TEAM_ADMIN",team_key:team,team_confirmed:true,allowed_modules:[team],updated_at:new Date().toISOString()}).eq("user_id",target);
    const {data:targetDoc}=await db.from("mfp_documents").select("id,data").eq("collection_name","users").eq("document_id",target).maybeSingle();if(targetDoc?.data)await db.from("mfp_documents").update({data:{...targetDoc.data,role:"TEAM_ADMIN",team,teamConfirmed:true,allowedModules:[team],updatedAt:new Date().toISOString()},updated_at:new Date().toISOString()}).eq("id",targetDoc.id);
    return json({success:true});
  }
  if(action==="reviewLowScore") {
    requireManager(); const warningId=asText(body.warningId), decision=asText(body.decision);
    if(!warningId||!(["keep","remove"] as string[]).includes(decision)) return json({error:"Invalid warning review."},400);
    const {data:warning,error:wErr}=await db.from("mfp_team_score_warnings").select("id,user_id,team_key,status").eq("id",warningId).maybeSingle(); if(wErr) throw wErr;
    if(!warning) return json({error:"Warning not found."},404);
    if(!isSenior && !myTeams.includes(warning.team_key as Team)) return json({error:"You cannot review this team's warning."},403);
    const {data:target,error:tErr}=await db.from("mfp_user_profiles").select("user_id,team_key,account_status,display_name,email").eq("user_id",warning.user_id).maybeSingle(); if(tErr) throw tErr;
    if(!target) return json({error:"Member profile not found."},404);
    const status=decision==="remove"?"DISABLED":"ACTIVE";
    const {error:profileUpdate}=await db.from("mfp_user_profiles").update({account_status:status,...(decision==="remove"?{team_key:null,team_confirmed:false,allowed_modules:[]}:{}),updated_at:new Date().toISOString()}).eq("user_id",warning.user_id); if(profileUpdate) throw profileUpdate;
    const {data:userDoc}=await db.from("mfp_documents").select("id,data").eq("collection_name","users").eq("document_id",warning.user_id).maybeSingle(); if(userDoc?.data){await db.from("mfp_documents").update({data:{...userDoc.data,accountStatus:status,...(decision==="remove"?{team:null,teamConfirmed:false,allowedModules:[]}:{}),updatedAt:new Date().toISOString()},updated_at:new Date().toISOString()}).eq("id",userDoc.id);}
    if(decision==="remove") { await db.from("mfp_evidence_app_registrations").update({status:"REVOKED",activation_status:"INACTIVE",team_authorized:false,revoked_at:new Date().toISOString()}).eq("user_id",warning.user_id).eq("application_id","MF_EVIDENCE"); }
    const {error:reviewErr}=await db.from("mfp_team_score_warnings").update({status:decision==="remove"?"DISABLED":"KEPT_ACTIVE",reviewed_by:caller.id,reviewed_at:new Date().toISOString()}).eq("id",warningId); if(reviewErr) throw reviewErr;
    await db.from("mfp_web_notifications").insert({user_id:warning.user_id,title:decision==="remove"?"Account access disabled":"Account retained after review",message:decision==="remove"?"A team administrator disabled your account after a low-score review.":"A team administrator reviewed your low score and kept your account active.",notification_type:decision==="remove"?"warning":"info"});
    return json({success:true});
  }
  if(action!=="getAnalytics") return json({error:"Unsupported action"},400);
  if(!isSenior&&!myTeams.length) return json({error:"Analytics access is restricted to team administrators."},403);
  const days=Number(body.days)===14?14:7, start=new Date(Date.now()-(days-1)*86400000); start.setUTCHours(0,0,0,0);
  const {data:profiles,error:pErr}=await db.from("mfp_user_profiles").select("user_id,email,display_name,role,account_status,team_key,allowed_modules").order("display_name").limit(2000); if(pErr) throw pErr;
  // Include 14 days for cadence/turnaround scoring even when the chart shows only 7 days.
  const scoreStart=new Date(Math.min(start.getTime(),Date.now()-14*86400000));
  const {data:docs,error:dErr}=await db.from("mfp_documents").select("collection_name,document_id,data,owner_uid,team_key,created_at").in("collection_name",["workflowEvents","profiles","posts","checkingRecords","reportJobs","reportPackages"]).gte("created_at",scoreStart.toISOString()).limit(20000); if(dErr) throw dErr;
  const {data:evidenceEvents,error:eErr}=await db.from("mfp_evidence_activity_events").select("user_id,event_type,created_at,metadata").gte("created_at",start.toISOString()).limit(10000); if(eErr) throw eErr;
  const scopedProfiles=(profiles??[]).filter((p:any)=>{
    if(p.role==="ADMIN"||p.role==="TEAM_ADMIN") return false;
    const team=norm(p.team_key) as Team;
    if(TEAMS.includes(team)) return isSenior||myTeams.includes(team);
    const modules=(p.allowed_modules??[]).map(norm); return TEAMS.some(t=>modules.includes(t)&&(isSenior||myTeams.includes(t)));
  });
  const daysList=Array.from({length:days},(_,i)=>dateKey(new Date(start.getTime()+i*86400000)));
  const members:any[]=[];
  for(const p of scopedProfiles){
    const team=(TEAMS.includes(norm(p.team_key) as Team)?norm(p.team_key):((p.allowed_modules??[]).map(norm).find((t:string)=>TEAMS.includes(t as Team))||"searching")) as Team;
    const points=new Map(daysList.map(d=>[d,{date:d,completed:0,failed:0,activity:0}])); let completed=0,failed=0,activity=0;
    const record=(uid:string,dt:string,kind:string)=>{ if(uid!==p.user_id && norm(uid)!==norm(p.email) && norm(uid)!==norm(p.display_name)) return; const day=dateKey(new Date(dt)); const point=points.get(day); if(!point) return; point.activity++; activity++; if(["COMPLETED","VERIFIED","SUCCESS","APPROVED","HANDOFF","DONE"].includes(kind)||/(COMPLETED|VERIFIED|SUCCESS|APPROVED|HANDOFF|DONE)/.test(kind)){point.completed++;completed++;} if(["FAILED","REJECTED","INVALID","ERROR","FAILED_BLOCKED"].includes(kind)||/(FAILED|BLOCKED|REJECTED|INVALID|ERROR)/.test(kind)){point.failed++;failed++;} };
    for(const row of docs??[]){ const data=(row as any).data??{}; if(data.isTestData===true) continue; const dt=asText(data.createdAt??data.checkedAt??data.updatedAt??(row as any).created_at); const actor=asText(data.actorUid??data.createdByUid??data.checkedByUid??data.userId??data.ownerUid??data.createdBy??data.checkerUid); const kind=norm(data.eventType??data.action??data.outcome??data.status).toUpperCase(); if(dt) record(actor,dt,kind); }
    for(const e of evidenceEvents??[]) record(asText((e as any).user_id),asText((e as any).created_at),norm((e as any).event_type).toUpperCase());
    const scoreDetails=productivityScore(p,team,docs as any[]);
    const outcomes=completed+failed;
    const score=team==="evidence"?(outcomes?Math.round(completed/outcomes*10000)/100:null):scoreDetails.score;
    members.push({userId:p.user_id,name:asText(p.display_name)||asText(p.email).split("@")[0]||"Member",email:asText(p.email),team,score,scoreDetails,status:asText(p.account_status),assigned:activity,completed,failed,activity,daily:[...points.values()],lowScorePending:score!==null&&score<25&&p.account_status!=="DISABLED"});
  }
  // Clear a previous keep-active decision after a verified score recovers to 25% or higher.
  for(const m of members.filter(x=>x.score!==null&&x.score>=25)){await db.from("mfp_team_score_warnings").update({status:"CLEARED"}).eq("user_id",m.userId).eq("team_key",m.team).eq("status","KEPT_ACTIVE");}
  // Low scores create a review warning only. Account status is never changed automatically.
  for(const m of members.filter(x=>x.lowScorePending)){
    const {data:existing}=await db.from("mfp_team_score_warnings").select("id,status").eq("user_id",m.userId).eq("team_key",m.team).in("status",["PENDING_REVIEW","KEPT_ACTIVE"]).maybeSingle();
    if(existing?.status==="PENDING_REVIEW" || existing?.status==="KEPT_ACTIVE") continue;
    const {data:warning,error:wErr}=await db.from("mfp_team_score_warnings").insert({user_id:m.userId,team_key:m.team,score:m.score,status:"PENDING_REVIEW"}).select("id,user_id,team_key,score,status,created_at").single(); if(wErr&& !String(wErr.message).includes("duplicate")) throw wErr;
    if(warning){
      const recipientIds=[...new Set([...teamAssignments.filter(a=>a.team_key===m.team).map(a=>a.admin_user_id),...((profiles??[]).filter((p:any)=>(p.role==="ADMIN"||p.role==="TEAM_ADMIN")&&p.account_status==="ACTIVE").map((p:any)=>p.user_id))])];
      for(const recipient of recipientIds) await db.from("mfp_web_notifications").insert({user_id:recipient,title:"Low performance score requires review",message:`${m.name} (${m.team}) scored ${m.score}%, below the 25% threshold. Account remains active; review and decide manually in Team Analytics.`,notification_type:"warning"});
    }
  }
  const warningQuery=await db.from("mfp_team_score_warnings").select("id,user_id,team_key,score,status,created_at").eq("status","PENDING_REVIEW").order("created_at",{ascending:false}).limit(200); if(warningQuery.error) throw warningQuery.error;
  const warnings=(warningQuery.data??[]).filter((w:any)=>isSenior||myTeams.includes(w.team_key)).map((w:any)=>({id:w.id,userId:w.user_id,team:w.team_key,score:Number(w.score),status:w.status,createdAt:w.created_at,name:scopedProfiles.find((p:any)=>p.user_id===w.user_id)?.display_name||scopedProfiles.find((p:any)=>p.user_id===w.user_id)?.email||"Member"}));
  const admins=(profiles??[]).filter((p:any)=>(p.role==="ADMIN"||p.role==="TEAM_ADMIN")&&p.account_status==="ACTIVE").map((p:any)=>({userId:p.user_id,name:asText(p.display_name)||asText(p.email),email:asText(p.email)}));
  const teams=TEAMS.filter(t=>isSenior||myTeams.includes(t)).map(team=>{const list=members.filter(m=>m.team===team),vals=list.map(m=>m.score).filter((x:any)=>x!==null);return {team,adminName:admins.find(a=>teamAssignments.some(x=>x.team_key===team&&x.admin_user_id===a.userId))?.name??null,members:list.length,activity:list.reduce((n,m)=>n+m.activity,0),score:vals.length?Math.round(vals.reduce((n,v)=>n+v,0)/vals.length*100)/100:null,adminScore:vals.length?Math.round(vals.reduce((n,v)=>n+v,0)/vals.length*100)/100:null,daily:daysList.map(date=>{const dayMembers=list.map(m=>m.daily.find((x:any)=>x.date===date)).filter(Boolean);const outcomes=dayMembers.reduce((n:any,x:any)=>n+x.completed+x.failed,0),done=dayMembers.reduce((n:any,x:any)=>n+x.completed,0);return {date,score:outcomes?Math.round(done/outcomes*10000)/100:null,activity:dayMembers.reduce((n:any,x:any)=>n+x.activity,0)}})}});
  for(const team of teams){const recent=team.daily.slice(-3);if(recent.length===3&&recent.every((x:any)=>x.score!==null)&&recent[0].score>recent[1].score&&recent[1].score>recent[2].score){const today=dateKey(new Date());const {data:priorAlert}=await db.from("mfp_team_trend_alerts").select("id").eq("team_key",team.team).eq("alert_date",today).maybeSingle();if(!priorAlert){const {error:alertErr}=await db.from("mfp_team_trend_alerts").insert({team_key:team.team,alert_date:today,recent_scores:recent.map((x:any)=>({date:x.date,score:x.score}))});if(!alertErr){const recipients=[...new Set([...teamAssignments.filter(a=>a.team_key===team.team).map(a=>a.admin_user_id),...((profiles??[]).filter((p:any)=>p.role==="ADMIN"&&p.account_status==="ACTIVE").map((p:any)=>p.user_id))])];for(const recipient of recipients)await db.from("mfp_web_notifications").insert({user_id:recipient,title:"Team performance is declining",message:`${team.team} team score declined for three consecutive days (${recent.map((x:any)=>`${x.date}: ${x.score}%`).join(" → ")}). Please review workload and member performance.`,notification_type:"warning"});}}}}
  const trendQuery=await db.from("mfp_team_trend_alerts").select("team_key,alert_date,recent_scores,created_at").gte("alert_date",dateKey(new Date(Date.now()-30*86400000))).order("created_at",{ascending:false}).limit(50);if(trendQuery.error)throw trendQuery.error;
  const trendWarnings=(trendQuery.data??[]).filter((a:any)=>isSenior||myTeams.includes(a.team_key)).map((a:any)=>({team:a.team_key,createdAt:a.created_at,scores:a.recent_scores}));
  return json({isSeniorAdmin:isSenior,managedTeams:teams.map(x=>x.team),teams,members,warnings,trendWarnings,admins});
 } catch(error) { const message=error instanceof Error?error.message:"Unexpected analytics error"; console.error("mfp-team-analytics",message); return json({error:message},500); }
});
