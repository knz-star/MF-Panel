import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Download, FileCheck2, ShieldCheck } from 'lucide-react';
import { useAuth } from './AuthContext';
import { supabase } from '../../lib/supabase';

const pledgeText = (name: string, date: string) => `MF MPANEL — عہد نامہ\n\nمیں ${name} اقرار کرتا/کرتی ہوں کہ میں مجھے تفویض کردہ ٹیم کے قواعد، رازداری، ثبوت کے درست استعمال، اور معلومات کی حفاظت کی پابندی کروں گا/گی۔ میں جعلی ریکارڈ، غیر مجاز رسائی یا کام کے نتائج میں ردوبدل نہیں کروں گا/گی۔ میں سمجھتا/سمجھتی ہوں کہ میری رسائی انتظامیہ کی منظوری اور تفویض کردہ ٹیموں کے مطابق ہوگی۔\n\nنام/دستخط: ${name}\nتاریخ: ${date}\n\nحیثیت: انتظامی جائزے کے منتظر`;

export const PledgePage: React.FC = () => {
  const { currentUser, userProfile, refreshProfile, isAdmin } = useAuth();
  const [name, setName] = useState(userProfile?.displayName || currentUser?.displayName || '');
  const [accepted, setAccepted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const download = () => {
    const text = pledgeText(name.trim(), new Date().toLocaleDateString('ur-PK'));
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `MF-MPanel-Pledge-${currentUser?.uid ?? 'user'}.txt`; a.click(); URL.revokeObjectURL(url);
  };
  const submit = async () => {
    if (!currentUser || !name.trim() || !accepted) return;
    setSaving(true); setError('');
    try {
      const { data: prior, error: readError } = await supabase.from('mfp_documents').select('data').eq('collection_name', 'users').eq('document_id', currentUser.uid).maybeSingle();
      if (readError) throw readError;
      if (!prior) throw new Error('User profile document is missing.');
      const nextData = { ...(prior.data ?? {}), uid: currentUser.uid, email: currentUser.email, displayName: name.trim(), pledgeAccepted: true, pledgeSignature: name.trim(), pledgeAcceptedAt: new Date().toISOString(), accountStatus: isAdmin ? 'ACTIVE' : 'PENDING', updatedAt: new Date().toISOString() };
      const { error: saveError } = await supabase.from('mfp_documents').update({ data: nextData, updated_at: new Date().toISOString() }).eq('collection_name', 'users').eq('document_id', currentUser.uid);
      if (saveError) throw saveError;
      await refreshProfile();
      navigate('/select-team', { replace: true });
    } catch (e) {
      console.error('Pledge submission failed', e);
      setError('عہد نامہ محفوظ نہیں ہو سکا۔ دوبارہ کوشش کریں یا منتظم سے رابطہ کریں۔');
    } finally { setSaving(false); }
  };
  return <main className="min-h-screen bg-[#f5f5f7] px-4 py-10"><section className="mx-auto max-w-2xl rounded-[28px] border border-white bg-white/95 p-6 shadow-[0_24px_70px_-35px_rgba(15,23,42,.28)] sm:p-9"><Link to="/" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700"><span className="grid h-9 w-9 place-items-center rounded-xl bg-slate-950 text-white">MF</span> MF MPanel</Link><div className="mt-7 flex items-center gap-3"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-blue-50 text-blue-700"><ShieldCheck className="h-6 w-6"/></span><div><p className="text-xs font-semibold uppercase tracking-widest text-blue-700">عہد نامہ / User pledge</p><h1 className="mt-1 text-2xl font-bold text-slate-950">عہد نامہ اور دستخط</h1></div></div><p dir="rtl" className="mt-5 rounded-2xl border border-slate-100 bg-slate-50 p-5 text-right font-[Noto_Nastaliq_Urdu] text-lg leading-9 text-slate-800">میں اقرار کرتا/کرتی ہوں کہ میں اپنی ذمہ داری دیانت داری سے ادا کروں گا/گی، صرف مجاز ٹیم اور کام تک رسائی استعمال کروں گا/گی، اور کسی بھی ریکارڈ یا ثبوت میں غیر مجاز تبدیلی نہیں کروں گا/گی۔ میری درخواست انتظامیہ کے جائزے اور منظوری کے بعد ہی فعال ہوگی۔</p><label className="mt-6 block text-sm font-semibold text-slate-700">پورا نام — یہی آپ کے دستخط ہوں گے<input value={name} onChange={e=>setName(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 font-[cursive] text-xl outline-none focus:border-blue-600" placeholder="اپنا پورا نام لکھیں" /></label><div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-white p-5"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Signature preview</p><p className="mt-3 break-words font-[cursive] text-3xl text-slate-900">{name || 'Your signature'}</p></div><label className="mt-5 flex items-start gap-3 text-sm leading-6 text-slate-700"><input type="checkbox" checked={accepted} onChange={e=>setAccepted(e.target.checked)} className="mt-1 h-4 w-4"/><span>میں نے عہد نامہ پڑھ لیا ہے اور اس کی پابندی سے اتفاق کرتا/کرتی ہوں۔</span></label>{error && <p role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}<div className="mt-6 grid gap-3 sm:grid-cols-2"><button type="button" onClick={download} disabled={!name.trim()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 disabled:opacity-50"><Download className="h-4 w-4"/> Download copy</button><button type="button" onClick={()=>void submit()} disabled={!name.trim()||!accepted||saving} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white disabled:opacity-50"><FileCheck2 className="h-4 w-4"/>{saving?'Submitting…':'Submit for admin review'}</button></div><p className="mt-5 text-xs leading-5 text-slate-500">آپ کی درخواست منتظم کے جائزے تک Pending رہے گی۔ منظوری کے بعد ہی ٹیم ورک اسپیس دستیاب ہوں گے۔</p></section></main>;
};
