import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  addDoc, collection, deleteDoc, doc, getDoc, getDocs, onSnapshot, orderBy, query, serverTimestamp, setDoc, updateDoc,
} from '../../lib/supabaseDocumentStore';
import { deleteObject, getDownloadURL, ref, uploadBytes } from '../../lib/supabaseStorageCompat';
import {
  AlertCircle, ArrowDown, ArrowUp, Eye, EyeOff, FileImage, Loader2,
  Pencil, Plus, RefreshCw, Save, Search, Smartphone, Trash2, Upload, X,
} from 'lucide-react';
import { auth, db, storage } from '../../lib/backend';

type AssetType = 'logo' | 'partner' | 'client' | 'icon' | 'banner' | 'signature' | 'other';
type AssetRecord = {
  id: string;
  name: string;
  imageUrl: string;
  altText: string;
  assetType: AssetType;
  gradientStart: string | null;
  gradientEnd: string | null;
  invertOnHover: boolean;
  displayOrder: number;
  isActive: boolean;
  storagePath?: string;
  createdBy?: string;
};

type Draft = Omit<AssetRecord, 'id' | 'storagePath' | 'createdBy'> & { id?: string; storagePath?: string; imageFile?: File | null };
const EMPTY: Draft = {
  name: '', imageUrl: '', altText: '', assetType: 'logo', gradientStart: '', gradientEnd: '',
  invertOnHover: false, displayOrder: 0, isActive: true, imageFile: null,
};
const ALLOWED_TYPES = ['image/svg+xml', 'image/png', 'image/jpeg', 'image/webp', 'image/gif'];
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const ASSET_COLLECTION = 'landingAssets';

function LandingVideoSettings() {
  const [videoUrl, setVideoUrl] = useState('');
  const [loadingVideo, setLoadingVideo] = useState(true);
  const [savingVideo, setSavingVideo] = useState(false);
  const [videoMessage, setVideoMessage] = useState('');
  useEffect(() => {
    let active = true;
    void getDoc(doc(db, 'siteSettings', 'landing')).then((snap) => {
      if (active) setVideoUrl(typeof snap.data()?.heroVideoUrl === 'string' ? snap.data().heroVideoUrl : 'https://videotourl.com/videos/1791950139712-479a96d1-85cd-49ac-b099-3f19603ca56e.mp4');
    }).catch((e) => { if (active) setVideoMessage(errorText(e)); }).finally(() => { if (active) setLoadingVideo(false); });
    return () => { active = false; };
  }, []);
  const saveVideo = async () => {
    let parsed: URL;
    try { parsed = new URL(videoUrl.trim()); } catch { setVideoMessage('Valid video URL enter karein.'); return; }
    if (!['https:', 'http:'].includes(parsed.protocol)) { setVideoMessage('Video URL http:// ya https:// se start honi chahiye.'); return; }
    setSavingVideo(true); setVideoMessage('');
    try {
      await setDoc(doc(db, 'siteSettings', 'landing'), { heroVideoUrl: parsed.href, updatedAt: serverTimestamp(), updatedBy: auth.currentUser?.uid ?? null }, { merge: true });
      setVideoUrl(parsed.href); setVideoMessage('Landing video setting saved. Public page par reload karke verify karein.');
    } catch (e) { setVideoMessage(errorText(e)); } finally { setSavingVideo(false); }
  };
  return <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6"><div className="flex items-start gap-3"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-700"><Smartphone className="h-5 w-5" /></div><div className="min-w-0 flex-1"><h2 className="font-semibold text-slate-950">Landing page hero video</h2><p className="mt-1 text-sm leading-5 text-slate-500">Admin yahan se public landing page ki background video change kar sakta hai. Publicly accessible direct video URL use karein (MP4/WebM).</p></div></div><label className="mt-4 block text-sm font-medium text-slate-700">Video URL<input disabled={loadingVideo} value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-200 px-3 text-sm font-normal outline-none focus:border-blue-500" placeholder="https://example.com/hero-video.mp4" /></label><div className="mt-3 flex flex-wrap items-center gap-3"><button type="button" onClick={() => void saveVideo()} disabled={loadingVideo || savingVideo || !videoUrl.trim()} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-blue-700 px-4 text-sm font-semibold text-white disabled:opacity-50">{savingVideo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{savingVideo ? 'Saving…' : 'Save video URL'}</button><a href={videoUrl || '#'} target="_blank" rel="noreferrer" className="text-sm font-medium text-blue-700 underline underline-offset-2">Open video URL</a></div>{videoMessage && <p role="status" className="mt-3 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-700">{videoMessage}</p>}</section>;
}

