import JSZip from 'jszip';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  orderBy,
  limit,
} from '../lib/supabaseDocumentStore';
import { db, handleBackendError, OperationType, withTimeout } from '../lib/backend';
import { localStore } from './localStore';
import {
  ReportJob,
  ExtractedUrlItem,
  ExtractedScreenshotItem,
  ReportPackageManifest,
  EvidenceBatchManifest,
} from '../types/report';
import { validateAndLoadZip } from '../utils/zipValidator';
import { extractUrlsFromChatText } from '../utils/urlExtractor';
import {
  buildDatabaseLookupMaps,
  matchUrlAgainstDatabase,
  matchScreenshotAgainstDatabase,
} from '../utils/matchingEngine';
import { listProfiles } from './profileService';
import { listAllPosts } from './postService';
import { supabase } from '../lib/supabase';

const JOBS_COLLECTION = 'reportJobs';
const PACKAGES_COLLECTION = 'reportPackages';

export interface AnalysisSessionResult {
  job: ReportJob;
  zipInstance: JSZip;
  textFileBreakdowns: {
    filename: string;
    extractedCount: number;
  }[];
  extractedUrls: ExtractedUrlItem[];
  extractedScreenshots: ExtractedScreenshotItem[];
  uniqueEligibleLinks: ExtractedUrlItem[];
  batchManifest?: EvidenceBatchManifest;
}

/**
 * Analyses an uploaded ZIP file and compares its items against central Supabase database records.
 */
