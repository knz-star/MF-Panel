import React, { useEffect, useState } from 'react';
import { BadgeCheck, Mail, Save, ShieldCheck, UserRound, RefreshCw, Activity, AlertTriangle, Download } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { db, doc, updateDoc, getDoc } from '../../lib/supabaseDocumentStore';
import type { TeamKey } from '../../types/user';
import { getMyTeamScore, type MyTeamScore } from '../../services/teamAnalyticsService';
import { notify } from '../../utils/toast';
import { downloadUserPledgePdf } from '../../services/pledgePdfService';

const workspaceLabels: Record<TeamKey, string> = {
  searching: 'Searching Team',
  checking: 'Checking Team',
  reports: 'Report Generator',
  evidence: 'Evidence Team',
};

export const ProfilePage: React.FC = () => {
  const { currentUser, userProfile, isAdmin, refreshProfile } = useAuth();
  const [displayName, setDisplayName] = useState(userProfile?.displayName ?? '');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const [scoreDays, setScoreDays] = useState<7|14>(7);
  const [scoreData, setScoreData] = useState<MyTeamScore|null>(null);
  const [scoreError, setScoreError] = useState('');
  const [pledgeDownloading, setPledgeDownloading] = useState(false);
  const [pledgeMessage, setPledgeMessage] = useState('');
  useEffect(() => { let alive=true; const load=async()=>{try{const result=await getMyTeamScore(scoreDays);if(alive){setScoreData(result);setScoreError('');}}catch(e){if(alive)setScoreError(e instanceof Error?e.message:'Score is not available yet.');}};void load();const timer=window.setInterval(()=>void load(),30000);return()=>{alive=false;window.clearInterval(timer);}; },[scoreDays]);

  useEffect(() => setDisplayName(userProfile?.displayName ?? ''), [userProfile?.displayName]);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    const cleanName = displayName.trim();
    if (!currentUser?.uid || !userProfile) {
      setMessage({ kind: 'error', text: 'Your account profile is not available. Please sign in again.' });
      return;
    }
    if (cleanName.length < 2 || cleanName.length > 80) {
      setMessage({ kind: 'error', text: 'Name must contain 2 to 80 characters.' });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      await updateDoc(doc(db, 'users', currentUser.uid), {
        displayName: cleanName,
        updatedAt: new Date().toISOString(),
      });
      await refreshProfile();
      setMessage({ kind: 'success', text: 'Your profile has been updated.' }); notify('Profile saved successfully.', 'success');
    } catch (error) {
      console.error('Profile update reported an error; verifying persisted value:', error);
      try {
        const saved = await getDoc(doc(db, 'users', currentUser.uid));
        const savedName = saved.exists() ? (saved.data() as { displayName?: string }).displayName : undefined;
        if (savedName === cleanName) { await refreshProfile(); setMessage({ kind: 'success', text: 'Your profile has been updated.' }); notify('Profile saved successfully.', 'success'); }
        else setMessage({ kind: 'error', text: 'Profile could not be saved. Please check your connection and try again.' });
      } catch { setMessage({ kind: 'error', text: 'We could not verify the save. Refresh the page before trying again.' }); }
    } finally {
      setSaving(false);
    }
  };

  const assigned = (userProfile?.allowedModules ?? []).filter((module): module is TeamKey => module in workspaceLabels);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <div className="flex items-start gap-4">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-blue-50 text-blue-700"><UserRound className="h-6 w-6" /></div>
          <div><p className="text-[11px] font-bold uppercase tracking-[.18em] text-blue-700">Account</p><h2 className="mt-1 text-xl font-bold text-slate-950">My Profile</h2><p className="mt-1 text-sm leading-6 text-slate-500">Manage your display name and review the account access currently assigned to you.</p></div>
        </div>

        <section className={`mt-5 rounded-2xl border p-4 ${scoreData?.score!==null&&scoreData?.score!==undefined&&scoreData.score<25?'border-rose-200 bg-rose-50':'border-slate-200 bg-slate-50'}`}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-start gap-3"><span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${scoreData?.score!==null&&scoreData?.score!==undefined&&scoreData.score<25?'bg-rose-100 text-rose-700':'bg-blue-100 text-blue-700'}`}>{scoreData?.score!==null&&scoreData?.score!==undefined&&scoreData.score<25?<AlertTriangle className="h-5 w-5"/>:<Activity className="h-5 w-5"/>}</span><div><h3 className="font-bold text-slate-950">My performance score</h3><p className="mt-1 text-xs leading-5 text-slate-600">Your recorded workflow activity and account status. Refreshes automatically every 30 seconds.</p></div></div><div className="flex gap-2"><button type="button" onClick={()=>setScoreDays(7)} className={`rounded-lg px-3 py-2 text-xs font-bold ${scoreDays===7?'bg-slate-950 text-white':'border border-slate-200 bg-white text-slate-600'}`}>7 days</button><button type="button" onClick={()=>setScoreDays(14)} className={`rounded-lg px-3 py-2 text-xs font-bold ${scoreDays===14?'bg-slate-950 text-white':'border border-slate-200 bg-white text-slate-600'}`}>14 days</button></div></div>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4"><div className="rounded-xl bg-white p-3"><p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Score</p><p className={`mt-1 text-xl font-extrabold ${scoreData?.score!==null&&scoreData?.score!==undefined&&scoreData.score<25?'text-rose-700':'text-slate-950'}`}>{scoreData?.score===null||scoreData?.score===undefined?'—':`${scoreData.score.toFixed(1)}%`}</p></div><div className="rounded-xl bg-white p-3"><p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Status</p><p className="mt-1 text-sm font-bold text-slate-900">{scoreData?.scoreStatus?.replaceAll('_',' ')??'Loading'}</p></div><div className="rounded-xl bg-white p-3"><p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Completed</p><p className="mt-1 text-xl font-extrabold text-emerald-700">{scoreData?.completed??'—'}</p></div><div className="rounded-xl bg-white p-3"><p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Activity</p><p className="mt-1 text-xl font-extrabold text-slate-900">{scoreData?.activity??'—'}</p></div></div>
          {(scoreData?.accountStatus ?? userProfile?.accountStatus)==='DISABLED'&&<p className="mt-3 rounded-xl border border-rose-200 bg-white p-3 text-sm font-semibold text-rose-800">Your account is currently disabled. Contact your team administrator for a review.</p>}
          {scoreError&&<p className="mt-3 text-xs text-amber-700">{scoreError}</p>}
          {scoreData&&scoreData.score===null&&<p className="mt-3 text-xs text-slate-500">There are not enough verified completed/failed outcomes to calculate a score yet. Activity alone does not create an invented score.</p>}
        </section>

        {message && <div role={message.kind === 'error' ? 'alert' : 'status'} className={`mt-5 rounded-xl border p-3 text-sm ${message.kind === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-rose-200 bg-rose-50 text-rose-700'}`}>{message.text}</div>}
        <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div><h3 className="text-sm font-bold text-slate-900">My signed pledge</h3><p className="mt-1 text-xs leading-5 text-slate-500">Download a copy of your submitted pledge at any time. This does not change its saved status.</p></div>
            <button type="button" onClick={async () => { if (!userProfile || !currentUser) return; setPledgeDownloading(true); setPledgeMessage(''); try { await downloadUserPledgePdf({ ...userProfile, uid: currentUser.uid, email: currentUser.email || userProfile.email }); setPledgeMessage('Your pledge PDF has been generated.'); } catch (e) { setPledgeMessage(e instanceof Error ? e.message : 'Pledge PDF could not be generated.'); } finally { setPledgeDownloading(false); } }} disabled={pledgeDownloading || !userProfile?.pledgeAccepted || !userProfile?.pledgeSignature?.trim()} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"><Download className="h-4 w-4"/>{pledgeDownloading ? 'Preparing PDF…' : 'Download my pledge PDF'}</button>
          </div>
          {pledgeMessage && <p role="status" className="mt-3 text-xs text-slate-600">{pledgeMessage}</p>}
          {!userProfile?.pledgeAccepted && <p className="mt-2 text-xs text-amber-700">No submitted pledge is recorded on this account yet.</p>}
        </section>

        <form onSubmit={(event) => void save(event)} className="mt-6 space-y-5">
          <div>
            <label htmlFor="profile-name" className="mb-1.5 block text-sm font-semibold text-slate-700">Display name</label>
            <input id="profile-name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} maxLength={80} autoComplete="name" className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10" required />
          </div>
          <div>
            <label htmlFor="profile-email" className="mb-1.5 block text-sm font-semibold text-slate-700">Sign-in email</label>
            <div className="relative"><Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"/><input id="profile-email" value={userProfile?.email ?? currentUser?.email ?? ''} readOnly className="min-h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3.5 text-sm text-slate-500" /></div>
            <p className="mt-1 text-xs text-slate-400">Email changes are not available from this page.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4"><p className="text-xs text-slate-500">Account role</p><p className="mt-1 flex items-center gap-2 text-sm font-semibold text-slate-900"><ShieldCheck className="h-4 w-4 text-blue-700"/>{isAdmin ? 'Administrator' : userProfile?.role ?? 'Member'}</p></div>
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4"><p className="text-xs text-slate-500">Account status</p><p className="mt-1 flex items-center gap-2 text-sm font-semibold text-slate-900"><BadgeCheck className="h-4 w-4 text-emerald-700"/>{scoreData?.accountStatus ?? userProfile?.accountStatus ?? 'Unknown'}</p></div>
          </div>
          <div className="rounded-xl border border-slate-100 p-4"><p className="text-sm font-semibold text-slate-800">Authorized workspaces</p>{assigned.length ? <div className="mt-3 flex flex-wrap gap-2">{assigned.map((key) => <span key={key} className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-800">{workspaceLabels[key]}</span>)}</div> : <p className="mt-2 text-sm text-slate-500">No workspace access is currently assigned. Contact an administrator.</p>}</div>
          <button type="submit" disabled={saving || !userProfile} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto">{saving ? <RefreshCw className="h-4 w-4 animate-spin"/> : <Save className="h-4 w-4"/>}{saving ? 'Saving profile…' : 'Save profile'}</button>
        </form>
      </section>
    </div>
  );
};
