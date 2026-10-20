import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
const headers={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS","Content-Type":"application/json"};
const reply=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers});
const txt=(v:unknown)=>typeof v==="string"?v.trim():"";
const iso=()=>new Date().toISOString();
const safeId=(prefix:string)=>`${prefix}-${new Date().toISOString().slice(0,10).replaceAll("-","")}-${crypto.randomUUID().slice(0,10).toUpperCase()}`;
const workflowCollections=["profiles","posts","checkingRecords","workflowEvents","adminReviewItems","evidenceAssignments","reportJobs","reportPackages","evidenceTasks"];
const systemResetTables:[string,string][]=[
 ["evidence_items","id"],["evidence_screenshots","id"],["evidence_exports","id"],["evidence_workflow_events","id"],
 ["mfp_evidence_activity_events","id"],["mfp_evidence_score_snapshots","id"],["mfp_evidence_work_items","id"],
 ["mfp_evidence_connection_events","id"],["mfp_evidence_pairing_requests","id"],["mfp_evidence_pairing_attempt_limits","email_hash"],
 ["mfp_evidence_app_registrations","id"],["mfp_android_app_registrations","user_id"],["pairing_codes","id"],["evidence_batches","id"]
];
async function fetchCollectionRows(db:any,collectionName:string){const out:any[]=[];for(let offset=0;offset<50000;offset+=1000){const {data,error}=await db.from("mfp_documents").select("id,data,collection_name,document_id").eq("collection_name",collectionName).range(offset,offset+999);if(error)throw error;const rows=data??[];out.push(...rows);if(rows.length<1000)break;}return out;}
async function getQueueCapacity(db:any){const {data,error}=await db.from("mfp_documents").select("data").eq("collection_name","settings").eq("document_id","global").maybeSingle();if(error)throw error;const n=Number(data?.data?.checkingQueueCapacity);return Number.isFinite(n)&&n>0?Math.min(10000,Math.floor(n)):500;}
async function promoteCheckingBacklog(db:any){const rows=await fetchCollectionRows(db,"profiles"),capacity=await getQueueCapacity(db);let active=rows.filter((r:any)=>["QUEUED_CHECKING","CHECKING"].includes(txt(r.data?.currentWorkflowStatus))).length,promoted=0;for(const row of rows.filter((r:any)=>r.data?.currentWorkflowStatus==="SEARCHED"&&r.data?.autoHandoffPending===true).sort((a:any,b:any)=>txt(a.data?.createdAt).localeCompare(txt(b.data?.createdAt)))){if(active>=capacity)break;const now=iso();const {error}=await db.from("mfp_documents").update({data:{...row.data,currentWorkflowStatus:"QUEUED_CHECKING",queueAssignedAt:now,autoHandoffPending:false,autoHandoff:true,updatedAt:now},updated_at:now}).eq("id",row.id);if(error)throw error;active++;promoted++;}return{promoted,active,capacity};}
Deno.serve(async(req)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers});
 if(req.method!=="POST")return reply({error:"Method not allowed"},405);
 try{
  const url=Deno.env.get("SUPABASE_URL"),anon=Deno.env.get("SUPABASE_ANON_KEY")??Deno.env.get("SUPABASE_PUBLISHABLE_KEY"),secret=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if(!url||!anon||!secret)return reply({error:"Supabase Edge Function secrets are incomplete"},500);
  const authHeader=req.headers.get("Authorization")??"",token=authHeader.replace(/^Bearer\s+/i,"");if(!token||token===authHeader)return reply({error:"Authentication required"},401);
  const authClient=createClient(url,anon,{global:{headers:{Authorization:`Bearer ${token}`}},auth:{persistSession:false,autoRefreshToken:false}});
  const {data:authData,error:authError}=await authClient.auth.getUser(token);if(authError||!authData.user)return reply({error:"Session invalid or expired. Please sign in again."},401);
  const db=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}}),user=authData.user;
  const {data:profile,error:profileError}=await db.from("mfp_user_profiles").select("user_id,email,display_name,role,account_status,team_key,team_confirmed,allowed_modules").eq("user_id",user.id).maybeSingle();
  if(profileError)throw profileError;if(!profile||profile.account_status!=="ACTIVE")return reply({error:"Active MF MPanel profile required"},403);
  const body=await req.json().catch(()=>({})),action=txt(body.action);
  const {data:assignments,error:assignmentError}=await db.from("mfp_team_admin_assignments").select("team_key,admin_user_id");
  if(assignmentError&&!String(assignmentError.message).includes("does not exist"))throw assignmentError;
  const assigned=(assignments??[]) as Array<{team_key:string;admin_user_id:string}>;
  const isSenior=profile.role==="ADMIN"&&!assigned.some(x=>x.admin_user_id===user.id);
  const modules=Array.isArray(profile.allowed_modules)?profile.allowed_modules:[];
  const isSearching=profile.team_confirmed===true&&(profile.role==="SEARCHER"||profile.role==="USER"||modules.includes("searching"));
  const isChecking=profile.team_confirmed===true&&(profile.role==="CHECKER"||profile.role==="USER"||modules.includes("checking"));
  const requireSenior=()=>{if(!isSenior)throw new Error("Only the senior administrator can perform this action.");};
  if(action==="health")return reply({success:true,function:"mfp-workflow-control",checkedAt:iso()});
  if(action==="claimEvidenceAssignment"){
   const isEvidence=profile.role==="ADMIN"||(profile.team_confirmed===true&&(profile.role==="USER"||profile.role==="TEAM_ADMIN"||modules.includes("evidence")));
   if(!isEvidence)return reply({error:"Evidence Team access required"},403);
   const assignmentId=txt(body.assignmentId);if(!assignmentId)return reply({error:"Assignment ID is required."},400);
   const {data:assignment,error:readError}=await db.from("mfp_documents").select("id,data").eq("collection_name","evidenceAssignments").eq("document_id",assignmentId).maybeSingle();if(readError)throw readError;if(!assignment?.data)return reply({error:"Evidence assignment was not found."},404);
   const current=assignment.data as Record<string,unknown>;if(current.status!=="PENDING_ASSIGNMENT"&&current.assignedTo!==user.id)return reply({error:"This link is already assigned to another team member."},409);
   const now=iso();const {error:updateError}=await db.from("mfp_documents").update({data:{...current,status:"ASSIGNED",assignedTo:user.id,assignedAt:now,updatedAt:now},updated_at:now}).eq("id",assignment.id);if(updateError)throw updateError;
   return reply({success:true,assignmentId,status:"ASSIGNED",assignedTo:user.id});
  }
  if(action==="checkingHandoff"){
   if(!isChecking&&profile.role!=="ADMIN")return reply({error:"Checking Team access required"},403);
   const profileId=txt(body.profileId),outcome=txt(body.outcome),checkingRecordId=txt(body.checkingRecordId);if(!profileId||!checkingRecordId||!(outcome==="VERIFIED"||outcome==="FAILED_BLOCKED"))return reply({error:"Profile, checking record and valid outcome are required."},400);
   const {data:profileDoc,error:docError}=await db.from("mfp_documents").select("data").eq("collection_name","profiles").eq("document_id",profileId).maybeSingle();if(docError)throw docError;if(!profileDoc?.data)return reply({error:"Profile not found for downstream handoff."},404);
   const source=profileDoc.data as Record<string,unknown>,now=iso();let id="";
   if(outcome==="VERIFIED"){
    id=safeId("EVA");const data={assignmentId:id,profileId,canonicalUrl:txt(source.canonicalUrl),srcReference:Array.isArray(source.srcReferences)?source.srcReferences[0]??"":"",platform:txt(source.platform),status:"PENDING_ASSIGNMENT",teamKey:"evidence",sourceTeam:"checking",checkingRecordId,createdBy:user.id,createdAt:now,updatedAt:now,isTestData:source.isTestData===true};
    const {error}=await db.from("mfp_documents").insert({collection_name:"evidenceAssignments",document_id:id,data,owner_uid:user.id,team_key:"evidence",created_at:now,updated_at:now});if(error)throw error;
   }else{
    id=safeId("REV");const data={reviewId:id,profileId,canonicalUrl:txt(source.canonicalUrl),srcReference:Array.isArray(source.srcReferences)?source.srcReferences[0]??"":"",platform:txt(source.platform),reason:"BLOCKED_BY_CHECKING",status:"PENDING",sourceTeam:"checking",checkingRecordId,submittedBy:user.id,reviewNotes:txt(body.notes),createdAt:now,updatedAt:now,isTestData:source.isTestData===true};
    const {error}=await db.from("mfp_documents").insert({collection_name:"adminReviewItems",document_id:id,data,owner_uid:user.id,team_key:"admin",created_at:now,updated_at:now});if(error)throw error;
   }
   const backlog=await promoteCheckingBacklog(db);
   return reply({success:true,id,status:outcome==="VERIFIED"?"PENDING_ASSIGNMENT":"PENDING_REVIEW",backlogPromoted:backlog.promoted});
  }
  if(action==="ingestLinks"){
   if(!isSearching&&profile.role!=="ADMIN")return reply({error:"Searching Team access required"},403);
   if(body.isTestData===true&&!isSenior)return reply({error:"Only the senior administrator can tag test data."},403);
   const items=Array.isArray(body.items)?body.items.slice(0,10000):[];if(!items.length)return reply({error:"Paste at least one valid link."},400);
   const existing=await fetchCollectionRows(db,"profiles"),capacity=await getQueueCapacity(db);let activeQueueCount=existing.filter((r:any)=>["QUEUED_CHECKING","CHECKING"].includes(txt(r.data?.currentWorkflowStatus))).length;
   const known=new Map<string,{record_id:string;canonical_url:string}>();for(const row of existing){const canonical=txt(row.data?.canonicalUrl);if(canonical)known.set(canonical.toLowerCase(),{record_id:txt(row.document_id),canonical_url:canonical});}
   const seen=new Set<string>(),created:string[]=[],duplicates:string[]=[],invalid:string[]=[];let queued=0,backlogged=0,profileLinks=0,postedLinks=0;const now=iso();
   for(const raw of items){
    const originalUrl=txt(raw?.rawUrl),canonicalUrl=txt(raw?.canonicalUrl),platform=txt(raw?.platform)||"UNKNOWN",normalizationError=txt(raw?.error);
    if(!originalUrl||!canonicalUrl||normalizationError||!/^https?:\/\//i.test(canonicalUrl)){
      const id=safeId("REV");const data={reviewId:id,originalUrl,canonicalUrl,platform,reason:"INVALID_LINK",status:"PENDING",sourceTeam:"searching",submittedBy:user.id,createdAt:now,updatedAt:now,reviewNotes:normalizationError||"URL could not be normalized",isTestData:body.isTestData===true};
      const {error}=await db.from("mfp_documents").insert({collection_name:"adminReviewItems",document_id:id,data,owner_uid:user.id,team_key:"admin",created_at:now,updated_at:now});if(error)throw error;invalid.push(id);continue;
    }
    const key=canonicalUrl.toLowerCase();
    const pathname=(()=>{try{return new URL(canonicalUrl).pathname.toLowerCase()}catch{return ""}})();
    const isPosted=/\/(p|reel|reels|tv|posts|post|videos?|photo|photos|status|shorts|watch|live|clip|stories|story)(\/|$)/i.test(pathname)||/[?&](v|story_fbid|fbid|item_id)=/i.test(canonicalUrl);
    if(isPosted)postedLinks++;else profileLinks++;
    if(seen.has(key)||known.has(key)){
      const id=safeId("REV"),match=seen.has(key)?undefined:known.get(key);const data={reviewId:id,originalUrl,canonicalUrl,platform,reason:"DUPLICATE",status:"PENDING",sourceTeam:"searching",submittedBy:user.id,duplicateOf:match?.record_id??null,createdAt:now,updatedAt:now,reviewNotes:seen.has(key)?"Repeated in this paste batch":"Already exists in workflow database",isTestData:body.isTestData===true};
      const {error}=await db.from("mfp_documents").insert({collection_name:"adminReviewItems",document_id:id,data,owner_uid:user.id,team_key:"admin",created_at:now,updated_at:now});if(error)throw error;duplicates.push(id);continue;
    }
    seen.add(key);
    const profileId=safeId("PRF"),src=`SRC-${new Date().getUTCFullYear()}-${crypto.randomUUID().slice(0,10).toUpperCase()}`;
    const hasQueueSlot=activeQueueCount<capacity;const data={profileId,canonicalUrl,originalUrl,platform,srcReferences:[src],currentWorkflowStatus:hasQueueSlot?"QUEUED_CHECKING":"SEARCHED",postCount:0,notes:txt(raw?.notes),createdBy:user.id,createdByUid:user.id,createdAt:now,updatedAt:now,queueAssignedAt:hasQueueSlot?now:null,autoHandoff:true,autoHandoffPending:!hasQueueSlot,isTestData:body.isTestData===true};
    const {error}=await db.from("mfp_documents").insert({collection_name:"profiles",document_id:profileId,data,owner_uid:user.id,team_key:"searching",created_at:now,updated_at:now});
    if(error){if(String(error.message).toLowerCase().includes("duplicate")||String(error.code)==="23505") {const id=safeId("REV");const review={reviewId:id,originalUrl,canonicalUrl,platform,reason:"DUPLICATE_RACE",status:"PENDING",sourceTeam:"searching",submittedBy:user.id,createdAt:now,updatedAt:now,isTestData:body.isTestData===true};const {error:re}=await db.from("mfp_documents").insert({collection_name:"adminReviewItems",document_id:id,data:review,owner_uid:user.id,team_key:"admin",created_at:now,updated_at:now});if(re)throw re;duplicates.push(id);continue;}throw error;}
    created.push(profileId);known.set(key,{record_id:profileId,canonical_url:canonicalUrl});if(hasQueueSlot){activeQueueCount++;queued++;}else backlogged++;
   }
   await db.from("mfp_documents").insert({collection_name:"workflowEvents",document_id:safeId("EVT"),data:{stage:"SEARCHING",action:"AUTO_INTAKE_COMPLETED",actorUid:user.id,actorEmail:user.email??"",createdAt:now,metadata:{created:created.length,duplicates:duplicates.length,invalid:invalid.length},isTestData:body.isTestData===true},owner_uid:user.id,team_key:"searching",created_at:now,updated_at:now});
   return reply({success:true,created:created.length,queued,backlogged,duplicates:duplicates.length,invalid:invalid.length,submittedCount:items.length,profileLinks,postedLinks,profileIds:created,reviewIds:[...duplicates,...invalid],message:`${queued} unique links sent to Checking${backlogged?`; ${backlogged} more saved to the automatic backlog because the ${capacity}-link queue is full`:""}; ${duplicates.length+invalid.length} link(s) sent to Admin Review.`});
  }
  if(action==="resetPreview"){
   requireSenior();const all:any[]=[];for(const collectionName of workflowCollections)all.push(...(await fetchCollectionRows(db,collectionName)));
   const test=all.filter(r=>r.data?.isTestData===true);const counts:Record<string,number>={};for(const row of all)counts[row.collection_name]=(counts[row.collection_name]??0)+1;
   let systemMetadataRecords=0;for(const [table,key] of systemResetTables){const {count,error}=await db.from(table).select(key,{count:"exact",head:true});if(error)throw error;counts[table]=count??0;systemMetadataRecords+=count??0;}
   return reply({success:true,testingRecords:test.length,workflowRecords:all.length+systemMetadataRecords,systemMetadataRecords,byCollection:counts,testingCollections:[...new Set(test.map(r=>r.collection_name))],resetScope:"Full MF MPanel data reset clears workflow rows, Evidence metadata, app registrations and pairing codes. It preserves Auth accounts, MF MPanel profiles/roles, team-admin assignments, website settings/platform catalog, unrelated MF Links data, Supabase Storage assets and local Android evidence files."});
  }
  if(action==="resetTestingData"||action==="resetSystem"){
   requireSenior();if(txt(body.confirmation)!==(action==="resetTestingData"?"DELETE TEST DATA":"RESET ALL MF MPANEL DATA"))return reply({error:"Confirmation phrase did not match."},400);
   const targets=workflowCollections;let deleted=0;
   for(const collectionName of targets){
    const rows=await fetchCollectionRows(db,collectionName);
    const ids=rows.filter((r:any)=>action==="resetSystem"||r.data?.isTestData===true).map((r:any)=>r.id);if(!ids.length)continue;
    for(let i=0;i<ids.length;i+=200){const {error:delError,count}=await db.from("mfp_documents").delete({count:"exact"}).in("id",ids.slice(i,i+200));if(delError)throw delError;deleted+=count??ids.slice(i,i+200).length;}
   }
   if(action==="resetSystem"){
    for(const [table,key] of systemResetTables){const {count,error}=await db.from(table).delete({count:"exact"}).not(key,"is",null);if(error)throw error;deleted+=count??0;}
   }
   if(action==="resetTestingData")await db.from("mfp_documents").insert({collection_name:"workflowEvents",document_id:safeId("EVT"),data:{stage:"ADMIN",action:"TEST_DATA_RESET",actorUid:user.id,actorEmail:user.email??"",createdAt:iso(),metadata:{deleted,scope:action},isTestData:false},owner_uid:user.id,team_key:"admin",created_at:iso(),updated_at:iso()});
   return reply({success:true,deleted,scope:action});
  }
  return reply({error:"Unsupported action"},400);
 }catch(error){console.error("mfp-workflow-control",error);return reply({error:error instanceof Error?error.message:"Unexpected workflow control error"},500);}
});
