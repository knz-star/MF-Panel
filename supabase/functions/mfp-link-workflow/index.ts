import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS","Content-Type":"application/json"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:cors});
const clean=(v:unknown)=>typeof v==="string"?v.trim():"";
const normalize=(v:string)=>{try{const u=new URL(v);u.hash="";u.hostname=u.hostname.toLowerCase().replace(/^www\./,"");u.pathname=u.pathname.replace(/\/+$/,'')||'/';return u.toString().replace(/\/$/,'').toLowerCase();}catch{return v.trim().replace(/#.*$/,'').replace(/^https:\/\/www\./i,'https://').replace(/^http:\/\/www\./i,'http://').replace(/\/+$/,'').toLowerCase();}};
const platformOf=(row:any)=>clean(row?.data?.platform)||"Other";
Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors}); if(req.method!=="POST")return json({error:"Method not allowed"},405);
 try{
  const url=Deno.env.get("SUPABASE_URL"), anon=Deno.env.get("SUPABASE_ANON_KEY")??Deno.env.get("SUPABASE_PUBLISHABLE_KEY"), secret=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if(!url||!anon||!secret)return json({error:"Function environment is incomplete"},500);
  const authHeader=req.headers.get("Authorization")??"",token=authHeader.replace(/^Bearer\s+/i,""); if(!token||token===authHeader)return json({error:"Authentication required"},401);
  const authClient=createClient(url,anon,{global:{headers:{Authorization:`Bearer ${token}`}},auth:{persistSession:false,autoRefreshToken:false}});
  const {data:auth,error:authError}=await authClient.auth.getUser(token); if(authError||!auth.user)return json({error:"Invalid or expired session"},401);
  const user=auth.user, db=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:profile,error:profileError}=await db.from("mfp_user_profiles").select("user_id,email,role,account_status,team_key,team_confirmed,allowed_modules,display_name").eq("user_id",user.id).maybeSingle();
  if(profileError)throw profileError; if(!profile||profile.account_status!=="ACTIVE")return json({error:"Active MF MPanel account required"},403);
  const admin=profile.role==="ADMIN";
  const body=await req.json().catch(()=>({})); const action=clean(body.action);
  const can=(team:string)=>admin||(profile.team_confirmed===true&&(profile.team_key===team||(Array.isArray(profile.allowed_modules)&&profile.allowed_modules.includes(team))));
  const requireTeam=(team:string)=>can(team);
  const getProfiles=async()=>{const all:any[]=[];for(let offset=0;;offset+=1000){const {data,error}=await db.from("mfp_documents").select("document_id,data,created_at,updated_at").eq("collection_name","profiles").order("created_at",{ascending:true}).range(offset,offset+999);if(error)throw error;all.push(...(data??[]));if((data?.length??0)<1000)break;}return all;};
  if(action==="summary"){
   if(!requireTeam("evidence")&&!requireTeam("reports")&&!requireTeam("searching"))return json({error:"Link assignment access is required"},403);
   const {data:counts,error}=await db.rpc("mfp_available_link_counts");if(error)throw error;
   const {data:totalCount,error:totalError}=await db.rpc("mfp_available_link_total");if(totalError)throw totalError;
   const total=Number(totalCount??0);
   const {count:pending,error:pendingError}=await db.from("mfp_link_assignments").select("id",{count:"exact",head:true}).eq("status","PENDING");if(pendingError)throw pendingError;
   return json({platformCounts:counts??[],availableTotal:total,systemPending:pending??0});
  }
  if(action==="assign-links"){
   if(!requireTeam("evidence")&&!requireTeam("reports")&&!requireTeam("searching"))return json({error:"Link assignment access is required"},403);
   const count=Math.floor(Number(body.count)); if(!Number.isFinite(count)||count<1||count>2000)return json({error:"Choose between 1 and 2000 links"},400);
   const raw=Array.isArray(body.platforms)?body.platforms.map((x:any)=>clean(x)).filter(Boolean):[]; const platforms=raw.includes("ALL")?[]:raw;
   const {data:claimed,error}=await db.rpc("mfp_claim_link_batch",{p_user_id:user.id,p_platforms:platforms,p_limit:count}); if(error)throw error;
   if(!claimed?.length)return json({error:"No available links match your selected platform(s). Refresh counts or select All platforms.",assigned:[]},409);
   const profileIds=[...new Set((claimed??[]).map((r:any)=>r.profile_id).filter(Boolean))];
   const profileData=new Map<string,any>();
   for(let offset=0;offset<profileIds.length;offset+=500){const chunk=profileIds.slice(offset,offset+500);const {data:docs,error:docsError}=await db.from("mfp_documents").select("document_id,data").eq("collection_name","profiles").in("document_id",chunk);if(docsError){console.error("Profile metadata lookup failed after link reservation; falling back to internal IDs",docsError);break;}for(const row of docs??[])profileData.set(row.document_id,row.data??{});}
   const batchId=`BATCH-${Date.now()}-${crypto.randomUUID().slice(0,4).toUpperCase()}`;
   const createdAt=new Date().toISOString();
   const batchName=clean(body.batchName)||`MF MPanel Link Assignment ${createdAt.slice(0,10)}`;
   const assigned=(claimed??[]).map((r:any,index:number)=>{const d=profileData.get(r.profile_id)??{};return {id:r.assignment_id,profileId:clean(d.profileHandle)||clean(d.handle)||clean(d.username)||clean(d.accountHandle)||clean(d.socialHandle)||clean(d.profileUsername)||clean(d.mfpProfileId)||clean(d.profileId)||r.profile_id,mfpProfileId:clean(d.mfpProfileId)||null,sourceProfileId:r.profile_id,linkId:`A${String(index+1).padStart(2,"0")}`,url:r.canonical_url,platform:r.platform,requiredScreenshots:1,notes:"",assignedAt:r.assigned_at};});
   const links=assigned.map((item:any)=>({linkId:item.linkId,url:item.url,platform:item.platform,profileId:item.profileId,mfpProfileId:item.mfpProfileId,sourceProfileId:item.sourceProfileId,requiredScreenshots:item.requiredScreenshots,notes:item.notes}));
   return json({assigned,count:claimed.length,downloadText:claimed.map((r:any)=>r.canonical_url).join("\n"),requested:count,batchId,batchName,createdAt,createdBy:user.email??user.id,links});
  }
  if(action==="match-zip"){
   // ZIP report analysis is an organization-wide admin operation. Do not let a
   // regular team member inspect or reconcile another user's assigned links.
   if(!admin)return json({error:"Administrator access required for report ZIP matching"},403);
   const urls=Array.isArray(body.urls)?body.urls.map((x:any)=>normalize(clean(x))).filter(Boolean):[]; if(urls.length>50000)return json({error:"ZIP contains too many URLs for one matching request"},413);
   const unique=[...new Set(urls)]; const jobId=clean(body.reportJobId)||`ZIP-${Date.now()}`;
   const assigned:any[]=[];
   for(let offset=0;offset<unique.length;offset+=500){const chunk=unique.slice(offset,offset+500);if(!chunk.length)continue;const {data:part,error}=await db.from("mfp_link_assignments").select("id,source_profile_id,assigned_to,canonical_url,platform,status").eq("status","PENDING").in("canonical_url",chunk);if(error)throw error;assigned.push(...(part??[]));}
   const matches=assigned;
   const matchedProfileIds=[...new Set(matches.map((a:any)=>a.source_profile_id).filter(Boolean))];
   const matchedProfileData=new Map<string,any>();
   for(let offset=0;offset<matchedProfileIds.length;offset+=500){const chunk=matchedProfileIds.slice(offset,offset+500);const {data:docs,error:docsError}=await db.from("mfp_documents").select("document_id,data").eq("collection_name","profiles").in("document_id",chunk);if(docsError)throw docsError;for(const row of docs??[])matchedProfileData.set(row.document_id,row.data??{});}
   for(const a of matches){
    const {error:receiptError}=await db.from("mfp_link_upload_receipts").upsert({assignment_id:a.id,uploaded_by:user.id,report_job_id:jobId,matched_url:a.canonical_url},{onConflict:"assignment_id,report_job_id"});if(receiptError)throw receiptError;
   }
   if(matches.length){for(let offset=0;offset<matches.length;offset+=500){const ids=matches.slice(offset,offset+500).map((a:any)=>a.id);const {error:updateError}=await db.from("mfp_link_assignments").update({status:"RECEIVED",received_at:new Date().toISOString(),report_job_id:jobId}).in("id",ids).eq("status","PENDING");if(updateError)throw updateError;}}
   const matchedSet=new Set(matches.map((a:any)=>a.canonical_url));
   return json({jobId,inputUniqueCount:unique.length,matchedCount:matches.length,matched:matches.map((a:any)=>({profileId:a.source_profile_id,mfpProfileId:clean(matchedProfileData.get(a.source_profile_id)?.mfpProfileId)||null,profileHandle:clean(matchedProfileData.get(a.source_profile_id)?.profileHandle)||clean(matchedProfileData.get(a.source_profile_id)?.handle)||clean(matchedProfileData.get(a.source_profile_id)?.username)||null,assignedTo:a.assigned_to,url:a.canonical_url,platform:a.platform,assignmentId:a.id})),unmatchedCount:unique.filter(u=>!matchedSet.has(u)).length,matchedUrls:[...matchedSet]});
  }
  if(action==="checker-next"){
   if(!requireTeam("checking"))return json({error:"Checking team access is required"},403);
   let {data:assigned,error}=await db.from("mfp_checking_assignments").select("id,profile_id,batch_id,assigned_at,status,opened_at").eq("checker_id",user.id).in("status",["ASSIGNED","OPEN","REOPEN","RECHECK"]).order("assigned_at",{ascending:true}).limit(10);if(error)throw error;
   if(!assigned?.length){const {error:claimError}=await db.rpc("mfp_claim_checking_batch",{p_checker_id:user.id});if(claimError)throw claimError;const q=await db.from("mfp_checking_assignments").select("id,profile_id,batch_id,assigned_at,status,opened_at").eq("checker_id",user.id).in("status",["ASSIGNED","OPEN","REOPEN","RECHECK"]).order("assigned_at",{ascending:true}).limit(10);if(q.error)throw q.error;assigned=q.data??[];}
   const current=assigned?.[0];if(!current)return json({item:null,remainingInPrivateBatch:0});
   const {data:doc,error:docError}=await db.from("mfp_documents").select("document_id,data").eq("collection_name","profiles").eq("document_id",current.profile_id).maybeSingle();if(docError)throw docError;
   if(current.status==="ASSIGNED"){await db.from("mfp_checking_assignments").update({status:"OPEN",opened_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",current.id);}
   const d=doc?.data??{};
   return json({item:{assignmentId:current.id,profileId:current.profile_id,url:d.canonicalUrl??d.originalUrl??"",platform:d.platform??"Other",status:current.status==="ASSIGNED"?"OPEN":current.status,postUrls:Array.isArray(d.postUrls)?d.postUrls:[],assignedAt:current.assigned_at},remainingInPrivateBatch:Math.max(0,(assigned?.length??1)-1)});
  }
  if(action==="checker-submit"){
   if(!requireTeam("checking"))return json({error:"Checking team access is required"},403);
   const assignmentId=clean(body.assignmentId),outcome=clean(body.outcome).toUpperCase(),notes=clean(body.notes);const allowed=["OPEN","REOPEN","RECHECK","BLOCKED","INVALID","VERIFIED"];
   if(!assignmentId||!allowed.includes(outcome))return json({error:"Invalid checking action"},400);
   const {data:assignment,error:aError}=await db.from("mfp_checking_assignments").select("id,profile_id,status").eq("id",assignmentId).eq("checker_id",user.id).maybeSingle();if(aError)throw aError;if(!assignment)return json({error:"This link is not assigned to your account"},403);
   const postUrls=Array.isArray(body.postUrls)?body.postUrls.map((x:any)=>clean(x)).filter(Boolean).slice(0,3):[];
   if(outcome==="VERIFIED"&&postUrls.length>0&&postUrls.length!==3)return json({error:"Enter all three post URLs, or leave all three empty."},400);
   if(["BLOCKED","INVALID"].includes(outcome)&&!notes)return json({error:"Please add a short note for Blocked or Invalid."},400);
   const terminal=["BLOCKED","INVALID","VERIFIED"].includes(outcome);const now=new Date().toISOString();
   const {error:updateError}=await db.from("mfp_checking_assignments").update({status:outcome,outcome_notes:notes,post_urls:postUrls,completed_at:terminal?now:null,updated_at:now}).eq("id",assignmentId).eq("checker_id",user.id);if(updateError)throw updateError;
   const {data:profileDoc,error:pError}=await db.from("mfp_documents").select("id,data,owner_uid,team_key,created_at").eq("collection_name","profiles").eq("document_id",assignment.profile_id).maybeSingle();if(pError)throw pError;
   if(profileDoc){const nextStatus=outcome==="VERIFIED"?"VERIFIED":outcome==="BLOCKED"?"BLOCKED":outcome==="INVALID"?"INVALID":outcome;const nextData={...(profileDoc.data??{}),currentWorkflowStatus:nextStatus,checkedAt:now,checkedByUid:user.id,checkingOutcome:outcome,checkingNotes:notes,postUrls};const {error:profileUpdateError}=await db.from("mfp_documents").update({data:nextData,updated_at:now}).eq("collection_name","profiles").eq("document_id",assignment.profile_id);if(profileUpdateError)throw profileUpdateError;
    const recordId=`CHK-${Date.now()}-${crypto.randomUUID().slice(0,6).toUpperCase()}`;const {error:recordError}=await db.from("mfp_documents").upsert({collection_name:"checkingRecords",document_id:recordId,data:{checkingRecordId:recordId,profileId:assignment.profile_id,outcome,checkedBy:user.id,checkedByEmail:user.email??"",checkedAt:now,notes,postUrls,postCount:postUrls.length},owner_uid:user.id,team_key:"checking",created_at:now,updated_at:now},{onConflict:"collection_name,document_id"});if(recordError)throw recordError;
   }
   return json({success:true,terminal,completedAt:terminal?now:null});
  }
  if(action==="admin-checking-results"){
   if(!admin)return json({error:"Administrator access required"},403);
   const {data:rows,error}=await db.from("mfp_checking_assignments").select("id,profile_id,checker_id,batch_id,assigned_at,status,outcome_notes,post_urls,completed_at,updated_at").order("updated_at",{ascending:false}).limit(500);if(error)throw error;
   const ids=[...new Set((rows??[]).map((r:any)=>r.profile_id))];const {data:docs,error:docsError}=ids.length?await db.from("mfp_documents").select("document_id,data").eq("collection_name","profiles").in("document_id",ids):{data:[],error:null};if(docsError)throw docsError;const map=new Map((docs??[]).map((d:any)=>[d.document_id,d.data]));
   return json({items:(rows??[]).map((r:any)=>({ ...r, url:map.get(r.profile_id)?.canonicalUrl??map.get(r.profile_id)?.originalUrl??"",platform:map.get(r.profile_id)?.platform??"Other"}))});
  }
  return json({error:"Unknown action"},400);
 }catch(error){console.error("mfp-link-workflow",error);return json({error:error instanceof Error?error.message:"Unexpected server error"},500);}
});
