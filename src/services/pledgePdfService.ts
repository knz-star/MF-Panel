import { PDFDocument } from 'pdf-lib';
import type { UserProfile } from '../types/user';
import { supabase } from '../lib/supabase';
import { getUserProfile } from './userService';

const DEFAULT_PLEDGE_TEXT = 'میں اقرار کرتا/کرتی ہوں کہ میں اپنی ذمہ داری دیانت داری سے ادا کروں گا/گی، صرف مجاز ٹیم اور کام تک رسائی استعمال کروں گا/گی، اور کسی بھی ریکارڈ یا ثبوت میں غیر مجاز تبدیلی نہیں کروں گا/گی۔ میری درخواست انتظامیہ کے جائزے اور منظوری کے بعد ہی فعال ہوگی۔';

async function canvasPng(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error('Could not render pledge PDF.')), 'image/png'));
  return new Uint8Array(await blob.arrayBuffer());
}

/**
 * The Admin user-list row can be stale (it merges several sources and the pledge
 * fields live in the canonical profile preferences). Always re-resolve the
 * freshest profile before deciding whether a pledge exists — this is what made
 * the Admin download look broken for users who had in fact submitted a pledge.
 */
export async function resolvePledgeUser(user: UserProfile): Promise<UserProfile> {
  try {
    const fresh = await getUserProfile(user.uid);
    if (fresh) {
      return {
        ...user,
        ...fresh,
        pledgeAccepted: fresh.pledgeAccepted === true || user.pledgeAccepted === true,
        pledgeSignature: fresh.pledgeSignature || user.pledgeSignature,
        pledgeAcceptedAt: fresh.pledgeAcceptedAt || user.pledgeAcceptedAt,
      };
    }
  } catch {
    // Fall through with the row data we already have.
  }
  return user;
}

interface PledgeContext {
  pledgeText: string;
  organization: string;
  legacyUser: Record<string, unknown>;
}

async function fetchPledgeContext(user: UserProfile): Promise<PledgeContext> {
  const [{ data: settingRows }, { data: userRows }] = await Promise.all([
    supabase.from('mfp_documents').select('data').eq('collection_name', 'siteSettings').eq('document_id', 'pledge').limit(1),
    supabase.from('mfp_documents').select('data').eq('collection_name', 'users').eq('document_id', user.uid).limit(1),
  ]);
  const setting = (settingRows?.[0]?.data ?? {}) as Record<string, unknown>;
  const legacyUser = (userRows?.[0]?.data ?? {}) as Record<string, unknown>;
  return {
    pledgeText: typeof setting.pledgeText === 'string' ? setting.pledgeText : DEFAULT_PLEDGE_TEXT,
    organization: typeof setting.organizationName === 'string' ? setting.organizationName : 'MF MPanel',
    legacyUser,
  };
}

