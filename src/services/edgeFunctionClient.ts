import { supabase } from '../lib/supabase';
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const friendly = (message: string, fn: string) => {
 const t=(message||'').toLowerCase();
 if (/401|unauthenticated|session expired/.test(t)) return 'Your session has expired. Please sign in again.';
 if (/403|permission|access required/.test(t)) return 'Your account does not have permission for this action. Contact your team administrator.';
 if (/404|not found|could not be reached|failed to send a request|fetch/.test(t)) return `The ${fn} service is unavailable. An administrator should verify deployment and Supabase logs.`;
 if (/429|rate limit/.test(t)) return 'The service is busy. Please wait a moment and try again.';
 if (/cors/.test(t)) return 'The service connection was blocked. An administrator should check Edge Function CORS settings.';
 return 'The request could not be completed. Please try again; if it continues, contact an administrator.';
};
export async function invokeEdgeFunction<T>(fn: string, body: Record<string, unknown>): Promise<T> {
 let last='';
 for(let attempt=0;attempt<2;attempt++) {
  try {
   const {data,error}=await supabase.functions.invoke(fn,{body});
   if(!error){if((data as any)?.error) throw new Error(String((data as any).error)); return data as T;}
   let detail=error.message||''; const context=(error as any).context;
   try { if(context?.clone){const parsed=await context.clone().json();detail=parsed?.error||parsed?.message||detail;} } catch {}
   last=detail;
   if(attempt===0 && /fetch|network|failed to send|timeout|temporar|502|503|504|429/i.test(detail)){await sleep(350);continue;}
   throw new Error(friendly(detail,fn));
  } catch(e) {
   last=e instanceof Error?e.message:'';
   if(attempt===0 && /fetch|network|failed to send|timeout|temporar|502|503|504|429/i.test(last)){await sleep(350);continue;}
   throw new Error(friendly(last,fn));
  }
 }
 throw new Error(friendly(last,fn));
}
