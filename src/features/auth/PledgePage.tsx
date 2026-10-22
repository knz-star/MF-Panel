import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Download, FileCheck2, ShieldCheck } from 'lucide-react';
import { PDFDocument } from 'pdf-lib';
import { useAuth } from './AuthContext';
import { supabase } from '../../lib/supabase';
import { db, doc, getDoc } from '../../lib/supabaseDocumentStore';

const DEFAULT_PLEDGE_TEXT = `میں اقرار کرتا/کرتی ہوں کہ میں اپنی ذمہ داری دیانت داری سے ادا کروں گا/گی، صرف مجاز ٹیم اور کام تک رسائی استعمال کروں گا/گی، اور کسی بھی ریکارڈ یا ثبوت میں غیر مجاز تبدیلی نہیں کروں گا/گی۔ میری درخواست انتظامیہ کے جائزے اور منظوری کے بعد ہی فعال ہوگی۔`;

async function canvasToPng(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error('Could not render PDF page.')), 'image/png'));
  return new Uint8Array(await blob.arrayBuffer());
}

export const PledgePage: React.FC = () => {
  const { currentUser, userProfile, refreshProfile } = useAuth();
  const [name, setName] = useState(userProfile?.displayName || currentUser?.displayName || '');
  const [pledgeText, setPledgeText] = useState(DEFAULT_PLEDGE_TEXT);
  const [organizationName, setOrganizationName] = useState('MF MPanel');
  const [signatureName, setSignatureName] = useState('Authorized Organization Signature');
  const [pdfFontSize, setPdfFontSize] = useState(30);
  const [pdfLineSpacing, setPdfLineSpacing] = useState(1.65);
  const [pdfMarginSize, setPdfMarginSize] = useState(24);
  useEffect(() => { let active = true; void getDoc(doc(db, 'siteSettings', 'pledge')).then((snap) => { if (!active || !snap.exists()) return; const data = snap.data() ?? {}; if (typeof data.pledgeText === 'string') setPledgeText(data.pledgeText); if (typeof data.organizationName === 'string') setOrganizationName(data.organizationName); if (typeof data.signatureName === 'string') setSignatureName(data.signatureName); if (Number.isFinite(Number(data.fontSize))) setPdfFontSize(Math.min(30, Math.max(12, Number(data.fontSize)))); if (Number.isFinite(Number(data.lineSpacing))) setPdfLineSpacing(Math.min(2.2, Math.max(1.2, Number(data.lineSpacing)))); if (Number.isFinite(Number(data.marginSize))) setPdfMarginSize(Math.min(40, Math.max(12, Number(data.marginSize)))); }).catch((e) => console.warn('Pledge settings unavailable; using defaults.', e)); return () => { active = false; }; }, []);
  const [accepted, setAccepted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const download = async () => {
    if (!name.trim()) return;
    const date = new Date().toLocaleDateString('ur-PK');
    const refId = `MFP-${(currentUser?.uid ?? 'user').slice(0, 8).toUpperCase()}-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`;
    const W = 1190, H = 1684;
    const pdf = await PDFDocument.create();
    const page = pdf.addPage([595.28, 841.89]);
    const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('PDF canvas is unavailable.');
    const URDU = '"Noto Nastaliq Urdu","Noto Naskh Arabic","Segoe UI",serif';
    const LATIN = '-apple-system,"SF Pro Text","Segoe UI",Helvetica,Arial,sans-serif';
    // Page + double frame
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = '#0b1b34'; ctx.lineWidth = 4; ctx.strokeRect(40, 40, W - 80, H - 80);
    ctx.strokeStyle = '#10b981'; ctx.lineWidth = 1.5; ctx.strokeRect(54, 54, W - 108, H - 108);
    // Header band
    ctx.fillStyle = '#0b1b34'; ctx.fillRect(54, 54, W - 108, 190);
    ctx.fillStyle = '#10b981'; ctx.fillRect(54, 244, W - 108, 6);
    ctx.direction = 'ltr'; ctx.textAlign = 'center'; ctx.fillStyle = '#94a3b8'; ctx.font = `600 22px ${LATIN}`;
    ctx.fillText(organizationName.toUpperCase(), W / 2, 112);
    ctx.fillStyle = '#ffffff'; ctx.font = `700 52px ${LATIN}`; ctx.fillText('USER PLEDGE', W / 2, 176);
    ctx.fillStyle = '#6ee7b7'; ctx.direction = 'rtl'; ctx.font = `700 40px ${URDU}`; ctx.fillText('عہد نامہ اور اقرار', W / 2, 226);
    // Reference row
    ctx.direction = 'ltr'; ctx.fillStyle = '#64748b'; ctx.font = `500 21px ${LATIN}`;
    ctx.textAlign = 'left'; ctx.fillText(`Ref: ${refId}`, 110, 304);
    ctx.textAlign = 'right'; ctx.fillText(`Date: ${date}`, W - 110, 304);
    // Name card
    ctx.fillStyle = '#f1f5f9'; ctx.beginPath(); ctx.roundRect(110, 332, W - 220, 96, 20); ctx.fill();
    ctx.fillStyle = '#64748b'; ctx.textAlign = 'left'; ctx.font = `500 19px ${LATIN}`; ctx.fillText('DECLARANT', 140, 372);
    ctx.fillStyle = '#0f172a'; ctx.font = `700 34px ${LATIN}`; ctx.fillText(name.trim().slice(0, 48), 140, 411);
    // Body card
    const bodyTop = 470, bodyBottom = 1130, marginPx = Math.max(150, Math.min(220, pdfMarginSize * 4 + 60));
    ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#e2e8f0'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(110, bodyTop - 20, W - 220, bodyBottom - bodyTop + 60, 24); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#10b981'; ctx.fillRect(W - 110 - 8, bodyTop + 10, 8, 120);
    const maxWidth = W - marginPx * 2;
    let size = Math.max(14, Math.min(42, pdfFontSize * 1.3));
    const makeLines = (px: number) => { ctx.font = `${px}px ${URDU}`; const out: string[] = []; for (const para of pledgeText.split('\n')) { let line = ''; for (const word of para.split(/\s+/)) { const cand = line ? `${line} ${word}` : word; if (ctx.measureText(cand).width > maxWidth && line) { out.push(line); line = word; } else line = cand; } if (line) out.push(line); } return out; };
    let lines = makeLines(size);
    while (size > 14 && lines.length * size * pdfLineSpacing > bodyBottom - bodyTop - 20) { size -= 1; lines = makeLines(size); }
    ctx.font = `${size}px ${URDU}`; ctx.fillStyle = '#1e293b'; ctx.direction = 'rtl'; ctx.textAlign = 'right';
    let y = bodyTop + 40; for (const l of lines) { if (y > bodyBottom) break; ctx.fillText(l, W - marginPx, y, maxWidth); y += size * pdfLineSpacing; }
    // Signature blocks
    ctx.direction = 'ltr'; ctx.strokeStyle = '#94a3b8'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(130, 1380); ctx.lineTo(520, 1380); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(670, 1380); ctx.lineTo(1060, 1380); ctx.stroke();
    ctx.textAlign = 'center'; ctx.fillStyle = '#0f172a'; ctx.font = 'italic 44px cursive'; ctx.fillText(name.trim().slice(0, 28), 325, 1355);
    ctx.font = `700 21px ${LATIN}`; ctx.fillText('USER SIGNATURE', 325, 1420); ctx.fillText(signatureName.slice(0, 36).toUpperCase(), 865, 1420);
    ctx.font = `400 20px ${LATIN}`; ctx.fillStyle = '#475569'; ctx.fillText(date, 325, 1456); ctx.fillText(organizationName.slice(0, 44), 865, 1456);
    try {
      const { data: assetRows, error: assetError } = await supabase.from('mfp_documents').select('data').eq('collection_name', 'landingAssets').limit(100);
      if (!assetError) {
        const asset = (assetRows ?? []).map((r: any) => r.data ?? {}).find((d: any) => d.assetType === 'signature' && d.isActive === true && typeof d.imageUrl === 'string' && d.imageUrl);
        if (asset?.imageUrl) {
          const response = await fetch(asset.imageUrl, { mode: 'cors' });
          if (response.ok) { const image = await createImageBitmap(await response.blob()); ctx.drawImage(image, 690, 1275, 350, 100); image.close(); }
        }
      }
    } catch (assetError) { console.warn('Official pledge signature image unavailable; PDF includes its signature line.', assetError); }
    // Footer
    ctx.fillStyle = '#64748b'; ctx.font = `400 19px ${LATIN}`; ctx.textAlign = 'center';
    ctx.fillText('The account remains pending until administrator review.', W / 2, 1560);
    const png = await canvasToPng(canvas);
    const image = await pdf.embedPng(png);
    page.drawImage(image, { x: 0, y: 0, width: page.getWidth(), height: page.getHeight() });
    pdf.setTitle(`${organizationName} — User Pledge`); pdf.setProducer('MF MPanel');
    const bytes = await pdf.save();
    const pdfBuffer = new ArrayBuffer(bytes.byteLength); new Uint8Array(pdfBuffer).set(bytes);
    const blob = new Blob([pdfBuffer], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `MF-MPanel-Pledge-${currentUser?.uid ?? 'user'}.pdf`; document.body.appendChild(a); a.click(); a.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const submit = async () => {
    if (!currentUser || !name.trim() || !accepted) return;
    setSaving(true); setError('');
    try {
      const { error: saveError } = await supabase.rpc('mfp_save_pledge', { p_signature: name.trim() });
      if (saveError) throw saveError;
      await refreshProfile();
      navigate('/dashboard', { replace: true });
    } catch (e) {
      console.error('Pledge submission failed', e);
      setError('عہد نامہ محفوظ نہیں ہو سکا۔ دوبارہ کوشش کریں یا منتظم سے رابطہ کریں۔');
    } finally { setSaving(false); }
  };
  return <main className="min-h-screen bg-[#f5f5f7] px-4 py-10"><section className="mx-auto max-w-2xl rounded-[28px] border border-white bg-white/95 p-6 shadow-[0_24px_70px_-35px_rgba(15,23,42,.28)] sm:p-9"><Link to="/" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700"><span className="grid h-9 w-9 place-items-center rounded-xl bg-slate-950 text-white">MF</span> {organizationName}</Link><div className="mt-7 flex items-center gap-3"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-blue-50 text-blue-700"><ShieldCheck className="h-6 w-6"/></span><div><p className="text-xs font-semibold uppercase tracking-widest text-blue-700">عہد نامہ / User pledge</p><h1 className="mt-1 text-2xl font-bold text-slate-950">عہد نامہ اور دستخط</h1></div></div><p dir="rtl" className="mt-5 whitespace-pre-wrap rounded-2xl border border-slate-100 bg-slate-50 p-5 text-right font-[Noto_Nastaliq_Urdu] text-lg leading-9 text-slate-800">{pledgeText}</p><label className="mt-6 block text-sm font-semibold text-slate-700">پورا نام — یہی آپ کے دستخط ہوں گے<input value={name} onChange={e=>setName(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 font-[cursive] text-xl outline-none focus:border-blue-600" placeholder="اپنا پورا نام لکھیں" /></label><div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-white p-5"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Signature preview</p><p className="mt-3 break-words font-[cursive] text-3xl text-slate-900">{name || 'Your signature'}</p><p className="mt-2 text-xs text-slate-500">{signatureName} · {organizationName}</p></div><label className="mt-5 flex items-start gap-3 text-sm leading-6 text-slate-700"><input type="checkbox" checked={accepted} onChange={e=>setAccepted(e.target.checked)} className="mt-1 h-4 w-4"/><span>میں نے عہد نامہ پڑھ لیا ہے اور اس کی پابندی سے اتفاق کرتا/کرتی ہوں۔</span></label>{error && <p role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}<div className="mt-6 grid gap-3 sm:grid-cols-2"><button type="button" onClick={() => void download().catch((e) => { console.error('Pledge PDF generation failed', e); setError('PDF تیار نہیں ہو سکی۔ دوبارہ کوشش کریں۔'); })} disabled={!name.trim()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 disabled:opacity-50"><Download className="h-4 w-4"/> Download PDF</button><button type="button" onClick={()=>void submit()} disabled={!name.trim()||!accepted||saving} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white disabled:opacity-50"><FileCheck2 className="h-4 w-4"/>{saving?'Submitting…':'Submit for admin review'}</button></div><p className="mt-5 text-xs leading-5 text-slate-500">آپ کی درخواست منتظم کے جائزے تک Pending رہے گی۔ منظوری کے بعد ہی ٹیم ورک اسپیس دستیاب ہوں گے۔</p></section></main>;
};
