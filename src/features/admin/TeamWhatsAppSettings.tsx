import React, { useCallback, useEffect, useState } from 'react';
import { MessageCircle, Save, RefreshCw, ChevronDown, Users, ShieldCheck } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../auth/AuthContext';

type TeamKey = 'searching' | 'checking' | 'reports' | 'evidence';
type GenderGroup = 'male' | 'female';
type ContactRow = { team_key: TeamKey; gender_group: GenderGroup; whatsapp_number: string; support_label?: string; updated_at?: string };
type AdminOption = { user_id: string; email: string; display_name: string; gender_group: GenderGroup };
type Assignment = { team_key: TeamKey; gender_group: GenderGroup; admin_user_id: string; email?: string; display_name?: string };
const TEAMS: Array<{ key: TeamKey; label: string }> = [{ key: 'searching', label: 'Searching' }, { key: 'checking', label: 'Checking' }, { key: 'reports', label: 'Report Generator' }, { key: 'evidence', label: 'Evidence' }];
const GENDERS: Array<{ key: GenderGroup; label: string }> = [{ key: 'male', label: 'Male' }, { key: 'female', label: 'Female' }];
const scopeKey = (team: string, gender: string) => `${team}:${gender}`;

export const TeamWhatsAppSettings: React.FC = () => {
  const { isAdmin, userProfile } = useAuth();
  const visibleTeams = isAdmin ? TEAMS : TEAMS.filter(t => t.key === userProfile?.team);
  const visibleGenders = isAdmin ? GENDERS : GENDERS.filter(g => g.key === (userProfile?.genderGroup || userProfile?.gender));
  const [rows, setRows] = useState<ContactRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, { number: string; label: string }>>({});
  const [admins, setAdmins] = useState<AdminOption[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [leadDrafts, setLeadDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(''); const [notice, setNotice] = useState(''); const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const { data, error: rpcError } = await supabase.rpc('mfp_team_gender_settings_api', { p_action: 'listContacts', p_payload: {} });
      if (rpcError) throw rpcError;
      const contactRows = Array.isArray(data) ? data as ContactRow[] : [];
      setRows(contactRows);
      setDrafts(Object.fromEntries(contactRows.map(r => [scopeKey(r.team_key, r.gender_group), { number: r.whatsapp_number || '', label: r.support_label || '' }])));
      if (isAdmin) {
        const { data: adminData, error: adminError } = await supabase.rpc('mfp_team_gender_settings_api', { p_action: 'listAssignments', p_payload: {} });
        if (adminError) throw adminError;
        const payload = (adminData || {}) as { assignments?: Assignment[]; eligibleAdmins?: AdminOption[] };
        setAssignments(payload.assignments || []); setAdmins(payload.eligibleAdmins || []);
        setLeadDrafts(Object.fromEntries(TEAMS.flatMap(t => GENDERS.map(g => { const k=scopeKey(t.key,g.key); return [k, payload.assignments?.find(a=>a.team_key===t.key&&a.gender_group===g.key)?.admin_user_id || '']; }))));
      }
    } catch (e) { setError(e instanceof Error ? e.message : 'Team/gender settings could not load. Apply the team-gender settings migration first.'); }
    finally { setLoading(false); }
  }, [isAdmin]);
  useEffect(() => { void load(); }, [load]);

  const saveContact = async (team: TeamKey, gender: GenderGroup) => {
    const key = scopeKey(team, gender); const draft = drafts[key] || { number: '', label: '' };
    setBusy(`contact:${key}`); setNotice(''); setError('');
    try {
      const { error: rpcError } = await supabase.rpc('mfp_team_gender_settings_api', { p_action: 'saveContact', p_payload: { teamKey: team, genderGroup: gender, whatsappNumber: draft.number.trim(), supportLabel: draft.label.trim() } });
      if (rpcError) throw rpcError;
      setNotice(`${TEAMS.find(t=>t.key===team)?.label} · ${gender} support contact saved.`); await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not save contact.'); }
    finally { setBusy(''); }
  };
  const saveLead = async (team: TeamKey, gender: GenderGroup) => {
    const key = scopeKey(team, gender); const userId = leadDrafts[key] || '';
    if (!userId) { setError('Choose an active admin for this team/gender category.'); return; }
    setBusy(`lead:${key}`); setNotice(''); setError('');
    try {
      const { error: rpcError } = await supabase.rpc('mfp_team_gender_settings_api', { p_action: 'assignLead', p_payload: { teamKey: team, genderGroup: gender, adminUserId: userId } });
      if (rpcError) throw rpcError;
      setNotice(`${TEAMS.find(t=>t.key===team)?.label} · ${gender} team admin assigned.`); await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not assign team admin.'); }
    finally { setBusy(''); }
  };

  return <details className="mb-4 rounded-2xl border border-[#E2D9C8] bg-[#FBF7EF] shadow-sm"><summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4"><span><span className="flex items-center gap-2 font-bold text-[#1F2421]"><MessageCircle className="h-4 w-4 text-[#56866B]"/>Team settings · Male / Female</span><span className="mt-1 block text-xs text-[#716D64]">Each workspace has independent Male and Female support contacts and scoped team admins.</span></span><ChevronDown className="h-4 w-4 text-[#716D64]"/></summary><div className="border-t border-[#E2D9C8] p-4">
    <div className="mb-3 flex justify-end"><button onClick={()=>void load()} disabled={loading} className="rounded-xl border border-[#E2D9C8] bg-white p-2 text-[#716D64] disabled:opacity-50" aria-label="Refresh team/gender settings"><RefreshCw className={`h-4 w-4 ${loading?'animate-spin':''}`}/></button></div>
    {error&&<p role="alert" className="mb-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">{error}</p>}{notice&&<p role="status" className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">{notice}</p>}
    {loading ? <p className="p-6 text-center text-sm text-slate-500">Loading scoped team settings…</p> : <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{visibleTeams.map(team=>visibleGenders.map(gender=>{const key=scopeKey(team.key,gender.key);const draft=drafts[key]||{number:'',label:''};return <form key={key} onSubmit={e=>{e.preventDefault();void saveContact(team.key,gender.key);}} className="rounded-xl border border-[#E2D9C8] bg-white p-3"><label className="block text-xs font-bold text-[#1F2421]">{team.label} · {gender.label}</label><label className="mt-2 block text-[11px] font-semibold text-slate-600">WhatsApp number<input value={draft.number} onChange={e=>setDrafts(old=>({...old,[key]:{...draft,number:e.target.value}}))} placeholder="+33… / +92…" inputMode="tel" className="mt-1 min-h-10 w-full rounded-lg border border-[#E2D9C8] px-3 text-sm" disabled={busy===`contact:${key}`}/></label><label className="mt-2 block text-[11px] font-semibold text-slate-600">Support label<input value={draft.label} onChange={e=>setDrafts(old=>({...old,[key]:{...draft,label:e.target.value}}))} placeholder="Male Checking Support" maxLength={80} className="mt-1 min-h-10 w-full rounded-lg border border-[#E2D9C8] px-3 text-sm" disabled={busy===`contact:${key}`}/></label><button type="submit" disabled={!!busy} className="mt-3 inline-flex min-h-9 w-full items-center justify-center gap-2 rounded-lg bg-[#2A2723] px-3 text-xs font-bold text-white disabled:opacity-40"><Save className="h-3.5 w-3.5"/>{busy===`contact:${key}`?'Saving…':'Save contact'}</button>{isAdmin&&<div className="mt-3 border-t border-slate-100 pt-3"><label className="block text-[11px] font-semibold text-slate-600">Team admin<select value={leadDrafts[key]||''} onChange={e=>setLeadDrafts(old=>({...old,[key]:e.target.value}))} className="mt-1 min-h-10 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs"><option value="">Choose admin…</option>{admins.filter(a=>a.gender_group===gender.key).map(a=><option key={a.user_id} value={a.user_id}>{a.display_name||a.email} · {a.email}</option>)}</select></label><button type="button" onClick={()=>void saveLead(team.key,gender.key)} disabled={!!busy||!(leadDrafts[key]||'')} className="mt-2 inline-flex min-h-9 w-full items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-700 disabled:opacity-40"><ShieldCheck className="h-3.5 w-3.5"/>{busy===`lead:${key}`?'Assigning…':'Assign admin'}</button></div>}</form>}))}</div>}
    <p className="mt-3 text-[11px] leading-5 text-[#716D64]">These settings use a separate team/gender scope. Apply the companion Supabase migration before using this panel; existing shared contact settings remain preserved.</p></div>
  </details>;
};