function validateImageUrl(raw: string): string {
  const parsed = new URL(raw.trim());
  if (!['https:', 'http:'].includes(parsed.protocol)) throw new Error('Image URL must start with http:// or https://.');
  return parsed.href;
}

async function verifyImage(url: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve();
    image.onerror = () => reject(new Error('Image preview failed. Check that the URL points to an accessible image.'));
    image.referrerPolicy = 'no-referrer';
    image.src = url;
  });
}

function errorText(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes('permission-denied')) return 'Supabase denied this action. Confirm your signed-in account is an authorized administrator and verify RLS policies.';
  if (message.includes('storage/unauthorized')) return 'Supabase Storage denied the upload. Confirm the mfp-assets bucket and admin Storage policies.';
  return message;
}

const DEFAULT_PLEDGE_TEXT = 'میں اقرار کرتا/کرتی ہوں کہ میں اپنی ذمہ داری دیانت داری سے ادا کروں گا/گی، صرف مجاز ٹیم اور کام تک رسائی استعمال کروں گا/گی، اور کسی بھی ریکارڈ یا ثبوت میں غیر مجاز تبدیلی نہیں کروں گا/گی۔ میری درخواست انتظامیہ کے جائزے اور منظوری کے بعد ہی فعال ہوگی۔';

