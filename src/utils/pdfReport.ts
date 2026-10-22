import { PDFDocument } from 'pdf-lib';

/**
 * Premium A4 PDF renderer.
 * Pages are drawn on a canvas (so the browser shapes Urdu/Arabic text correctly)
 * and embedded into a real PDF via pdf-lib. Page size: A4 (595.28 x 841.89 pt) at 2x.
 */
export const PAGE_W = 1190;
export const PAGE_H = 1684;
const MARGIN = 84;
const HEADER_H = 150;
const FOOTER_H = 90;
const NAVY = '#0b1b34';
const BLUE = '#1d4ed8';
const EMERALD = '#047857';
const INK = '#0f172a';
const MUTED = '#64748b';
const LINE = '#e2e8f0';
const SOFT = '#f1f5f9';
const URDU_FONT = '"Noto Nastaliq Urdu","Noto Naskh Arabic","Segoe UI",serif';
const LATIN_FONT = '-apple-system,"SF Pro Text","Segoe UI",Helvetica,Arial,sans-serif';

const hasRtl = (text: string) => /[\u0590-\u08FF]/.test(text);

export interface PdfMeta { organization: string; title: string; subtitle?: string; footerNote?: string }
export interface TableColumn { header: string; width: number; align?: 'left' | 'right' }

export class PdfBuilder {
  private pages: HTMLCanvasElement[] = [];
  private ctx!: CanvasRenderingContext2D;
  y = 0;
  constructor(private meta: PdfMeta) { this.addPage(); }

