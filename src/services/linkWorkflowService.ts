import { supabase } from '../lib/supabase';
export type AssignedLink = { id:string; profileId:string; mfpProfileId?:string|null; sourceProfileId:string; linkId:string; url:string; platform:string; requiredScreenshots:number; notes:string; assignedAt:string };
async function call<T>(body:Record<string,unknown>):Promise<T>{
 const {data,error}=await supabase.functions.invoke('mfp-link-workflow',{body});
 if(error)throw new Error(error.message||'MF MPanel link workflow request failed');
 if(data?.error)throw new Error(String(data.error));return data as T;
}
export type LinkSummary={platformCounts:{platform:string;available_count:number}[];availableTotal:number;systemPending:number};
export const getLinkSummary=()=>call<LinkSummary>({action:'summary'});
export const assignLinks=(platforms:string[],count:number,batchName?:string)=>call<{assigned:AssignedLink[];count:number;requested:number;downloadText:string;batchId:string;batchName:string;createdAt:string;createdBy:string;links:Array<Record<string,unknown>>}>({action:'assign-links',platforms,count,batchName});
export const matchUploadedZip=(urls:string[],reportJobId?:string)=>call<{jobId:string;inputUniqueCount:number;matchedCount:number;matched:any[];unmatchedCount:number;matchedUrls:string[]}>({action:'match-zip',urls,reportJobId});
export type CheckingItem={assignmentId:string;profileId:string;url:string;platform:string;status:string;postUrls:string[];assignedAt:string};
export const getNextCheckingItem=()=>call<{item:CheckingItem|null;remainingInPrivateBatch:number}>({action:'checker-next'});
export const submitCheckingAction=(assignmentId:string,outcome:'OPEN'|'REOPEN'|'RECHECK'|'BLOCKED'|'INVALID'|'VERIFIED',notes:string,postUrls:string[]=[])=>call<{success:boolean;terminal:boolean;completedAt:string|null}>({action:'checker-submit',assignmentId,outcome,notes,postUrls});
export const getAdminCheckingResults=()=>call<{items:any[]}>({action:'admin-checking-results'});