function PledgeDocumentSettings() {
  const [pledgeText, setPledgeText] = useState(DEFAULT_PLEDGE_TEXT);
  const [organizationName, setOrganizationName] = useState('MF MPanel');
  const [signatureName, setSignatureName] = useState('Authorized Organization Signature');
  const [fontSize, setFontSize] = useState(18);
  const [lineSpacing, setLineSpacing] = useState(1.65);
  const [marginSize, setMarginSize] = useState(24);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => {
    let active = true;
    void getDoc(doc(db, 'siteSettings', 'pledge')).then((snap) => {
      if (!active || !snap.exists()) return;
      const data = snap.data() ?? {};
      if (typeof data.pledgeText === 'string') setPledgeText(data.pledgeText);
      if (typeof data.organizationName === 'string') setOrganizationName(data.organizationName);
      if (typeof data.signatureName === 'string') setSignatureName(data.signatureName);
      if (Number.isFinite(Number(data.fontSize))) setFontSize(Math.min(30, Math.max(12, Number(data.fontSize))));
      if (Number.isFinite(Number(data.lineSpacing))) setLineSpacing(Math.min(2.2, Math.max(1.2, Number(data.lineSpacing))));
      if (Number.isFinite(Number(data.marginSize))) setMarginSize(Math.min(40, Math.max(12, Number(data.marginSize))));
    }).catch((error) => { if (active) setMessage(errorText(error)); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  const save = async () => {
    if (!pledgeText.trim() || !organizationName.trim() || !signatureName.trim()) { setMessage('Full pledge text, organization name, and signature label are required.'); return; }
    setSaving(true); setMessage('');
    try {
      await setDoc(doc(db, 'siteSettings', 'pledge'), { pledgeText: pledgeText.trim(), organizationName: organizationName.trim(), signatureName: signatureName.trim(), fontSize, lineSpacing, marginSize, updatedAt: serverTimestamp(), updatedBy: auth.currentUser?.uid ?? null }, { merge: true });
      setMessage('Document settings saved. The preview and newly generated pledge PDFs use these layout settings.');
    } catch (error) { setMessage(errorText(error)); } finally { setSaving(false); }
  };
  const previewBody = `${pledgeText.trim()}\n\nنام: ____________________    تاریخ: ______________`;
  return <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
    <div className="flex items-start gap-3"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><FileImage className="h-5 w-5"/></div><div><h2 className="font-semibold text-slate-950">عہد نامہ — PDF Designer & Live Preview</h2><p className="mt-1 text-sm leading-5 text-slate-500">Text, organization/team name, signature label, font size, line spacing aur page margins adjust karein. Preview A4 one-page layout ko approximate karta hai; bohat lambi tahreer par font ko chhota karein.</p></div></div>
    <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(300px,0.85fr)]">
      <div className="space-y-4">
        <label className="block text-sm font-medium text-slate-700">Organization / team name<input value={organizationName} onChange={(e)=>setOrganizationName(e.target.value)} maxLength={160} disabled={loading} className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-200 px-3 text-sm font-normal" placeholder="Your organization or team name"/></label>
        <label className="block text-sm font-medium text-slate-700">Official signature name / label<input value={signatureName} onChange={(e)=>setSignatureName(e.target.value)} maxLength={160} disabled={loading} className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-200 px-3 text-sm font-normal" placeholder="Authorized signature name"/></label>
        <label className="block text-sm font-medium text-slate-700">Complete Urdu pledge text<textarea value={pledgeText} onChange={(e)=>setPledgeText(e.target.value)} rows={6} maxLength={12000} disabled={loading} dir="rtl" lang="ur" className="mt-1.5 w-full rounded-xl border border-slate-200 p-3 text-right text-sm font-normal leading-8" placeholder="Mukammal Urdu halaf / tahreer yahan likhein"/></label>
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block text-xs font-semibold text-slate-600">Font size <span className="float-right tabular-nums">{fontSize}px</span><input type="range" min="12" max="30" value={fontSize} onChange={e=>setFontSize(Number(e.target.value))} className="mt-3 w-full"/></label>
          <label className="block text-xs font-semibold text-slate-600">Line spacing <span className="float-right tabular-nums">{lineSpacing.toFixed(2)}×</span><input type="range" min="1.2" max="2.2" step="0.05" value={lineSpacing} onChange={e=>setLineSpacing(Number(e.target.value))} className="mt-3 w-full"/></label>
          <label className="block text-xs font-semibold text-slate-600">Page margins <span className="float-right tabular-nums">{marginSize}mm</span><input type="range" min="12" max="40" value={marginSize} onChange={e=>setMarginSize(Number(e.target.value))} className="mt-3 w-full"/></label>
        </div>
        <button type="button" onClick={()=>void save()} disabled={loading||saving} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white disabled:opacity-50">{saving?<Loader2 className="h-4 w-4 animate-spin"/>:<Save className="h-4 w-4"/>}{saving?'Saving…':'Save document design'}</button>
        {message&&<p role="status" className="rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-700">{message}</p>}
      </div>
      <div className="min-w-0 rounded-2xl bg-slate-100 p-3 sm:p-5">
        <div className="mb-3 flex items-center justify-between gap-2"><p className="text-xs font-bold uppercase tracking-wider text-slate-500">Live A4 preview</p><span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-semibold text-slate-600">1 page</span></div>
        <article className="mx-auto flex aspect-[210/297] w-full max-w-[420px] flex-col overflow-hidden bg-white text-slate-900 shadow-xl" style={{padding:`${marginSize/2.5}%`}}>
          <div className="border-b-2 border-emerald-700 pb-3 text-center"><p className="text-[9px] font-bold uppercase tracking-[0.16em] text-emerald-800">{organizationName || 'Organization / Team'}</p><h3 className="mt-2 text-base font-bold">عہد نامہ اور اقرار</h3><p className="mt-1 text-[8px] text-slate-500">OFFICIAL PLEDGE & DECLARATION</p></div>
          <div dir="rtl" lang="ur" className="mt-4 flex-1 overflow-hidden whitespace-pre-wrap break-words text-right text-slate-800" style={{fontFamily:'"Noto Nastaliq Urdu", "Noto Naskh Arabic", serif',fontSize:`${Math.max(7,fontSize*0.55)}px`,lineHeight:lineSpacing}}>{previewBody}</div>
          <div className="mt-4 grid grid-cols-2 gap-4 border-t border-slate-200 pt-4 text-center"><div className="border-t border-slate-400 pt-2"><p className="text-[8px] font-semibold">دستخط / Signature</p><p className="mt-1 break-words text-[8px]">User</p></div><div className="border-t border-slate-400 pt-2"><p className="text-[8px] font-semibold">مجاز دستخط</p><p className="mt-1 break-words text-[8px]">{signatureName || 'Signature label'}</p></div></div>
          <p className="mt-3 text-center text-[7px] text-slate-400">{organizationName || 'Organization'} · Official Record</p>
        </article>
        <p className="mx-auto mt-3 max-w-[420px] text-[11px] leading-5 text-slate-500">Tip: agar text neeche se cut hota nazar aaye, font size ya line spacing kam karein. Preview changes are not saved until you press Save.</p>
      </div>
    </div>
  </section>;
}

export const AdminAssetsPage: React.FC = () => {
  const [assets, setAssets] = useState<AssetRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewOk, setPreviewOk] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<AssetRecord | null>(null);

  useEffect(() => {
    const q = query(collection(db, ASSET_COLLECTION), orderBy('displayOrder', 'asc'));
    return onSnapshot(q, (snapshot) => {
      const next = snapshot.docs.map((item) => {
        const data = item.data();
        return {
          id: item.id,
          name: typeof data.name === 'string' ? data.name : '',
          imageUrl: typeof data.imageUrl === 'string' ? data.imageUrl : '',
          altText: typeof data.altText === 'string' ? data.altText : '',
          assetType: (['logo', 'partner', 'client', 'icon', 'banner', 'signature', 'other'].includes(data.assetType) ? data.assetType : 'other') as AssetType,
          gradientStart: typeof data.gradientStart === 'string' ? data.gradientStart : null,
          gradientEnd: typeof data.gradientEnd === 'string' ? data.gradientEnd : null,
          invertOnHover: data.invertOnHover === true,
          displayOrder: typeof data.displayOrder === 'number' ? data.displayOrder : 0,
          isActive: data.isActive === true,
          storagePath: typeof data.storagePath === 'string' ? data.storagePath : undefined,
          createdBy: typeof data.createdBy === 'string' ? data.createdBy : undefined,
        };
      });
      setAssets(next);
      setLoading(false);
    }, (error) => {
      setLoading(false);
      setMessage({ type: 'error', text: errorText(error) });
    });
  }, []);

  const filteredAssets = useMemo(() => {
    const q = search.trim().toLowerCase();
    return assets.filter((asset) => !q || asset.name.toLowerCase().includes(q) || asset.assetType.includes(q) || asset.imageUrl.toLowerCase().includes(q));
  }, [assets, search]);

  const updateDraft = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((current) => current ? { ...current, [key]: value } : current);
    if (key === 'imageUrl') {
      setPreviewOk(false);
      setPreviewError('');
      setPreviewUrl(String(value ?? ''));
    }
  };

  const startNew = () => {
    setMessage(null);
    setPreviewUrl('');
    setPreviewOk(false);
    setPreviewError('');
    setDraft({ ...EMPTY, displayOrder: assets.length ? Math.max(...assets.map((a) => a.displayOrder)) + 1 : 0 });
  };

  const startEdit = (asset: AssetRecord) => {
    setMessage(null);
    setPreviewUrl(asset.imageUrl);
    setPreviewOk(true);
    setPreviewError('');
    setDraft({ ...asset, gradientStart: asset.gradientStart ?? '', gradientEnd: asset.gradientEnd ?? '', imageFile: null });
  };

  const checkPreview = async () => {
    if (!draft) return;
    setPreviewError('');
    setPreviewOk(false);
    try {
      const url = validateImageUrl(draft.imageUrl);
      await verifyImage(url);
      setPreviewUrl(url);
      setPreviewOk(true);
      setMessage({ type: 'success', text: 'Image loaded successfully. You can save this asset.' });
    } catch (error) {
      setPreviewError(errorText(error));
      setMessage({ type: 'error', text: errorText(error) });
    }
  };

  const chooseFile = (file: File | null) => {
    if (!file) return;
    const extension = file.name.split('.').pop()?.toLowerCase();
    const extensionMime: Record<string, string> = { svg: 'image/svg+xml', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif' };
    const detectedMime = ALLOWED_TYPES.includes(file.type) ? file.type : extensionMime[extension ?? ''];
    if (!detectedMime || (file.type && file.type !== detectedMime)) {
      setMessage({ type: 'error', text: 'Unsupported file type. Use SVG, PNG, JPG/JPEG, WEBP, or GIF.' });
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setMessage({ type: 'error', text: 'Image must be 5 MB or smaller.' });
      return;
    }
    setDraft((current) => current ? { ...current, imageFile: new File([file], file.name, { type: detectedMime }) } : current);
    setPreviewUrl(URL.createObjectURL(file));
    setPreviewOk(true);
    setPreviewError('');
  };

  const saveAsset = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!draft) return;
    const user = auth.currentUser;
    if (!user) {
      setMessage({ type: 'error', text: 'Please sign in through Supabase Auth before managing assets.' });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const name = draft.name.trim();
      const altText = draft.altText.trim();
      if (!name || !altText) throw new Error('Display name and alternative text are required.');
      let imageUrl = draft.imageUrl.trim();
      let storagePath = draft.storagePath;
      if (draft.imageFile) {
        const safeName = draft.imageFile.name.replace(/[^a-zA-Z0-9._-]/g, '-').slice(-100);
        storagePath = `landing-assets/${user.uid}/${Date.now()}-${safeName}`;
        const objectRef = ref(storage, storagePath);
        await uploadBytes(objectRef, draft.imageFile, { contentType: draft.imageFile.type, customMetadata: { uploadedBy: user.uid } });
        imageUrl = await getDownloadURL(objectRef);
      } else {
        imageUrl = validateImageUrl(imageUrl);
        if (!previewOk || previewUrl !== imageUrl) await verifyImage(imageUrl);
      }
      const payload = {
        name, imageUrl, altText, assetType: draft.assetType,
        gradientStart: /^#[0-9a-fA-F]{6}$/.test(String(draft.gradientStart)) ? draft.gradientStart : null,
        gradientEnd: /^#[0-9a-fA-F]{6}$/.test(String(draft.gradientEnd)) ? draft.gradientEnd : null,
        invertOnHover: draft.invertOnHover === true,
        displayOrder: Number.isFinite(Number(draft.displayOrder)) ? Number(draft.displayOrder) : 0,
        isActive: draft.isActive === true,
        storagePath: storagePath ?? null,
        updatedAt: serverTimestamp(),
        updatedBy: user.uid,
      };
      if (draft.id) {
        await updateDoc(doc(db, ASSET_COLLECTION, draft.id), payload);
      } else {
        await addDoc(collection(db, ASSET_COLLECTION), { ...payload, createdAt: serverTimestamp(), createdBy: user.uid });
      }
      setDraft(null);
      setPreviewUrl('');
      setMessage({ type: 'success', text: 'Asset saved to Supabase.' });
    } catch (error) {
      setMessage({ type: 'error', text: errorText(error) });
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (asset: AssetRecord) => {
    try {
      await updateDoc(doc(db, ASSET_COLLECTION, asset.id), { isActive: !asset.isActive, updatedAt: serverTimestamp(), updatedBy: auth.currentUser?.uid ?? null });
      setMessage({ type: 'success', text: `${asset.name} is now ${asset.isActive ? 'hidden' : 'active'} on the public landing page.` });
    } catch (error) {
      setMessage({ type: 'error', text: errorText(error) });
    }
  };

  const moveAsset = async (asset: AssetRecord, delta: number) => {
    const sorted = [...assets].sort((a, b) => a.displayOrder - b.displayOrder);
    const index = sorted.findIndex((item) => item.id === asset.id);
    const target = sorted[index + delta];
    if (!target) return;
    try {
      await Promise.all([
        updateDoc(doc(db, ASSET_COLLECTION, asset.id), { displayOrder: target.displayOrder, updatedAt: serverTimestamp(), updatedBy: auth.currentUser?.uid ?? null }),
        updateDoc(doc(db, ASSET_COLLECTION, target.id), { displayOrder: asset.displayOrder, updatedAt: serverTimestamp(), updatedBy: auth.currentUser?.uid ?? null }),
      ]);
      setMessage({ type: 'success', text: 'Asset display order updated.' });
    } catch (error) {
      setMessage({ type: 'error', text: errorText(error) });
    }
  };

  const deleteAsset = async () => {
    if (!confirmDelete) return;
    try {
      await deleteDoc(doc(db, ASSET_COLLECTION, confirmDelete.id));
      if (confirmDelete.storagePath) {
        try { await deleteObject(ref(storage, confirmDelete.storagePath)); } catch { /* document removal is authoritative; orphaned storage can be cleaned up separately */ }
      }
      setConfirmDelete(null);
      setMessage({ type: 'success', text: 'Asset deleted.' });
    } catch (error) {
      setMessage({ type: 'error', text: errorText(error) });
    }
  };

  const refreshAssets = async () => {
    setLoading(true);
    try {
      const snapshot = await getDocs(query(collection(db, ASSET_COLLECTION), orderBy('displayOrder', 'asc')));
      setAssets(snapshot.docs.map((item) => {
        const data = item.data();
        return {
          id: item.id,
          name: typeof data.name === 'string' ? data.name : '',
          imageUrl: typeof data.imageUrl === 'string' ? data.imageUrl : '',
          altText: typeof data.altText === 'string' ? data.altText : '',
          assetType: (['logo', 'partner', 'client', 'icon', 'banner', 'signature', 'other'].includes(data.assetType) ? data.assetType : 'other') as AssetType,
          gradientStart: typeof data.gradientStart === 'string' ? data.gradientStart : null,
          gradientEnd: typeof data.gradientEnd === 'string' ? data.gradientEnd : null,
          invertOnHover: data.invertOnHover === true,
          displayOrder: typeof data.displayOrder === 'number' ? data.displayOrder : 0,
          isActive: data.isActive === true,
          storagePath: typeof data.storagePath === 'string' ? data.storagePath : undefined,
          createdBy: typeof data.createdBy === 'string' ? data.createdBy : undefined,
        };
      }));
      setMessage({ type: 'success', text: 'Asset list refreshed.' });
    } catch (error) {
      setMessage({ type: 'error', text: errorText(error) });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link to="/admin" className="text-xs font-semibold text-slate-500 hover:text-slate-900">← Admin Dashboard</Link>
          <p className="mt-3 text-[11px] font-bold uppercase tracking-[0.18em] text-blue-700">Public site content</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">Landing page assets</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">Manage site visuals, official signature artwork, and the full pledge document. The pledge settings below let you change the complete Urdu text, organization/team name, and signature label used in new PDFs.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => void refreshAssets()} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"><RefreshCw className="h-4 w-4" /> Refresh</button>
          <button onClick={startNew} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800"><Plus className="h-4 w-4" /> Add asset</button>
        </div>
      </header>

      <LandingVideoSettings />
      <PledgeDocumentSettings />

      {message && <div role="status" className={`flex items-start gap-2 rounded-xl border p-3 text-sm ${message.type === 'error' ? 'border-rose-200 bg-rose-50 text-rose-800' : message.type === 'success' ? 'border-blue-200 bg-blue-50 text-blue-800' : 'border-slate-200 bg-slate-50 text-slate-700'}`}><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><span className="min-w-0 break-words">{message.text}</span><button className="ml-auto shrink-0" onClick={() => setMessage(null)} aria-label="Dismiss message"><X className="h-4 w-4" /></button></div>}

      {draft && <form onSubmit={saveAsset} className="space-y-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex items-center justify-between gap-3"><h2 className="text-lg font-semibold text-slate-950">{draft.id ? 'Edit asset' : 'Add asset'}</h2><button type="button" onClick={() => setDraft(null)} aria-label="Close editor" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X className="h-4 w-4" /></button></div>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block text-sm font-medium text-slate-700">Display name<input required value={draft.name} onChange={(e) => updateDraft('name', e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal outline-none focus:border-blue-500" placeholder="Partner logo" /></label>
          <label className="block text-sm font-medium text-slate-700">Asset type<select value={draft.assetType} onChange={(e) => updateDraft('assetType', e.target.value as AssetType)} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 font-normal"><option value="logo">Logo</option><option value="partner">Partner</option><option value="client">Client</option><option value="icon">Icon</option><option value="banner">Site banner</option><option value="signature">Official pledge signature</option><option value="other">Other</option></select></label>
          <label className="block text-sm font-medium text-slate-700 md:col-span-2">Direct image URL<input value={draft.imageUrl} onChange={(e) => updateDraft('imageUrl', e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal outline-none focus:border-blue-500" placeholder="https://example.com/logo.svg" /></label>
          <div className="flex flex-wrap items-center gap-2 md:col-span-2"><button type="button" onClick={checkPreview} disabled={!draft.imageUrl.trim()} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-medium hover:bg-slate-50 disabled:opacity-40"><Eye className="h-4 w-4" /> Validate URL & preview</button><label className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-medium hover:bg-slate-50"><Upload className="h-4 w-4" /> Upload image (max 5 MB)<input type="file" accept=".svg,.png,.jpg,.jpeg,.webp,.gif,image/svg+xml,image/png,image/jpeg,image/webp,image/gif" className="sr-only" onChange={(e) => chooseFile(e.target.files?.[0] ?? null)} /></label><span className="text-xs text-slate-500">Storage upload requires the mfp-assets bucket and admin Storage policies.</span></div>
          {previewUrl && <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 md:col-span-2"><p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Preview</p><div className="flex min-h-28 items-center justify-center overflow-hidden rounded-lg bg-white p-4"><img src={previewUrl} alt="Selected asset preview" className="max-h-32 max-w-full object-contain" onLoad={() => { if (draft.imageFile) setPreviewOk(true); }} onError={() => { setPreviewOk(false); setPreviewError('Image could not be loaded. Check the URL or select another file.'); }} /></div>{previewError && <p className="mt-2 text-xs text-rose-700">{previewError}</p>}{draft.imageFile && <p className="mt-2 text-xs text-blue-700">Selected: {draft.imageFile.name} ({Math.ceil(draft.imageFile.size / 1024)} KB)</p>}</div>}
          <label className="block text-sm font-medium text-slate-700">Alternative text<input required value={draft.altText} onChange={(e) => updateDraft('altText', e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal" placeholder="MF MPanel partner logo" /></label>
          <label className="block text-sm font-medium text-slate-700">Display order<input type="number" value={draft.displayOrder} onChange={(e) => updateDraft('displayOrder', Number(e.target.value))} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal" /></label>
          <label className="block text-sm font-medium text-slate-700">Gradient start (optional)<input value={String(draft.gradientStart ?? '')} onChange={(e) => updateDraft('gradientStart', e.target.value)} placeholder="#00FFC2" pattern="^#[0-9a-fA-F]{6}$" className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-mono font-normal" /></label>
          <label className="block text-sm font-medium text-slate-700">Gradient end (optional)<input value={String(draft.gradientEnd ?? '')} onChange={(e) => updateDraft('gradientEnd', e.target.value)} placeholder="#0A1B33" pattern="^#[0-9a-fA-F]{6}$" className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-mono font-normal" /></label>
          <label className="flex items-center gap-2 text-sm text-slate-700 md:col-span-2"><input type="checkbox" checked={draft.isActive} onChange={(e) => updateDraft('isActive', e.target.checked)} className="h-4 w-4 accent-blue-600" /> Show this asset on the public landing page</label>
          <label className="flex items-center gap-2 text-sm text-slate-700 md:col-span-2"><input type="checkbox" checked={draft.invertOnHover} onChange={(e) => updateDraft('invertOnHover', e.target.checked)} className="h-4 w-4 accent-blue-600" /> Invert logo on hover when gradient is shown</label>
        </div>
        <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4"><button type="button" onClick={() => setDraft(null)} className="min-h-10 rounded-xl border border-slate-200 px-4 text-sm font-medium">Cancel</button><button disabled={saving || (!draft.imageFile && !draft.imageUrl.trim())} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-blue-700 px-4 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{saving ? 'Saving…' : 'Save asset'}</button></div>
      </form>}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-base font-semibold text-slate-950">Saved assets <span className="ml-1 text-slate-400">{assets.length}</span></h2><p className="mt-1 text-xs text-slate-500">Only active assets appear on the public landing page.</p></div><label className="relative block w-full sm:max-w-xs"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search assets" className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm" /></label></div>

      {loading ? <div className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white p-12 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading assets…</div> : filteredAssets.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center"><FileImage className="mx-auto h-8 w-8 text-slate-300" /><p className="mt-3 font-medium text-slate-700">{search ? 'No matching assets' : 'No assets added yet'}</p><p className="mt-1 text-sm text-slate-500">Add a logo using a direct URL or upload an image to Supabase Storage.</p></div> : <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{filteredAssets.map((asset) => <article key={asset.id} className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className={`flex items-center justify-center bg-slate-50 p-3 ${asset.assetType === 'banner' ? 'aspect-video w-full' : 'h-32'}`}><img src={asset.imageUrl} alt={asset.altText} className={asset.assetType === 'banner' ? 'h-full w-full rounded-lg object-cover' : 'max-h-full max-w-full object-contain'} loading="lazy" referrerPolicy="no-referrer" /></div><div className="space-y-3 p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="truncate text-sm font-semibold text-slate-900">{asset.name}</h3><p className="mt-1 truncate text-xs text-slate-500">{asset.assetType} · order {asset.displayOrder}</p></div><span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold ${asset.isActive ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-500'}`}>{asset.isActive ? 'Active' : 'Hidden'}</span></div><p className="break-all text-[11px] leading-relaxed text-slate-400">{asset.imageUrl}</p><div className="flex flex-wrap items-center gap-1 border-t border-slate-100 pt-3"><button onClick={() => startEdit(asset)} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 text-xs font-medium hover:bg-slate-50"><Pencil className="h-3.5 w-3.5" /> Edit</button><button onClick={() => void toggleActive(asset)} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 text-xs font-medium hover:bg-slate-50">{asset.isActive ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}{asset.isActive ? 'Hide' : 'Activate'}</button><button onClick={() => void moveAsset(asset, -1)} aria-label={`Move ${asset.name} up`} className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 hover:bg-slate-50"><ArrowUp className="h-3.5 w-3.5" /></button><button onClick={() => void moveAsset(asset, 1)} aria-label={`Move ${asset.name} down`} className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 hover:bg-slate-50"><ArrowDown className="h-3.5 w-3.5" /></button><button onClick={() => setConfirmDelete(asset)} aria-label={`Delete ${asset.name}`} className="ml-auto grid h-9 w-9 place-items-center rounded-lg border border-rose-200 text-rose-700 hover:bg-rose-50"><Trash2 className="h-3.5 w-3.5" /></button></div></div></article>)}</div>}

      {confirmDelete && <div role="dialog" aria-modal="true" aria-labelledby="delete-title" className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/40 p-3 sm:items-center"><div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl sm:p-6"><h2 id="delete-title" className="text-lg font-semibold text-slate-950">Delete asset?</h2><p className="mt-2 text-sm leading-relaxed text-slate-600">“{confirmDelete.name}” will be removed from the landing asset collection. This cannot be undone.</p><div className="mt-5 flex justify-end gap-2"><button onClick={() => setConfirmDelete(null)} className="min-h-10 rounded-xl border border-slate-200 px-4 text-sm font-medium">Cancel</button><button onClick={() => void deleteAsset()} className="min-h-10 rounded-xl bg-rose-700 px-4 text-sm font-semibold text-white hover:bg-rose-800"><Trash2 className="mr-1.5 inline h-4 w-4" /> Delete</button></div></div></div>}
    </div>
  );
};
