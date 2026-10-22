import { buildGroupReportPdf, savePdf } from '../../utils/pdfReport';
import React, { useCallback, useEffect, useState } from 'react';
import { Activity, Download, RefreshCw, ShieldCheck, Users, Link2, AlertTriangle } from 'lucide-react';
import { invokeWebsiteApi } from '../../services/webApiClient';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../auth/AuthContext';

type GenderGroup = 'male' | 'female';
type GenderReport = Record<string, any>;
type TeamAdminOption = { user_id: string; email: string; display_name: string; gender?: string | null; gender_group?: string | null };
const GROUPS: Array<{ key: GenderGroup; label: string; accent: string }> = [{ key: 'male', label: 'Male Team', accent: 'blue' }, { key: 'female', label: 'Female Team', accent: 'pink' }];

export const GenderTeamDashboardPage: React.FC = () => {
  const { isAdmin, isTeamAdmin, currentUser } = useAuth();
  const [group, setGroup] = useState<GenderGroup>('male');
  const [report, setReport] = useState<GenderReport | null>(null);
  const [admins, setAdmins] = useState<TeamAdminOption[]>([]);
  const [assignments, setAssignments] = useState<Array<{ gender_group: GenderGroup; admin_user_id: string }>>([]);
  const [assignmentValues, setAssignmentValues] = useState<Record<GenderGroup, string>>({ male: '', female: '' });
  const [busy, setBusy] = useState(false);
  const [assigning, setAssigning] = useState<GenderGroup | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const refresh = useCallback(async () => {
    setBusy(true); setError('');
    try {
      const data = await invokeWebsiteApi<any>('mfp-gender-team-admin', { action: 'get', genderGroup: group });
      if (!data?.success) throw new Error(data?.error || 'Could not load the gender-group dashboard.');
      setReport(data);
      if (data.genderGroup === 'male' || data.genderGroup === 'female') setGroup(data.genderGroup);
      if (Array.isArray(data.assignments)) {
        setAssignments(data.assignments);
        setAssignmentValues({ male: data.assignments.find((a: any) => a.gender_group === 'male')?.admin_user_id || '', female: data.assignments.find((a: any) => a.gender_group === 'female')?.admin_user_id || '' });
      }
    } catch (err: any) { setError(err?.message || 'Gender-team dashboard could not be loaded.'); setReport(null); }
    finally { setBusy(false); }
  }, [group]);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    if (!isAdmin) return;
    let alive = true;
    void supabase.rpc('mfp_admin_list_users', { p_limit: 300 }).then(({ data, error: queryError }) => {
      if (!alive) return;
      if (queryError) { setError(queryError.message); return; }
      const rows = Array.isArray(data) ? data : [];
      setAdmins(rows.filter((u: any) => ['ADMIN','TEAM_ADMIN'].includes(u.role) && u.account_status === 'ACTIVE').map((u: any) => ({ user_id: u.user_id, email: u.email || '', display_name: u.display_name || u.email || 'Admin', gender: u.gender, gender_group: u.gender_group })) as TeamAdminOption[]);
    });
    return () => { alive = false; };
  }, [isAdmin]);

  const assign = async (genderGroup: GenderGroup) => {
    const adminUserId = assignmentValues[genderGroup];
    if (!adminUserId && !assignments.some((item) => item.gender_group === genderGroup)) { setError('Select an active Team Admin first.'); return; }
    setAssigning(genderGroup); setError(''); setNotice('');
    try {
      const data = await invokeWebsiteApi<any>('mfp-gender-team-admin', { action: 'assign', genderGroup, adminUserId });
      if (!data?.success) throw new Error(data?.error || 'Could not assign gender-team lead.');
      setNotice(data.removed ? `${genderGroup === 'male' ? 'Male' : 'Female'} Team lead removed.` : `${genderGroup === 'male' ? 'Male' : 'Female'} Team lead assigned: ${data.adminName || adminUserId}`);
      await refresh();
    } catch (err: any) { setError(err?.message || 'Assignment failed.'); }
    finally { setAssigning(null); }
  };

  const download = async () => {
    if (!report) return;
    setError('');
    try { savePdf(await buildGroupReportPdf(report), `MF-MPanel-${report.genderGroup}-team-report.pdf`); }
    catch (err) { console.error('Group report PDF failed', err); setError('PDF could not be generated. Please try again.'); }
  };

  const currentGroup = report?.genderGroup as GenderGroup | undefined;
  const assignmentLabel = (genderGroup: GenderGroup) => {
    const userId = assignments.find((item) => item.gender_group === genderGroup)?.admin_user_id;
    return admins.find((item) => item.user_id === userId)?.display_name || admins.find((item) => item.user_id === userId)?.email || 'Not assigned';
  };

  return <div className="mx-auto max-w-7xl space-y-6">
    <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-[11px] font-bold uppercase tracking-[.18em] text-blue-700">MF MPanel · Private team grouping</p><h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">Male & Female Team Dashboards</h1><p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">Signup gender is stored as a separate group. Assigned group leads can see only members and work associated with their group; functional workspace permissions remain separate.</p></div><button onClick={() => void refresh()} disabled={busy} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold"><RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`}/>Refresh</button></header>
    {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</div>}
    {notice && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</div>}
    {isAdmin && <section className="grid gap-4 md:grid-cols-2">{GROUPS.map((item) => <div key={item.key} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-3"><span className={`flex h-10 w-10 items-center justify-center rounded-xl ${item.key === 'male' ? 'bg-blue-50 text-blue-700' : 'bg-pink-50 text-pink-700'}`}><Users className="h-5 w-5"/></span><div><h2 className="font-bold text-slate-950">{item.label} Lead</h2><p className="text-xs text-slate-500">Current lead: {assignmentLabel(item.key)}</p></div></div><label className="mt-4 block text-xs font-semibold text-slate-600">Assign active Team Admin<select value={assignmentValues[item.key]} onChange={(e) => setAssignmentValues((old) => ({ ...old, [item.key]: e.target.value }))} className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"><option value="">{assignments.some((a) => a.gender_group === item.key) ? 'Remove current lead' : 'Choose Team Admin…'}</option>{admins.map((a) => <option key={a.user_id} value={a.user_id}>{a.display_name || a.email} · {a.email}</option>)}</select></label><button onClick={() => void assign(item.key)} disabled={!!assigning || (!assignmentValues[item.key] && !assignments.some((a) => a.gender_group === item.key))} className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white disabled:opacity-50">{assigning === item.key ? <RefreshCw className="h-4 w-4 animate-spin"/> : <ShieldCheck className="h-4 w-4"/>}{assignmentValues[item.key] ? 'Assign lead' : 'Remove lead'}</button></div>)}</section>}
    {isAdmin && <div className="flex flex-wrap gap-2">{GROUPS.map((item) => <button key={item.key} onClick={() => setGroup(item.key)} className={`rounded-xl border px-4 py-2.5 text-sm font-semibold ${group === item.key ? item.key === 'male' ? 'border-blue-600 bg-blue-600 text-white' : 'border-pink-600 bg-pink-600 text-white' : 'border-slate-200 bg-white text-slate-700'}`}>{item.label}</button>)}</div>}
    {busy && !report ? <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-500">Loading authorized gender-group data…</div> : report && <>
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4"><div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">Group</p><p className="mt-1 text-xl font-bold capitalize text-slate-950">{currentGroup}</p></div><div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">Members</p><p className="mt-1 text-2xl font-bold text-slate-950">{report.totalMembers ?? 0}</p></div><div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">Recorded work items</p><p className="mt-1 text-2xl font-bold text-slate-950">{report.totalWork ?? 0}</p></div><div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">Completed / Failed</p><p className="mt-1 text-2xl font-bold text-slate-950">{report.completed ?? 0} / {report.failed ?? 0}</p></div></section>
      <section className="grid gap-5 lg:grid-cols-[1fr_340px]"><div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between gap-3"><h2 className="flex items-center gap-2 font-bold text-slate-950"><Users className="h-5 w-5"/>Group members & activity</h2><button onClick={() => void download()} className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-semibold"><Download className="h-3.5 w-3.5"/>Download PDF</button></div><div className="mt-4 overflow-x-auto"><table className="min-w-full text-left text-xs"><thead className="bg-slate-50 text-slate-500"><tr><th className="p-3">Member</th><th className="p-3">Workspace</th><th className="p-3">Status</th><th className="p-3">Activity</th><th className="p-3">Completed / Failed</th></tr></thead><tbody className="divide-y divide-slate-100">{(report.members ?? []).map((member: any) => <tr key={member.userId}><td className="p-3"><p className="font-semibold text-slate-900">{member.name}</p><p className="mt-1 text-slate-500">{member.email}</p></td><td className="p-3 capitalize">{member.team || 'Not assigned'}</td><td className="p-3"><span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${member.accountStatus === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700' : member.accountStatus === 'PENDING' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>{member.accountStatus || 'PENDING'}</span></td><td className="p-3 font-semibold">{member.activity}</td><td className="p-3">{member.completed} / {member.failed}</td></tr>)}</tbody></table>{!(report.members ?? []).length && <p className="p-8 text-center text-sm text-slate-500">No recorded work for this group yet.</p>}</div></div>
        <aside className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="flex items-center gap-2 font-bold text-slate-950"><Activity className="h-5 w-5"/>Work by workspace</h2><div className="mt-4 space-y-3">{Object.entries(report.workByTeam ?? {}).map(([team, count]) => <div key={team}><div className="flex justify-between gap-3 text-xs"><span className="capitalize text-slate-600">{team}</span><strong className="text-slate-900">{Number(count).toLocaleString()}</strong></div><div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${team === 'searching' ? 'bg-blue-500' : team === 'checking' ? 'bg-amber-500' : team === 'reports' ? 'bg-violet-500' : team === 'evidence' ? 'bg-emerald-500' : 'bg-slate-400'}`} style={{ width: `${Math.min(100, Number(count) / Math.max(1, Number(report.totalWork)) * 100)}%` }}/></div></div>)}</div>{report.truncated && <p className="mt-4 flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-800"><AlertTriangle className="h-4 w-4 shrink-0"/>Data cap reached; this summary may be incomplete.</p>}</aside></section>
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="flex items-center gap-2 font-bold text-slate-950"><Link2 className="h-5 w-5"/>Profile & post links</h2><div className="mt-3 max-h-80 space-y-2 overflow-auto">{(report.linkRecords ?? []).slice(0, 100).map((link: any, i: number) => <div key={`${link.publicId}-${i}`} className="flex flex-col gap-1 rounded-xl bg-slate-50 p-3 sm:flex-row sm:items-center"><span className="w-fit rounded-md bg-blue-100 px-2 py-1 font-mono text-[10px] font-bold text-blue-800">{link.publicId}</span><span className="text-[10px] uppercase text-slate-500">{link.recordType} · {link.status}</span><a href={link.url} target="_blank" rel="noreferrer" className="break-all text-xs text-blue-700 hover:underline">{link.url}</a></div>)}{!(report.linkRecords ?? []).length && <p className="py-6 text-center text-sm text-slate-500">No profile/post records are attributed to this group yet.</p>}</div></section>
    </>}
    <p className="text-center text-[11px] text-slate-400">Signed in as {currentUser?.email || 'user'}{isTeamAdmin ? ' · Team Admin' : isAdmin ? ' · Admin' : ''}. Gender group classification is separate from workflow module permissions.</p>
  </div>;
};
