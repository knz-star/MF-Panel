import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
const headers={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"content-type, x-mfp-cron-secret","Access-Control-Allow-Methods":"POST, OPTIONS","Content-Type":"application/json"};
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers});
const norm=(v:unknown)=>typeof v==="string"?v.trim().toLowerCase():"";
const text=(v:unknown)=>typeof v==="string"?v:"";
const TEAMS=new Set(["searching","checking","evidence"]);
const dateKey=(d:Date)=>d.toISOString().slice(0,10);
Deno.serve(async(req)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers});if(req.method!=="POST")return reply({error:"POST required"},405);
 try{
  const expected=Deno.env.get("MFP_SCORE_CRON_SECRET"),url=Deno.env.get("SUPABASE_URL"),service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if(!expected||!url||!service)return reply({error:"Scheduler secrets are not configured"},500);
  if(req.headers.get("x-mfp-cron-secret")!==expected)return reply({error:"Unauthorized scheduler request"},401);
  const db=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}}),now=new Date(),start=new Date(now.getTime()-7*86400000).toISOString();
  const {data:profiles,error:pErr}=await db.from("mfp_user_profiles").select("user_id,email,display_name,role,account_status,team_key").eq("account_status","ACTIVE").in("team_key",["searching","checking","evidence"]);if(pErr)throw pErr;
  const {data:docs,error:dErr}=await db.from("mfp_documents").select("data,created_at,collection_name").in("collection_name",["workflowEvents","profiles","posts","checkingRecords","reportJobs","reportPackages"]).gte("created_at",start).limit(50000);if(dErr)throw dErr;
  const {data:events,error:eErr}=await db.from("mfp_evidence_activity_events").select("user_id,event_type,created_at").gte("created_at",start).limit(20000);if(eErr&&!String(eErr.message).includes("does not exist"))throw eErr;
  const {data:admins,error:adminError}=await db.from("mfp_user_profiles").select("user_id,role,account_status").in("role",["ADMIN","TEAM_ADMIN"]).eq("account_status","ACTIVE");if(adminError)throw adminError;
  const {data:trendProfiles,error:trendProfileError}=await db.from("mfp_user_profiles").select("user_id,email,display_name,role,account_status,team_key").in("team_key",["searching","checking","evidence"]);if(trendProfileError)throw trendProfileError;
  const results=[];
  for(const profile of profiles??[]){if(profile.role==="ADMIN"||profile.role==="TEAM_ADMIN"||!TEAMS.has(norm(profile.team_key)))continue;
   let completed=0,failed=0;const identities=new Set([norm(profile.user_id),norm(profile.email),norm(profile.display_name)].filter(Boolean));
   for(const row of docs??[]){const d=(row as any).data??{};if(d.isTestData===true)continue;const actor=norm(d.actorUid??d.createdByUid??d.checkedByUid??d.userId??d.ownerUid??d.createdBy??d.checkerUid);if(!identities.has(actor))continue;const kind=norm(d.eventType??d.action??d.outcome??d.status).toUpperCase();if(["COMPLETED","VERIFIED","SUCCESS","APPROVED","HANDOFF","DONE"].includes(kind)||/(COMPLETED|VERIFIED|SUCCESS|APPROVED|HANDOFF|DONE)/.test(kind))completed++;if(["FAILED","REJECTED","INVALID","ERROR","FAILED_BLOCKED"].includes(kind)||/(FAILED|BLOCKED|REJECTED|INVALID|ERROR)/.test(kind))failed++;}
   for(const ev of events??[]){if(norm((ev as any).user_id)!==norm(profile.user_id))continue;const kind=norm((ev as any).event_type).toUpperCase();if(["COMPLETED","VERIFIED","SUCCESS","APPROVED","HANDOFF","DONE"].includes(kind)||/(COMPLETED|VERIFIED|SUCCESS|APPROVED|HANDOFF|DONE)/.test(kind))completed++;if(["FAILED","REJECTED","INVALID","ERROR","FAILED_BLOCKED"].includes(kind)||/(FAILED|BLOCKED|REJECTED|INVALID|ERROR)/.test(kind))failed++;}
   const total=completed+failed;if(!total)continue;const score=Math.round(completed/total*10000)/100;const team=norm(profile.team_key);
   if(score>=25){await db.from("mfp_team_score_warnings").update({status:"CLEARED"}).eq("user_id",profile.user_id).eq("team_key",team).eq("status","KEPT_ACTIVE");results.push({userId:profile.user_id,score,action:"NO_DISABLE"});continue;}
   const {data:prior,error:wRead}=await db.from("mfp_team_score_warnings").select("id,status").eq("user_id",profile.user_id).eq("team_key",team).in("status",["PENDING_REVIEW","KEPT_ACTIVE"]).maybeSingle();if(wRead)throw wRead;
   if(prior?.status==="KEPT_ACTIVE"){results.push({userId:profile.user_id,score,action:"ADMIN_KEPT_ACTIVE"});continue;}
   if(!prior){const {error:wErr}=await db.from("mfp_team_score_warnings").insert({user_id:profile.user_id,team_key:team,score,status:"PENDING_REVIEW"});if(wErr&&String(wErr.code)!=="23505")throw wErr;}
   const {error:updateError}=await db.from("mfp_user_profiles").update({account_status:"DISABLED",updated_at:now.toISOString()}).eq("user_id",profile.user_id);if(updateError)throw updateError;
   const {data:userDoc}=await db.from("mfp_documents").select("id,data").eq("collection_name","users").eq("document_id",profile.user_id).maybeSingle();if(userDoc?.data){const {error:uErr}=await db.from("mfp_documents").update({data:{...userDoc.data,accountStatus:"DISABLED",updatedAt:now.toISOString()},updated_at:now.toISOString()}).eq("id",userDoc.id);if(uErr)throw uErr;}
   for(const admin of admins??[]){await db.from("mfp_web_notifications").insert({user_id:admin.user_id,title:"Low performance score requires review",message:`${profile.display_name||profile.email||profile.user_id} scored ${score}% for ${team}; account access was disabled pending review.`,notification_type:"warning"}).then(({error})=>{if(error)console.warn("Could not add admin notification",error.message);});}
   results.push({userId:profile.user_id,score,action:"DISABLED_PENDING_REVIEW"});
  }
  // Evaluate the last three complete UTC calendar days and notify assigned team admins when the score declines each day.
  const dayKeys=[-3,-2,-1].map(offset=>dateKey(new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate()+offset))));
  const identityToTeam=new Map<string,string>();for(const p of trendProfiles??[]){if(p.role==="ADMIN"||p.role==="TEAM_ADMIN")continue;for(const value of [p.user_id,p.email,p.display_name])if(norm(value))identityToTeam.set(norm(value),norm(p.team_key));}
  const daily=new Map<string,{completed:number;failed:number}>();const addDaily=(team:string,dt:string,kind:string)=>{if(!TEAMS.has(team)||!dt)return;const day=dateKey(new Date(dt));if(!dayKeys.includes(day))return;const key=`${team}|${day}`;const v=daily.get(key)??{completed:0,failed:0};if(/(COMPLETED|VERIFIED|SUCCESS|APPROVED|HANDOFF|DONE)/.test(kind))v.completed++;if(/(FAILED|BLOCKED|REJECTED|INVALID|ERROR)/.test(kind))v.failed++;daily.set(key,v);};
  for(const row of docs??[]){const d=(row as any).data??{};if(d.isTestData===true)continue;const actor=norm(d.actorUid??d.createdByUid??d.checkedByUid??d.userId??d.ownerUid??d.createdBy??d.checkerUid),team=identityToTeam.get(actor);if(team)addDaily(team,text(d.createdAt??d.checkedAt??d.updatedAt??(row as any).created_at),norm(d.eventType??d.action??d.outcome??d.status).toUpperCase());}
  for(const ev of events??[]){const team=identityToTeam.get(norm((ev as any).user_id));if(team)addDaily(team,text((ev as any).created_at),norm((ev as any).event_type).toUpperCase());}
  const {data:assignments,error:assignError}=await db.from("mfp_team_admin_assignments").select("team_key,admin_user_id");if(assignError)throw assignError;
  for(const team of TEAMS){const recent=dayKeys.map(day=>{const v=daily.get(`${team}|${day}`);const total=(v?.completed??0)+(v?.failed??0);return{date:day,score:total?Math.round((v!.completed/total)*10000)/100:null};});if(recent.length!==3||recent.some(x=>x.score===null)||!(recent[0].score!>recent[1].score!&&recent[1].score!>recent[2].score!))continue;
   const today=dateKey(now);const {data:priorAlert,error:alertRead}=await db.from("mfp_team_trend_alerts").select("id").eq("team_key",team).eq("alert_date",today).maybeSingle();if(alertRead)throw alertRead;if(priorAlert)continue;
   const {error:insertAlert}=await db.from("mfp_team_trend_alerts").insert({team_key:team,alert_date:today,recent_scores:recent});if(insertAlert&&String(insertAlert.code)!=="23505")throw insertAlert;
   const recipients=[...new Set([...(assignments??[]).filter((a:any)=>a.team_key===team).map((a:any)=>a.admin_user_id),...(admins??[]).map((a:any)=>a.user_id)])];for(const recipient of recipients){await db.from("mfp_web_notifications").insert({user_id:recipient,title:"Team performance is declining",message:`${team} team score declined for three consecutive days (${recent.map(x=>`${x.date}: ${x.score}%`).join(" → ")}). Please review team performance.`,notification_type:"warning"}).then(({error})=>{if(error)console.warn("Could not add trend notification",error.message);});}results.push({team,action:"TEAM_TREND_ALERT",scores:recent});
  }
  return reply({success:true,evaluated:results.filter((x:any)=>x.userId).length,trendAlerts:results.filter((x:any)=>x.team).length,results,checkedAt:now.toISOString()});
 }catch(error){console.error("mfp-score-scheduler",error);return reply({error:error instanceof Error?error.message:"Score scheduler failed"},500);}
});