/** Renders one user's signed pledge as a full-page PNG (shared by single + bulk downloads). */
async function renderPledgePng(user: UserProfile, context: PledgeContext): Promise<Uint8Array> {
  const { pledgeText, organization, legacyUser } = context;
  const dateValue = user.pledgeAcceptedAt || user.createdAt || new Date().toISOString();
  const date = new Date(dateValue);
  const dateLabel = Number.isNaN(date.getTime()) ? 'Date unavailable' : date.toLocaleString();
  const displayName = (user.pledgeSignature || user.displayName || 'User').trim();
  const reference = `MFP-${user.uid.slice(0, 8).toUpperCase()}`;
  const W = 1190, H = 1684;
  const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Your browser could not create the PDF page.');
  const urdu = '"Noto Nastaliq Urdu", "Noto Naskh Arabic", "Segoe UI", serif';
  const latin = '-apple-system, "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = '#0b1b34'; ctx.lineWidth = 4; ctx.strokeRect(40, 40, W - 80, H - 80);
  ctx.strokeStyle = '#10b981'; ctx.lineWidth = 2; ctx.strokeRect(54, 54, W - 108, H - 108);
  ctx.fillStyle = '#0b1b34'; ctx.fillRect(54, 54, W - 108, 190);
  ctx.fillStyle = '#10b981'; ctx.fillRect(54, 244, W - 108, 6);
  ctx.direction = 'ltr'; ctx.textAlign = 'center'; ctx.fillStyle = '#94a3b8'; ctx.font = `600 22px ${latin}`; ctx.fillText(organization.toUpperCase(), W / 2, 112);
  ctx.fillStyle = '#fff'; ctx.font = `700 52px ${latin}`; ctx.fillText('USER PLEDGE', W / 2, 176);
  ctx.fillStyle = '#6ee7b7'; ctx.direction = 'rtl'; ctx.font = `700 40px ${urdu}`; ctx.fillText('عہد نامہ اور اقرار', W / 2, 226);
  ctx.direction = 'ltr'; ctx.textAlign = 'left'; ctx.fillStyle = '#64748b'; ctx.font = `500 20px ${latin}`; ctx.fillText(`Reference: ${reference}`, 100, 300);
  ctx.textAlign = 'right'; ctx.fillText(`Submitted: ${dateLabel}`, W - 100, 300);
  ctx.textAlign = 'left'; ctx.fillStyle = '#0f172a'; ctx.font = `700 30px ${latin}`; ctx.fillText(displayName.slice(0, 60), 110, 365);
  ctx.fillStyle = '#64748b'; ctx.font = `400 19px ${latin}`; ctx.fillText((user.email || '').slice(0, 80), 110, 400);
  ctx.fillText(`User ID: ${user.uid}`, 110, 432);
  ctx.fillStyle = '#fff'; ctx.strokeStyle = '#e2e8f0'; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(90, 475, W - 180, 720, 20); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#10b981'; ctx.fillRect(W - 112, 505, 8, 100);
  const maxWidth = W - 280; let fontSize = 35;
  const makeLines = (size: number) => { ctx.font = `${size}px ${urdu}`; const lines: string[] = []; for (const paragraph of pledgeText.split('\n')) { let line = ''; for (const word of paragraph.split(/\s+/)) { const candidate = line ? `${line} ${word}` : word; if (ctx.measureText(candidate).width > maxWidth && line) { lines.push(line); line = word; } else line = candidate; } if (line) lines.push(line); } return lines; };
  let lines = makeLines(fontSize); while (fontSize > 20 && lines.length * fontSize * 1.65 > 650) { fontSize -= 1; lines = makeLines(fontSize); }
  ctx.font = `${fontSize}px ${urdu}`; ctx.fillStyle = '#1e293b'; ctx.direction = 'rtl'; ctx.textAlign = 'right';
  let y = 535; for (const line of lines.slice(0, 30)) { ctx.fillText(line, W - 145, y, maxWidth); y += fontSize * 1.65; }
  ctx.direction = 'ltr'; ctx.strokeStyle = '#94a3b8'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(110, 1320); ctx.lineTo(520, 1320); ctx.stroke();
  ctx.fillStyle = '#0f172a'; ctx.textAlign = 'center'; ctx.font = 'italic 42px cursive'; ctx.fillText(displayName.slice(0, 30), 315, 1290);
  ctx.font = `700 20px ${latin}`; ctx.fillText('USER SIGNATURE (AS SUBMITTED)', 315, 1360);
  ctx.textAlign = 'left'; ctx.font = `400 18px ${latin}`; ctx.fillStyle = '#475569'; ctx.fillText(`Pledge status: SUBMITTED`, 110, 1450);
  ctx.fillText(`Profile name at export: ${String(legacyUser.displayName || user.displayName || 'User').slice(0, 70)}`, 110, 1485);
  ctx.textAlign = 'center'; ctx.fillText('Administrative copy generated by MF MPanel', W / 2, 1570);
  return canvasPng(canvas);
}

function savePdfBytes(bytes: Uint8Array, fileName: string): void {
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const blob = new Blob([buffer], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = fileName; document.body.appendChild(anchor); anchor.click(); anchor.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

/** Admin-only UI action. Re-resolves the user's pledge from the freshest profile first. */
export async function downloadUserPledgePdf(inputUser: UserProfile): Promise<void> {
  const user = await resolvePledgeUser(inputUser);
  if (!user.pledgeAccepted || !user.pledgeSignature?.trim()) throw new Error('This user has not submitted a signed pledge yet.');
  const context = await fetchPledgeContext(user);
  const png = await renderPledgePng(user, context);
  const pdf = await PDFDocument.create(); const page = pdf.addPage([595.28, 841.89]);
  const image = await pdf.embedPng(png);
  page.drawImage(image, { x: 0, y: 0, width: page.getWidth(), height: page.getHeight() });
  const displayName = (user.pledgeSignature || user.displayName || 'User').trim();
  pdf.setTitle(`${context.organization} — Pledge — ${displayName}`); pdf.setSubject(`Pledge record MFP-${user.uid.slice(0, 8).toUpperCase()}`); pdf.setProducer('MF MPanel');
  const bytes = await pdf.save();
  savePdfBytes(bytes, `MF-MPanel-Pledge-${user.uid.slice(0, 12)}.pdf`);
}

/**
 * Admin bulk export: ONE PDF containing every submitted pledge, one page per
 * user, ordered as given. Returns how many pledges were included.
 */
export async function downloadAllUsersPledgesPdf(inputUsers: UserProfile[]): Promise<number> {
  const resolved: UserProfile[] = [];
  for (const candidate of inputUsers) {
    const user = await resolvePledgeUser(candidate);
    if (user.pledgeAccepted && user.pledgeSignature?.trim()) resolved.push(user);
  }
  if (!resolved.length) throw new Error('No user in the list has submitted a signed pledge yet.');
  const pdf = await PDFDocument.create();
  for (const user of resolved) {
    const context = await fetchPledgeContext(user);
    const png = await renderPledgePng(user, context);
    const page = pdf.addPage([595.28, 841.89]);
    const image = await pdf.embedPng(png);
    page.drawImage(image, { x: 0, y: 0, width: page.getWidth(), height: page.getHeight() });
  }
  pdf.setTitle('MF MPanel — All User Pledges'); pdf.setSubject(`${resolved.length} submitted pledges`); pdf.setProducer('MF MPanel');
  const bytes = await pdf.save();
  savePdfBytes(bytes, 'MF-MPanel-Pledges-All-Users.pdf');
  return resolved.length;
}