  private addPage() {
    const canvas = document.createElement('canvas');
    canvas.width = PAGE_W; canvas.height = PAGE_H;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('PDF canvas is unavailable.');
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, PAGE_W, PAGE_H);
    this.pages.push(canvas); this.ctx = ctx;
    this.drawHeader(this.pages.length === 1);
  }

  private drawHeader(first: boolean) {
    const c = this.ctx;
    c.fillStyle = NAVY; c.fillRect(0, 0, PAGE_W, first ? HEADER_H : 74);
    c.fillStyle = '#10b981'; c.fillRect(0, first ? HEADER_H : 74, PAGE_W, 5);
    c.direction = 'ltr'; c.textAlign = 'left'; c.fillStyle = '#ffffff';
    if (first) {
      c.font = `600 22px ${LATIN_FONT}`; c.fillStyle = '#94a3b8';
      c.fillText(this.meta.organization.toUpperCase(), MARGIN, 52);
      c.font = `700 42px ${LATIN_FONT}`; c.fillStyle = '#ffffff';
      c.fillText(this.fit(this.meta.title, PAGE_W - MARGIN * 2, 42, '700'), MARGIN, 104);
      if (this.meta.subtitle) { c.font = `400 22px ${LATIN_FONT}`; c.fillStyle = '#cbd5e1'; c.fillText(this.fit(this.meta.subtitle, PAGE_W - MARGIN * 2, 22, '400'), MARGIN, 136); }
      this.y = HEADER_H + 50;
    } else {
      c.font = `600 22px ${LATIN_FONT}`; c.fillText(this.meta.organization, MARGIN, 46);
      c.textAlign = 'right'; c.fillStyle = '#94a3b8'; c.fillText(this.fit(this.meta.title, 600, 22, '600'), PAGE_W - MARGIN, 46);
      c.textAlign = 'left'; this.y = 74 + 50;
    }
  }

  private fit(text: string, maxWidth: number, size: number, weight: string) {
    this.ctx.font = `${weight} ${size}px ${LATIN_FONT}`;
    if (this.ctx.measureText(text).width <= maxWidth) return text;
    let t = text;
    while (t.length > 1 && this.ctx.measureText(`${t}…`).width > maxWidth) t = t.slice(0, -1);
    return `${t}…`;
  }

  ensure(height: number) { if (this.y + height > PAGE_H - FOOTER_H) this.addPage(); }

  heading(text: string) {
    this.ensure(90);
    const c = this.ctx; this.y += 14;
    c.fillStyle = EMERALD; c.fillRect(MARGIN, this.y - 26, 6, 34);
    c.fillStyle = INK; c.direction = 'ltr'; c.textAlign = 'left'; c.font = `700 30px ${LATIN_FONT}`;
    c.fillText(text, MARGIN + 20, this.y); this.y += 38;
  }

  paragraph(text: string, opts: { size?: number; color?: string } = {}) {
    const size = opts.size ?? 22; const c = this.ctx; const maxW = PAGE_W - MARGIN * 2;
    const rtl = hasRtl(text);
    c.font = `400 ${size}px ${rtl ? URDU_FONT : LATIN_FONT}`;
    const lines: string[] = []; let line = '';
    for (const word of text.split(/\s+/)) {
      const cand = line ? `${line} ${word}` : word;
      if (c.measureText(cand).width > maxW && line) { lines.push(line); line = word; } else line = cand;
    }
    if (line) lines.push(line);
    const lh = size * (rtl ? 1.9 : 1.5);
    for (const l of lines) {
      this.ensure(lh);
      c.font = `400 ${size}px ${rtl ? URDU_FONT : LATIN_FONT}`; c.fillStyle = opts.color ?? INK;
      c.direction = rtl ? 'rtl' : 'ltr'; c.textAlign = rtl ? 'right' : 'left';
      c.fillText(l, rtl ? PAGE_W - MARGIN : MARGIN, this.y); this.y += lh;
    }
    c.direction = 'ltr'; c.textAlign = 'left'; this.y += 8;
  }

  statCards(items: [string, number | string][]) {
    const perRow = 4; const gap = 18; const w = (PAGE_W - MARGIN * 2 - gap * (perRow - 1)) / perRow; const h = 104;
    for (let i = 0; i < items.length; i += perRow) {
      this.ensure(h + gap);
      items.slice(i, i + perRow).forEach(([label, value], idx) => {
        const x = MARGIN + idx * (w + gap); const c = this.ctx;
        c.fillStyle = SOFT; c.beginPath(); c.roundRect(x, this.y, w, h, 18); c.fill();
        c.strokeStyle = LINE; c.lineWidth = 1.5; c.stroke();
        c.direction = 'ltr'; c.textAlign = 'left'; c.fillStyle = MUTED; c.font = `500 19px ${LATIN_FONT}`; c.fillText(label, x + 20, this.y + 36);
        c.fillStyle = NAVY; c.font = `700 38px ${LATIN_FONT}`; c.fillText(typeof value === 'number' ? value.toLocaleString() : value, x + 20, this.y + 82);
      });
      this.y += h + gap;
    }
    this.y += 6;
  }

  table(columns: TableColumn[], rows: string[][]) {
    const c = this.ctx; const total = PAGE_W - MARGIN * 2; const rowH = 46;
    const sum = columns.reduce((a, b) => a + b.width, 0);
    const widths = columns.map((col) => (col.width / sum) * total);
    const drawHead = () => {
      this.ensure(rowH * 2);
      c.fillStyle = NAVY; c.beginPath(); c.roundRect(MARGIN, this.y, total, rowH, 10); c.fill();
      let x = MARGIN; c.font = `600 18px ${LATIN_FONT}`; c.fillStyle = '#ffffff'; c.direction = 'ltr';
      columns.forEach((col, i) => { c.textAlign = col.align === 'right' ? 'right' : 'left'; c.fillText(col.header, col.align === 'right' ? x + widths[i] - 14 : x + 14, this.y + 30); x += widths[i]; });
      this.y += rowH;
    };
    drawHead();
    rows.forEach((row, r) => {
      if (this.y + rowH > PAGE_H - FOOTER_H) { this.addPage(); drawHead(); }
      const cc = this.ctx;
      if (r % 2 === 0) { cc.fillStyle = '#f8fafc'; cc.fillRect(MARGIN, this.y, total, rowH); }
      let x = MARGIN; cc.font = `400 18px ${LATIN_FONT}`; cc.fillStyle = INK; cc.direction = 'ltr';
      row.forEach((cell, i) => { cc.textAlign = columns[i].align === 'right' ? 'right' : 'left'; cc.fillText(this.fit(String(cell ?? ''), widths[i] - 28, 18, '400'), columns[i].align === 'right' ? x + widths[i] - 14 : x + 14, this.y + 30); x += widths[i]; });
      cc.strokeStyle = LINE; cc.lineWidth = 1; cc.beginPath(); cc.moveTo(MARGIN, this.y + rowH); cc.lineTo(MARGIN + total, this.y + rowH); cc.stroke();
      this.y += rowH;
    });
    this.ctx.textAlign = 'left'; this.y += 20;
  }

  private drawFooters() {
    const n = this.pages.length;
    this.pages.forEach((canvas, i) => {
      const c = canvas.getContext('2d')!;
      c.strokeStyle = LINE; c.lineWidth = 1.5; c.beginPath(); c.moveTo(MARGIN, PAGE_H - 70); c.lineTo(PAGE_W - MARGIN, PAGE_H - 70); c.stroke();
      c.direction = 'ltr'; c.fillStyle = MUTED; c.font = `400 18px ${LATIN_FONT}`;
      c.textAlign = 'left'; c.fillText(this.meta.footerNote ?? `Generated ${new Date().toLocaleString()} · Recorded data only`, MARGIN, PAGE_H - 36);
      c.textAlign = 'right'; c.fillText(`Page ${i + 1} of ${n}`, PAGE_W - MARGIN, PAGE_H - 36);
    });
  }

  async build(): Promise<Blob> {
    this.drawFooters();
    const pdf = await PDFDocument.create();
    pdf.setTitle(this.meta.title); pdf.setProducer('MF MPanel');
    for (const canvas of this.pages) {
      const blob = await new Promise<Blob>((res, rej) => canvas.toBlob((b) => b ? res(b) : rej(new Error('Could not render PDF page.')), 'image/jpeg', 0.92));
      const img = await pdf.embedJpg(new Uint8Array(await blob.arrayBuffer()));
      const page = pdf.addPage([595.28, 841.89]);
      page.drawImage(img, { x: 0, y: 0, width: 595.28, height: 841.89 });
    }
    const bytes = await pdf.save();
    const buf = new ArrayBuffer(bytes.byteLength); new Uint8Array(buf).set(bytes);
    return new Blob([buf], { type: 'application/pdf' });
  }
}

