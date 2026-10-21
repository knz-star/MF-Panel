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
    const pdf = await PDFDocument.create();
    const page = pdf.addPage([595.28, 841.89]);
    const canvas = document.createElement('canvas'); canvas.width = 1190; canvas.height = 1684;
    const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('PDF canvas is unavailable.');
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#0f172a'; ctx.textAlign = 'center'; ctx.direction = 'ltr';
    ctx.font = 'bold 46px Arial'; ctx.fillText(`${organizationName} — USER PLEDGE`, 595, 105);
    ctx.fillStyle = '#2563eb'; ctx.fillRect(100, 135, 990, 4);
    ctx.fillStyle = '#1e293b'; ctx.textAlign = 'right'; ctx.direction = 'rtl';
    ctx.font = 'bold 40px "Noto Nastaliq Urdu", "Noto Naskh Arabic", serif'; ctx.fillText('عہد نامہ اور اقرار', 1090, 220);
    const pledge = `${pledgeText}\nنام: ${name.trim()}۔ تاریخ: ${date}۔`;
    const marginPx = Math.max(70, Math.min(160, pdfMarginSize * 4));
    const maxWidth = 1190 - marginPx * 2;
    const bodyTop = 300; const bodyBottom = 980;
    let bodyFontSize = Math.max(12, Math.min(42, pdfFontSize * 1.35));
    const makeLines = (size: number) => { ctx.font = `${size}px "Noto Nastaliq Urdu", "Noto Naskh Arabic", serif`; const lines: string[] = []; for (const paragraph of pledge.split('\n')) { let line = ''; for (const word of paragraph.split(/\s+/)) { const candidate = line ? `${line} ${word}` : word; if (ctx.measureText(candidate).width > maxWidth && line) { lines.push(line); line = word; } else line = candidate; } if (line) lines.push(line); } return lines; };
    let bodyLines = makeLines(bodyFontSize);
    while (bodyFontSize > 12 && bodyLines.length * bodyFontSize * pdfLineSpacing > bodyBottom - bodyTop) { bodyFontSize -= 1; bodyLines = makeLines(bodyFontSize); }
    ctx.textAlign = 'right'; ctx.direction = 'rtl'; ctx.fillStyle = '#1e293b';
    let y = bodyTop; const lineHeight = bodyFontSize * pdfLineSpacing;
    for (const bodyLine of bodyLines) { if (y > bodyBottom) break; ctx.fillText(bodyLine, 1190 - marginPx, y, maxWidth); y += lineHeight; }
    ctx.fillStyle = '#64748b'; ctx.textAlign = 'center'; ctx.direction = 'ltr'; ctx.font = '24px Arial';
    ctx.fillText('The account remains pending until administrator review.', 595, 1450);
    ctx.strokeStyle = '#cbd5e1'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(90, 1190); ctx.lineTo(535, 1190); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(655, 1190); ctx.lineTo(1100, 1190); ctx.stroke();
    ctx.fillStyle = '#0f172a'; ctx.textAlign = 'center'; ctx.font = 'italic 42px cursive'; ctx.fillText(name.trim(), 312, 1140);
    ctx.font = 'bold 24px Arial'; ctx.fillText('USER SIGNATURE', 312, 1240); ctx.fillText(signatureName.slice(0, 42), 877, 1240);
    ctx.font = '22px Arial'; ctx.fillStyle = '#475569'; ctx.fillText(`Date: ${date}`, 312, 1290); ctx.fillText(organizationName.slice(0, 48), 877, 1290);
    try {
      const { data: assetRows, error: assetError } = await supabase.from('mfp_documents').select('data').eq('collection_name', 'landingAssets').limit(100);
      if (!assetError) {
        const asset = (assetRows ?? []).map((r: any) => r.data ?? {}).find((d: any) => d.assetType === 'signature' && d.isActive === true && typeof d.imageUrl === 'string' && d.imageUrl);
        if (asset?.imageUrl) {
          const response = await fetch(asset.imageUrl, { mode: 'cors' });
          if (response.ok) { const image = await createImageBitmap(await response.blob()); ctx.drawImage(image, 700, 1050, 350, 110); image.close(); }
        }
      }
    } catch (assetError) { console.warn('Official pledge signature image unavailable; PDF includes its signature line.', assetError); }
    const png = await canvasToPng(canvas);
    const image = await pdf.embedPng(png);
    page.drawImage(image, { x: 0, y: 0, width: page.getWidth(), height: page.getHeight() });
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
