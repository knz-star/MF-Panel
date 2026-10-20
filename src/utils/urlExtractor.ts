import { normalizeUrl, NormalizedUrlResult } from './urlNormalizer';

export interface ExtractedBatchItem {
  id: string;
  lineNumber: number;
  rawText: string;
  senderInfo?: string;
  timestampInfo?: string;
  extractedUrl: string;
  normalized: NormalizedUrlResult;
  isDuplicateInBatch: boolean;
}

/**
 * Robust regex to capture web URLs, including those without scheme if starting with common domains,
 * or standard http/https schemes.
 */
const URL_REGEX = /(?:https?:\/\/|www\.)[^\s<>"'()[\]{}|\\^`]+/gi;

/**
 * Extracts URLs from unstructured chat logs (WhatsApp, Telegram, Notes, multiline pastes).
 */
export function extractUrlsFromChatText(rawText: string): ExtractedBatchItem[] {
  if (!rawText) return [];

  const lines = rawText.split(/\r?\n/);
  const results: ExtractedBatchItem[] = [];
  const seenUrls = new Set<string>();

  // WhatsApp/Telegram header regex:
  // e.g. "[10/12/26, 10:15:23 AM] Alice:" or "10/12/2026, 10:15 - Bob:" or "Alice [10:15]:"
  const chatHeaderRegex = /^(?:\[?(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}[,\s]+\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AP]M)?)\]?\s*[-:]?\s*)?([^:]+):\s*(.*)$/i;

  let globalIndex = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    let senderInfo: string | undefined;
    let timestampInfo: string | undefined;

    // Check for WhatsApp/Telegram timestamp headers
    const chatHeaderWithTimeRegex = /^\[?(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}[,\s]+\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AP]M)?)\]?\s*[-:]?\s*([^:]+):\s*(.*)$/i;
    const chatHeaderSimpleRegex = /^([a-zA-Z0-9_\s]{2,25}):\s+(https?:\/\/.*)$/i;

    const timeMatch = line.match(chatHeaderWithTimeRegex);
    if (timeMatch) {
      timestampInfo = timeMatch[1]?.trim();
      senderInfo = timeMatch[2]?.trim();
    } else {
      const simpleMatch = line.match(chatHeaderSimpleRegex);
      if (simpleMatch) {
        senderInfo = simpleMatch[1]?.trim();
      }
    }

    // Match all URLs across the entire line
    const matches = line.match(URL_REGEX);
    if (matches) {
      for (const match of matches) {
        // Strip trailing punctuation from the matched string
        let cleanMatch = match.replace(/[.,;:!?)]+$/, '');
        if (!cleanMatch) continue;

        const normalized = normalizeUrl(cleanMatch);
        const dedupeKey = normalized.canonicalKey || normalized.normalizedUrl.toLowerCase();
        const isDuplicateInBatch = seenUrls.has(dedupeKey);
        seenUrls.add(dedupeKey);

        globalIndex++;
        results.push({
          id: `ext_${Date.now()}_${globalIndex}`,
          lineNumber: i + 1,
          rawText: line,
          senderInfo,
          timestampInfo,
          extractedUrl: cleanMatch,
          normalized,
          isDuplicateInBatch,
        });
      }
    }
  }

  return results;
}