export function savePdf(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob); const a = document.createElement('a');
  a.href = url; a.download = fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`;
  document.body.appendChild(a); a.click(); a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const d = (v: unknown) => (v ? new Date(String(v)).toLocaleDateString() : '—');

/** Organization / team report → premium PDF. Uses only recorded data. */
export async function buildOrganizationReportPdf(report: Record<string, any>): Promise<Blob> {
  const totals = report.totals ?? {};
  const pdf = new PdfBuilder({ organization: 'MF MPanel', title: report.title || report.reportId || 'Organization Report', subtitle: `${report.startDate ?? ''} — ${report.endDate ?? ''} · ${report.scope || 'Shared'} report · ID ${report.reportId ?? ''}` });
  pdf.heading('Summary');
  pdf.statCards([['Records', totals.records ?? 0], ['Profiles', totals.profiles ?? 0], ['Posts', totals.posts ?? 0], ['Checks', totals.checkingRecords ?? 0], ['Events', totals.workflowEvents ?? 0], ['Completed', totals.completed ?? 0], ['Failed', totals.failed ?? 0]]);
  if (report.truncated) pdf.paragraph('Note: the query reached its safety cap, so this report may not include every record in the period.', { color: '#b45309' });
  pdf.heading('Member activity');
  const members = (report.members ?? []) as any[];
  if (members.length) pdf.table([{ header: 'Member', width: 3 }, { header: 'Team', width: 2 }, { header: 'Records', width: 1, align: 'right' }], members.map((m) => [m.name || m.email || m.userId, String(m.team || '—'), String(m.activity ?? 0)]));
  else pdf.paragraph('No user activity recorded for this period.', { color: MUTED });
  pdf.heading('Tracked links');
  const links = (report.linkRecords ?? []) as any[];
  if (links.length) pdf.table([{ header: 'ID', width: 1.4 }, { header: 'Type', width: 1 }, { header: 'Status', width: 1.2 }, { header: 'Platform', width: 1.2 }, { header: 'URL', width: 4 }, { header: 'Date', width: 1.3 }], links.map((l) => [l.publicId || '', l.recordType || '', l.status || '', l.platform || '', l.url || 'URL unavailable', d(l.createdAt)]));
  else pdf.paragraph('No links in this report period.', { color: MUTED });
  pdf.paragraph(`Created by ${report.creatorName || report.createdByEmail || report.createdBy || 'unknown'} · Reports show recorded data only.`, { size: 18, color: MUTED });
  return pdf.build();
}

/** Gender-group team report → premium PDF. */
export async function buildGroupReportPdf(report: Record<string, any>): Promise<Blob> {
  const group = String(report.genderGroup || 'team');
  const pdf = new PdfBuilder({ organization: 'MF MPanel', title: `${group.charAt(0).toUpperCase()}${group.slice(1)} Team Report`, subtitle: 'Private team grouping · authorized data only' });
  pdf.heading('Summary');
  pdf.statCards([['Members', report.totalMembers ?? 0], ['Work items', report.totalWork ?? 0], ['Completed', report.completed ?? 0], ['Failed', report.failed ?? 0]]);
  pdf.heading('Work by workspace');
  const byTeam = Object.entries(report.workByTeam ?? {});
  if (byTeam.length) pdf.table([{ header: 'Workspace', width: 3 }, { header: 'Items', width: 1, align: 'right' }], byTeam.map(([t, n]) => [t, String(n)]));
  else pdf.paragraph('No work recorded.', { color: MUTED });
  pdf.heading('Group members');
  const members = (report.members ?? []) as any[];
  if (members.length) pdf.table([{ header: 'Member', width: 3 }, { header: 'Workspace', width: 2 }, { header: 'Status', width: 1.5 }, { header: 'Activity', width: 1, align: 'right' }], members.map((m) => [m.name || m.display_name || m.email || m.userId || '', String(m.team || m.workspace || '—'), String(m.status || m.account_status || '—'), String(m.activity ?? 0)]));
  else pdf.paragraph('No members in this group.', { color: MUTED });
  const links = (report.linkRecords ?? []) as any[];
  if (links.length) { pdf.heading('Profile & post links'); pdf.table([{ header: 'ID', width: 1.4 }, { header: 'Type', width: 1.4 }, { header: 'URL', width: 5 }], links.slice(0, 300).map((l) => [l.publicId || '', `${l.recordType || ''} · ${l.status || ''}`, l.url || ''])); }
  return pdf.build();
}