export async function analyzeUploadedZip(
  file: File,
  userUid: string,
  userEmail?: string,
  linksPerFolder = 100,
  providedManifest?: EvidenceBatchManifest,
  archivePassword?: string
): Promise<AnalysisSessionResult> {
  // 1. Validate ZIP
  const validation = await validateAndLoadZip(file, {}, archivePassword);
  if (!validation.isValid || !validation.zipInstance) {
    throw new Error(validation.errors.join(' | '));
  }

  const zip = validation.zipInstance;
  let batchManifest: EvidenceBatchManifest | undefined = providedManifest;
  const embeddedManifestPath = Object.keys(zip.files).find((path) => !zip.files[path].dir && path.split('/').pop()?.toLowerCase() === 'manifest.json');
  let embeddedManifest: EvidenceBatchManifest | undefined;
  if (embeddedManifestPath) {
    try {
      const candidate = JSON.parse(await zip.files[embeddedManifestPath].async('string')) as EvidenceBatchManifest;
      if (Array.isArray(candidate.links)) embeddedManifest = candidate;
    } catch (error) {
      console.warn('Embedded manifest.json could not be parsed; continuing with ordinary ZIP matching.', error);
    }
  }
  if (providedManifest && embeddedManifest) {
    const embeddedById = new Map(embeddedManifest.links.map((link) => [link.linkId, link]));
    batchManifest = { ...embeddedManifest, ...providedManifest, links: providedManifest.links.map((link) => {
      const evidence = embeddedById.get(link.linkId);
      return { ...(evidence ?? {}), ...link, screenshots: evidence?.screenshots ?? link.screenshots };
    }) };
  } else if (!batchManifest) batchManifest = embeddedManifest;
  const jobId = `JOB-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

  // 2. Query central database records for matching
  const allProfiles = await listProfiles({ limitCount: 1000 });
  const allPosts = await listAllPosts(1000);
  const dbMaps = buildDatabaseLookupMaps(allProfiles, allPosts);

  // 3. Extract links from text files
  const textFileBreakdowns: { filename: string; extractedCount: number }[] = [];
  const rawUrlEntries: { rawUrl: string; sourceFilename: string; id: string; batchLinkId?: string }[] = [];

  // Filter text files
  const textEntries = validation.entryList.filter((e) => !e.isDir && e.isText);
  let globalUrlIdx = 0;

  for (const entry of textEntries) {
    try {
      const textContent = await zip.files[entry.path].async('string');
      const batchItems = extractUrlsFromChatText(textContent);
      textFileBreakdowns.push({
        filename: entry.path,
        extractedCount: batchItems.length,
      });

      for (const item of batchItems) {
        globalUrlIdx++;
        rawUrlEntries.push({
          id: `url_${globalUrlIdx}`,
          rawUrl: item.extractedUrl,
          sourceFilename: entry.path,
        });
      }
    } catch (e) {
      console.warn(`Failed to read text file ${entry.path}:`, e);
    }
  }

  // 3b. Manifest URLs are first-class input; de-duplicate against TXT URLs.
  const normalizeForMatch = (value: string) => { try { const u = new URL(value); u.hash = ''; u.hostname = u.hostname.toLowerCase().replace(/^www\./, ''); u.pathname = u.pathname.replace(/\/+$/, '') || '/'; return u.toString().replace(/\/$/, '').toLowerCase(); } catch { return value.trim().replace(/#.*$/, '').replace(/\/+$/, '').toLowerCase(); } };
  const manifestByUrl = new Map<string, { linkId: string; profileId?: string; platform?: string; notes?: string }>();
  for (const link of batchManifest?.links ?? []) {
    if (!link || typeof link.url !== 'string' || !/^https?:\/\//i.test(link.url)) continue;
    const normalized = normalizeForMatch(link.url);
    if (link.linkId) manifestByUrl.set(normalized, { linkId: link.linkId, profileId: link.profileId, platform: link.platform, notes: link.notes });
    if (!rawUrlEntries.some((item) => normalizeForMatch(item.rawUrl) === normalized)) {
      rawUrlEntries.push({ id: `manifest_${link.linkId || rawUrlEntries.length + 1}`, rawUrl: link.url, sourceFilename: 'manifest.json', batchLinkId: link.linkId });
    }
  }

  const manifestCountIssues = (batchManifest?.links ?? []).filter((link) => {
    const required = Math.max(0, Number(link.requiredCount ?? link.requiredScreenshots ?? 1));
    if (!Array.isArray(link.screenshots) && typeof link.actualCount !== 'number') return false;
    const actualList = (link.screenshots ?? []).length;
    const declaredActual = Number.isFinite(Number(link.actualCount)) ? Number(link.actualCount) : actualList;
    return actualList !== declaredActual || declaredActual !== required;
  }).length;

  // 4. Match extracted URLs and attach manifest references without treating a
  // username as a canonical database profile ID.
  const extractedUrls: ExtractedUrlItem[] = rawUrlEntries.map((item) => {
    const matched = matchUrlAgainstDatabase(item, dbMaps);
    const manifestRef = manifestByUrl.get(normalizeForMatch(item.rawUrl));
    if (manifestRef) {
      matched.batchLinkId = manifestRef.linkId;
      matched.srcReference = manifestRef.linkId;
      if (!matched.platform || matched.platform === 'Other') matched.platform = manifestRef.platform || 'Other';
      if (!matched.reviewNote && manifestRef.notes) matched.reviewNote = manifestRef.notes;
    }
    return matched;
  });

  // Deduplicate unique eligible URLs
  const seenNormUrls = new Set<string>();
  const uniqueEligibleLinks: ExtractedUrlItem[] = [];

  for (const u of extractedUrls) {
    const key = u.normalizedUrl.toLowerCase();
    if (!seenNormUrls.has(key) && u.status !== 'INVALID') {
      seenNormUrls.add(key);
      uniqueEligibleLinks.push(u);
    }
  }

  // 5. Extract screenshots
  const imageEntries = validation.entryList.filter((e) => !e.isDir && e.isImage);
  const extractedScreenshots: ExtractedScreenshotItem[] = [];
  let globalImgIdx = 0;

  for (const imgEntry of imageEntries) {
    globalImgIdx++;
    const filename = imgEntry.path.split('/').pop() || imgEntry.path;
    const matchedImg = matchScreenshotAgainstDatabase(
      { id: `img_${globalImgIdx}`, filename, path: imgEntry.path, sizeBytes: imgEntry.size },
      dbMaps
    );
    const manifestLink = (batchManifest?.links ?? []).find((link) => (link.screenshots ?? []).some((shot) => shot.fileName.toLowerCase() === filename.toLowerCase() || shot.fileName.toLowerCase() === imgEntry.path.toLowerCase()) || filename.toLowerCase().startsWith(`${String(link.linkId ?? '').toLowerCase()}-scr-`));
    const manifestShot = manifestLink?.screenshots?.find((shot) => shot.fileName.toLowerCase() === filename.toLowerCase() || shot.fileName.toLowerCase() === imgEntry.path.toLowerCase());
    if (manifestLink) {
      matchedImg.batchLinkId = manifestLink.linkId;
      let isExtraScreenshot = false;
      if (manifestShot) {
        const required = Math.max(0, Number(manifestLink.requiredCount ?? manifestLink.requiredScreenshots ?? 1));
        const orderedShots = manifestLink.screenshots ?? [];
        const screenshotIndex = orderedShots.findIndex((shot) => shot.fileName.toLowerCase() === filename.toLowerCase() || shot.fileName.toLowerCase() === imgEntry.path.toLowerCase());
        if (screenshotIndex >= required) {
          isExtraScreenshot = true;
          matchedImg.reviewNote = `Extra screenshot ${screenshotIndex + 1}; required count is ${required}.`;
        }
        matchedImg.sha256Checksum = manifestShot.sha256Checksum;
        matchedImg.capturedAt = manifestShot.capturedAt;
      }
      const linkedUrl = extractedUrls.find((item) => item.batchLinkId === manifestLink.linkId);
      if (linkedUrl?.matchedProfileId) {
        matchedImg.matchedProfileId = linkedUrl.matchedProfileId;
        matchedImg.matchedPublicProfileId = linkedUrl.matchedPublicProfileId || linkedUrl.matchedProfileId;
        matchedImg.matchedPublicPostId = linkedUrl.matchedPublicPostId;
        matchedImg.status = isExtraScreenshot ? 'NEEDS_REVIEW' : linkedUrl.status === 'MATCHED' ? 'MATCHED' : 'NEEDS_REVIEW';
        matchedImg.matchMethod = linkedUrl.status === 'MATCHED' ? 'NORMALIZED_URL_MATCH' : 'UNMATCHED';
      } else {
        matchedImg.status = 'NEEDS_REVIEW';
        matchedImg.matchMethod = 'UNMATCHED';
        matchedImg.reviewNote = `Manifest link ${manifestLink.linkId} could not be matched to a known profile URL.`;
      }
    }

    // Optionally extract small thumbnail / blob for client preview
    try {
      const blob = await zip.files[imgEntry.path].async('blob');
      matchedImg.blob = blob;
      // If smaller than 500KB, create preview dataUrl
      if (imgEntry.size < 500 * 1024) {
        matchedImg.dataUrl = URL.createObjectURL(blob);
      }
    } catch (e) {
      // Ignored for performance
    }

    extractedScreenshots.push(matchedImg);
  }

  // Duplicate checksum evidence is never silently treated as independent proof.
  const checksumCounts = new Map<string, number>();
  for (const screenshot of extractedScreenshots) if (screenshot.sha256Checksum) checksumCounts.set(screenshot.sha256Checksum.toLowerCase(), (checksumCounts.get(screenshot.sha256Checksum.toLowerCase()) ?? 0) + 1);
  for (const screenshot of extractedScreenshots) {
    if (screenshot.sha256Checksum && (checksumCounts.get(screenshot.sha256Checksum.toLowerCase()) ?? 0) > 1) {
      screenshot.duplicateChecksum = true;
      screenshot.status = 'NEEDS_REVIEW';
      screenshot.reviewNote = [screenshot.reviewNote, 'Duplicate SHA-256 checksum: this image is byte-identical to another screenshot in the manifest.'].filter(Boolean).join(' ');
    }
  }

  // 5b. Reconcile the ZIP against assigned links and persist IDs/metadata only.
  // Screenshot image bytes stay in the uploaded ZIP/browser memory and are never sent to Supabase.
  const manifestLinks = batchManifest?.links ?? [];
  const metadataRecords = manifestLinks.map((link, linkIndex) => {
    const matchedUrl = extractedUrls.find((item) => item.batchLinkId === link.linkId || normalizeForMatch(item.originalUrl) === normalizeForMatch(link.url));
    const actualShots = extractedScreenshots.filter((shot) => shot.batchLinkId === link.linkId || (matchedUrl?.matchedProfileId && shot.matchedProfileId === matchedUrl.matchedProfileId));
    const declaredShots = (link.screenshots ?? []).map((shot, shotIndex) => ({
      screenshotId: shot.screenshotId || shot.screenshot_id || shot.id || link.screenshotIds?.[shotIndex] || `SHOT-${jobId}-${linkIndex + 1}-${shotIndex + 1}`,
      fileName: shot.fileName,
      capturedAt: shot.capturedAt,
      sha256Checksum: shot.sha256Checksum,
    }));
    const shots = declaredShots.length ? declaredShots : (link.screenshotIds?.length
      ? link.screenshotIds.map((screenshotId) => ({ screenshotId, fileName: '' }))
      : actualShots.map((shot, shotIndex) => ({
          screenshotId: `SHOT-${jobId}-${linkIndex + 1}-${shotIndex + 1}`,
          fileName: shot.filename,
          capturedAt: shot.capturedAt,
          sha256Checksum: shot.sha256Checksum,
        })));
    // Carry the canonical screenshot IDs into the in-memory manifest so the downloadable report JSON
    // and the database reference the same IDs, even when the source ZIP did not include them.
    link.screenshotIds = [...new Set([...(link.screenshotIds ?? []), ...shots.map((shot) => shot.screenshotId).filter((id): id is string => Boolean(id))])];
    const postIds = [...new Set([...(link.postIds ?? []), ...(matchedUrl?.matchedPostId ? [matchedUrl.matchedPostId] : [])].filter(Boolean))];
    return {
      linkId: link.linkId,
      url: link.url,
      sourceProfileId: link.sourceProfileId || link.profileId,
      profileId: matchedUrl?.matchedPublicProfileId || matchedUrl?.matchedProfileId || link.profileId,
      mfpProfileId: link.mfpProfileId || matchedUrl?.matchedPublicProfileId,
      postIds,
      screenshots: shots,
      verificationStatus: matchedUrl?.status === 'MATCHED' ? 'NEEDS_REVIEW' : 'MISMATCH',
      verificationNotes: matchedUrl?.status === 'MATCHED' ? 'Assigned URL matched; screenshot evidence remains subject to review.' : 'URL did not match a known workflow profile; review required.',
    };
  }).filter((record) => /^https?:\/\//i.test(record.url));
  if (metadataRecords.length) {
    const { data: metadataResult, error: metadataError } = await supabase.rpc('mfp_evidence_zip_metadata', {
      p_action: 'ingest',
      p_payload: { reportJobId: jobId, records: metadataRecords },
    });
    if (metadataError) throw new Error(`ZIP analyzed, but evidence ID reconciliation could not be saved: ${metadataError.message}`);
    if (metadataResult && typeof metadataResult === 'object' && 'error' in metadataResult) throw new Error(String((metadataResult as Record<string, unknown>).error));
    console.info('[MF MPanel] Evidence metadata reconciled:', metadataResult);
  }

  // 6. Calculate statistics
  const matchedScreenshotCount = extractedScreenshots.filter((s) => s.status === 'MATCHED').length;
  const unmatchedScreenshotCount = extractedScreenshots.filter((s) => s.status === 'UNMATCHED').length;
  const reviewRequiredCount =
    extractedUrls.filter((u) => u.status === 'NEEDS_REVIEW').length +
    extractedScreenshots.filter((s) => s.status === 'NEEDS_REVIEW').length + manifestCountIssues;

  const nowIso = new Date().toISOString();
  const expiresIso = new Date(Date.now() + 72 * 3600 * 1000).toISOString(); // 72 hours retention

  const job: ReportJob = {
    jobId,
    createdBy: userUid,
    creatorEmail: userEmail,
    sourceArchiveName: file.name,
    archiveSizeBytes: file.size,
    processingStatus: reviewRequiredCount > 0 ? 'NEEDS_REVIEW' : 'READY_TO_PACKAGE',
    requestedLinksPerFolder: linksPerFolder,
    inputLinkCount: extractedUrls.length,
    uniqueLinkCount: uniqueEligibleLinks.length,
    matchedScreenshotCount,
    unmatchedScreenshotCount,
    reviewRequiredCount,
    createdAt: nowIso,
    updatedAt: nowIso,
    expiresAt: expiresIso,
  };

  // Save job in localStore for instant zero-lag access
  localStore.upsertReportJob(job);

  // Save job in Supabase database with timeout
  try {
    await withTimeout(setDoc(doc(db, JOBS_COLLECTION, jobId), job), 1500, null);
  } catch (err) {
    console.warn('Could not persist report job to Supabase:', err);
  }

  return {
    job,
    zipInstance: zip,
    textFileBreakdowns,
    extractedUrls,
    extractedScreenshots,
    uniqueEligibleLinks,
    batchManifest,
  };
}

/**
 * Builds the Physical ZIP and Online ZIP formats. Each TXT file contains URL lines only;
 * the online package includes a PDF of screenshots and a nested ZIP of the same link folders.
 */
export async function buildAndDownloadReportPackage(params: {
  job: ReportJob;
  linksPerFolder: number;
  eligibleLinks: ExtractedUrlItem[];
  matchedScreenshots: ExtractedScreenshotItem[];
  sourceZip: JSZip;
  batchManifest?: EvidenceBatchManifest;
  includeUnmatchedReviewFolder?: boolean;
}): Promise<{
  packageZipBlob: Blob;
  physicalPackageZipBlob: Blob;
  onlinePackageZipBlob: Blob;
  linkTxtBlob: Blob;
  screenshotsZipBlob: Blob;
  screenshotsPdfBlob: Blob;
  screenshotsPdfPartCount: number;
  linksZipBlob: Blob;
  manifest: ReportPackageManifest;
  manifestJson: string;
}> {
  const { job, linksPerFolder, eligibleLinks, matchedScreenshots, sourceZip, batchManifest } = params;
  const safeLinksPerFolder = Math.min(2000, Math.max(1, Math.floor(Number(linksPerFolder) || 1)));
  const chunks: ExtractedUrlItem[][] = [];
  for (let i = 0; i < eligibleLinks.length; i += safeLinksPerFolder) chunks.push(eligibleLinks.slice(i, i + safeLinksPerFolder));
  if (chunks.length === 0) chunks.push([]);

  const folderNameFor = (index: number) => `Folder-${String(index + 1).padStart(3, '0')}`;
  const formatLinkTxt = (links: ExtractedUrlItem[]) => links.map((link) => link.normalizedUrl).filter(Boolean).join('\n') + (links.length ? '\n' : '');
  const screenshotsForLinks = (links: ExtractedUrlItem[]) => {
    const profileIds = new Set(links.map((link) => link.matchedProfileId).filter(Boolean));
    const postIds = new Set(links.map((link) => link.matchedPostId).filter(Boolean));
    const batchIds = new Set(links.map((link) => link.batchLinkId).filter(Boolean));
    return matchedScreenshots.filter((s) =>
      (s.batchLinkId && batchIds.has(s.batchLinkId)) ||
      (s.matchedPostId && postIds.has(s.matchedPostId)) ||
      (s.matchedProfileId && profileIds.has(s.matchedProfileId))
    );
  };
  const safeFile = (value: string) => value.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').slice(0, 180) || 'screenshot';
  const imageBytes = async (item: ExtractedScreenshotItem): Promise<Uint8Array | null> => {
    const file = sourceZip.files[item.path];
    if (!file) return null;
    return await file.async('uint8array');
  };
  const physicalZip = new JSZip();
  const linksZip = new JSZip();
  const screenshotsZip = new JSZip();
  const folderSummaries: ReportPackageManifest['folders'] = [];
  const fullLinkTxtContent = formatLinkTxt(eligibleLinks);
  const fullLinkTxtBlob = new Blob([fullLinkTxtContent], { type: 'text/plain;charset=utf-8' });

  // Physical report: each link folder contains a TXT with URLs only; all screenshots
  // live in a separate top-level Screenshots directory.
  for (let index = 0; index < chunks.length; index++) {
    const folderName = folderNameFor(index);
    const links = chunks[index];
    const txt = formatLinkTxt(links);
    physicalZip.folder(folderName)?.file('links.txt', txt);
    linksZip.folder(folderName)?.file('links.txt', txt);
    const relevant = screenshotsForLinks(links);
    folderSummaries.push({ folderName, linksCount: links.length, screenshotsCount: relevant.length });
    for (const item of relevant) {
      try {
        const bytes = await imageBytes(item);
        if (!bytes) continue;
        const prefix = item.duplicateChecksum ? 'REVIEW-DUPLICATE-' : '';
        const name = safeFile(`${prefix}${item.batchLinkId ? `${item.batchLinkId}-` : ''}${item.matchedPublicProfileId || item.matchedProfileId ? `${item.matchedPublicProfileId || item.matchedProfileId}-` : ''}${item.matchedPublicPostId ? `${item.matchedPublicPostId}-` : ''}${item.filename}`);
        physicalZip.folder(`${folderName}/Screenshots`)?.file(name, bytes);
        screenshotsZip.folder(folderName)?.file(name, bytes);
      } catch (error) {
        console.warn('Could not package screenshot:', item.path, error);
      }
    }
  }
  // Screenshots with no reliable link association remain available for review, never auto-matched.
  const associated = new Set(matchedScreenshots.filter((s) => screenshotsForLinks(eligibleLinks).includes(s)).map((s) => s.path));
  for (const item of matchedScreenshots.filter((s) => !associated.has(s.path))) {
    try {
      const bytes = await imageBytes(item);
      if (bytes) physicalZip.folder('Unmatched-Review/Screenshots')?.file(safeFile(item.filename), bytes);
    } catch (error) { console.warn('Could not package unmatched screenshot:', item.path, error); }
  }

  // Split large evidence sets into small PDF parts to keep browser memory bounded.
  const pdfSafeText = (value: string) => value.normalize('NFKD').replace(/[^\x20-\x7E]/g, '?');
  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const pdfChunkSize = 100;
  const pdfBatches: ExtractedScreenshotItem[][] = [];
  for (let i = 0; i < matchedScreenshots.length; i += pdfChunkSize) pdfBatches.push(matchedScreenshots.slice(i, i + pdfChunkSize));
  if (pdfBatches.length === 0) pdfBatches.push([]);
  const pdfParts: Array<{ fileName: string; blob: Blob; pageCount: number }> = [];
  for (let partIndex = 0; partIndex < pdfBatches.length; partIndex++) {
    const items = pdfBatches[partIndex];
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdf.embedFont(StandardFonts.HelveticaBold);
    if (items.length === 0) {
      const page = pdf.addPage([pageWidth, pageHeight]);
      page.drawText('MF MPanel Online Report', { x: 40, y: pageHeight - 50, size: 18, font: boldFont, color: rgb(0.08, 0.12, 0.2) });
      page.drawText('No screenshots were found in the uploaded archive.', { x: 40, y: pageHeight - 90, size: 11, font });
    }
    for (const item of items) {
      const page = pdf.addPage([pageWidth, pageHeight]);
      const title = `${item.batchLinkId || item.matchedPublicProfileId || item.matchedProfileId || 'Unmatched screenshot'} - ${item.filename}`.slice(0, 110);
      page.drawText(pdfSafeText(title), { x: 28, y: pageHeight - 32, size: 9, font: boldFont, color: rgb(0.08, 0.12, 0.2), maxWidth: pageWidth - 56 });
      const statusLine = `Status: ${item.duplicateChecksum ? 'NEEDS REVIEW - DUPLICATE CHECKSUM' : item.status}${item.capturedAt ? ` | Captured ${new Date(item.capturedAt).toISOString()}` : ''}`;
      page.drawText(pdfSafeText(statusLine.slice(0, 150)), { x: 28, y: pageHeight - 48, size: 7, font, color: item.duplicateChecksum || item.status !== 'MATCHED' ? rgb(0.65, 0.22, 0.08) : rgb(0.15, 0.4, 0.25), maxWidth: pageWidth - 56 });
      if (item.sha256Checksum) page.drawText(pdfSafeText(`SHA-256: ${item.sha256Checksum}`), { x: 28, y: pageHeight - 62, size: 6, font, color: rgb(0.35, 0.38, 0.43), maxWidth: pageWidth - 56 });
      try {
        const bytes = await imageBytes(item);
        if (!bytes) throw new Error('Image bytes are missing');
        let embedded;
        const ext = item.filename.split('.').pop()?.toLowerCase();
        if (ext === 'png') embedded = await pdf.embedPng(bytes);
        else if (ext === 'jpg' || ext === 'jpeg') embedded = await pdf.embedJpg(bytes);
        else {
          const blob = new Blob([bytes as BlobPart], { type: ext === 'webp' ? 'image/webp' : 'application/octet-stream' });
          const bitmap = await createImageBitmap(blob);
          const canvas = document.createElement('canvas'); canvas.width = bitmap.width; canvas.height = bitmap.height;
          const context = canvas.getContext('2d');
          if (!context) { bitmap.close(); throw new Error('Canvas is unavailable for image conversion'); }
          context.drawImage(bitmap, 0, 0); bitmap.close();
          const converted = await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => b ? resolve(b) : reject(new Error('Image conversion failed')), 'image/jpeg', 0.92));
          embedded = await pdf.embedJpg(new Uint8Array(await converted.arrayBuffer()));
        }
        const maxWidth = pageWidth - 56;
        const maxHeight = pageHeight - 130;
        const scale = Math.min(maxWidth / embedded.width, maxHeight / embedded.height, 1);
        const width = embedded.width * scale; const height = embedded.height * scale;
        page.drawImage(embedded, { x: (pageWidth - width) / 2, y: 48 + (maxHeight - height) / 2, width, height });
      } catch (error) {
        page.drawText('Screenshot could not be embedded; see the ZIP evidence folder.', { x: 28, y: pageHeight - 100, size: 10, font, color: rgb(0.65, 0.22, 0.08) });
        console.warn('PDF screenshot embedding failed:', item.path, error);
      }
      if (item.reviewNote) page.drawText(pdfSafeText(`Review: ${item.reviewNote}`.slice(0, 220)), { x: 28, y: 28, size: 7, font, color: rgb(0.65, 0.22, 0.08), maxWidth: pageWidth - 56 });
    }
    const pdfBytes = await pdf.save();
    const fileName = pdfBatches.length === 1 ? 'screenshots.pdf' : `screenshots-part-${String(partIndex + 1).padStart(3, '0')}.pdf`;
    pdfParts.push({ fileName, blob: new Blob([pdfBytes as BlobPart], { type: 'application/pdf' }), pageCount: Math.max(items.length, 1) });
  }
  const screenshotsPdfBlob = pdfParts[0].blob;
  const screenshotsZipBlob = await screenshotsZip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  const linksZipBlob = await linksZip.generateAsync({ type: 'blob', compression: 'DEFLATE' });

  const manifest: ReportPackageManifest = {
    jobId: job.jobId,
    batchId: batchManifest?.batchId,
    batchName: batchManifest?.batchName,
    exportId: batchManifest?.exportId,
    creationTimestamp: new Date().toISOString(),
    sourceArchiveName: job.sourceArchiveName,
    inputLinkCount: job.inputLinkCount,
    uniqueEligibleLinks: eligibleLinks.length,
    matchedScreenshotCount: matchedScreenshots.filter((s) => s.status === 'MATCHED' && !s.duplicateChecksum).length,
    unmatchedScreenshotCount: matchedScreenshots.filter((s) => s.status === 'UNMATCHED').length,
    needsReviewScreenshotCount: matchedScreenshots.filter((s) => s.status === 'NEEDS_REVIEW' || s.duplicateChecksum).length,
    unresolvedItemsCount: job.reviewRequiredCount,
    folderConfiguration: { linksPerFolder: safeLinksPerFolder, totalFolders: chunks.length },
    folders: folderSummaries,
    screenshotsPdfParts: pdfParts.map(({ fileName, pageCount }) => ({ fileName, pageCount })),
    processingOutcome: job.reviewRequiredCount > 0 ? 'GENERATED_WITH_REVIEW_ITEMS' : 'SUCCESSFUL',
    links: eligibleLinks.map((link) => {
      const relatedShots = matchedScreenshots.filter((shot) => shot.batchLinkId === link.batchLinkId || (link.matchedProfileId && shot.matchedProfileId === link.matchedProfileId));
      const source = batchManifest?.links.find((item) => item.linkId === link.batchLinkId);
      return {
        linkId: link.batchLinkId || link.id,
        url: link.originalUrl,
        profileId: link.matchedPublicProfileId || link.matchedProfileId || source?.profileId,
        sourceProfileId: source?.sourceProfileId || source?.profileId,
        mfpProfileId: link.matchedPublicProfileId,
        postIds: [...new Set([...(source?.postIds ?? []), ...(link.matchedPostId ? [link.matchedPostId] : [])])],
        postLinks: source?.postLinks?.map((post) => ({ postId: post.postId || post.internalPostId || '', url: post.url })) ?? [],
        screenshotIds: [...new Set([...(source?.screenshotIds ?? []), ...(source?.screenshots ?? []).map((shot) => shot.screenshotId || shot.screenshot_id || shot.id || '').filter(Boolean), ...relatedShots.map((shot, shotIndex) => `SHOT-${job.jobId}-${Math.max(1, eligibleLinks.findIndex((item) => item.batchLinkId === link.batchLinkId) + 1)}-${shotIndex + 1}`)])],
        verificationStatus: link.status === 'MATCHED' && relatedShots.every((shot) => shot.status === 'MATCHED' && !shot.duplicateChecksum) ? 'NEEDS_REVIEW' as const : 'MISMATCH' as const,
      };
    }),
  };
  const manifestJson = JSON.stringify(manifest, null, 2);
  physicalZip.file('report-manifest.json', manifestJson);
  if (batchManifest) physicalZip.file('source-batch-manifest.json', JSON.stringify(batchManifest, null, 2));
  const physicalPackageZipBlob = await physicalZip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  const onlineZip = new JSZip();
  for (const part of pdfParts) onlineZip.file(part.fileName, part.blob);
  onlineZip.file('links.zip', linksZipBlob);
  onlineZip.file('report-manifest.json', manifestJson);
  if (batchManifest) onlineZip.file('source-batch-manifest.json', JSON.stringify(batchManifest, null, 2));
  const onlinePackageZipBlob = await onlineZip.generateAsync({ type: 'blob', compression: 'DEFLATE' });

  const packageId = `PKG-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
  try {
    await setDoc(doc(db, PACKAGES_COLLECTION, packageId), {
      packageId, jobId: job.jobId, createdBy: job.createdBy,
      fileMetadata: { totalFolders: chunks.length, linksCount: eligibleLinks.length, packageSizeBytes: physicalPackageZipBlob.size, onlinePackageSizeBytes: onlinePackageZipBlob.size },
      packageStatus: 'AVAILABLE', createdAt: new Date().toISOString(), expiresAt: job.expiresAt,
    });
  } catch (err) { console.warn('Could not persist package to Supabase database:', err); }

  return {
    packageZipBlob: physicalPackageZipBlob,
    physicalPackageZipBlob,
    onlinePackageZipBlob,
    linkTxtBlob: fullLinkTxtBlob,
    screenshotsZipBlob,
    screenshotsPdfBlob,
    screenshotsPdfPartCount: pdfParts.length,
    linksZipBlob,
    manifest,
    manifestJson,
  };
}

export async function listReportJobs(limitCount = 50): Promise<ReportJob[]> {
  const localJobs = localStore.getReportJobs();

  try {
    const q = query(
      collection(db, JOBS_COLLECTION),
      limit(limitCount)
    );
    const snap = await withTimeout(getDocs(q), 1800, null);
    if (snap && snap.docs.length > 0) {
      const records = snap.docs.map((d) => d.data() as ReportJob);
      // Merge with localStore
      records.forEach((r) => localStore.upsertReportJob(r));
      return localStore.getReportJobs().slice(0, limitCount);
    }
  } catch (err) {
    console.warn('Could not list report jobs from Supabase database:', err);
  }

  return localJobs.slice(0, limitCount);
}
