import JSZip from 'jszip';
import { BlobReader, Uint8ArrayWriter, ZipReader } from '@zip.js/zip.js';

export interface ZipValidationLimits {
  maxSizeBytes: number; // e.g. 100MB
  maxEntries: number; // e.g. 5000 files
  maxUncompressedSizeBytes: number; // e.g. 500MB
  maxCompressionRatio: number; // e.g. 50:1
}

export const DEFAULT_ZIP_LIMITS: ZipValidationLimits = {
  maxSizeBytes: 100 * 1024 * 1024, // 100 MB
  maxEntries: 5000,
  maxUncompressedSizeBytes: 500 * 1024 * 1024, // 500 MB
  maxCompressionRatio: 50,
};

export interface ZipValidationResult {
  isValid: boolean;
  zipInstance?: JSZip;
  totalEntries: number;
  totalUncompressedSize: number;
  errors: string[];
  warnings: string[];
  entryList: {
    path: string;
    isDir: boolean;
    size: number;
    isText: boolean;
    isImage: boolean;
  }[];
}

/**
 * Checks for unsafe path traversal characters such as "../" or Windows-style backslashes.
 */
export function isUnsafePath(path: string): boolean {
  if (path.includes('..') || path.startsWith('/') || path.startsWith('\\') || /^[a-z]:[\\/]/i.test(path) || path.includes('\u0000')) {
    return true;
  }
  // Check for dangerous system files
  const lower = path.toLowerCase();
  if (
    lower.endsWith('.exe') ||
    lower.endsWith('.bat') ||
    lower.endsWith('.cmd') ||
    lower.endsWith('.sh') ||
    lower.endsWith('.vbs')
  ) {
    return true;
  }
  return false;
}


async function hasEncryptedEntries(file: Blob): Promise<boolean> {
  const tailStart = Math.max(0, file.size - 65557);
  const tail = new Uint8Array(await file.slice(tailStart).arrayBuffer());
  let eocd = -1;
  for (let i = tail.length - 22; i >= 0; i--) {
    if (tail[i] === 0x50 && tail[i + 1] === 0x4b && tail[i + 2] === 0x05 && tail[i + 3] === 0x06) { eocd = i; break; }
  }
  if (eocd < 0 || eocd + 20 >= tail.length) return false;
  const centralOffset = new DataView(tail.buffer, tail.byteOffset + eocd, tail.length - eocd).getUint32(16, true);
  if (!Number.isFinite(centralOffset) || centralOffset >= file.size) return false;
  const central = new Uint8Array(await file.slice(centralOffset).arrayBuffer());
  let offset = 0;
  while (offset + 46 <= central.length && central[offset] === 0x50 && central[offset + 1] === 0x4b && central[offset + 2] === 0x01 && central[offset + 3] === 0x02) {
    const view = new DataView(central.buffer, central.byteOffset + offset, central.length - offset);
    const flags = view.getUint16(8, true);
    const nameLength = view.getUint16(28, true);
    const extraLength = view.getUint16(30, true);
    const commentLength = view.getUint16(32, true);
    if ((flags & 0x0001) !== 0) return true;
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return false;
}

/**
 * Validates and safely loads a ZIP file in memory, enforcing zip bomb and security boundaries.
 */
export async function validateAndLoadZip(
  file: File | Blob,
  customLimits: Partial<ZipValidationLimits> = {},
  password?: string
): Promise<ZipValidationResult> {
  const limits = { ...DEFAULT_ZIP_LIMITS, ...customLimits };
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. Initial size check
  if (file.size > limits.maxSizeBytes) {
    errors.push(
      `Archive file size (${(file.size / (1024 * 1024)).toFixed(1)}MB) exceeds maximum limit of ${(limits.maxSizeBytes / (1024 * 1024)).toFixed(0)}MB.`
    );
    return {
      isValid: false,
      totalEntries: 0,
      totalUncompressedSize: 0,
      errors,
      warnings,
      entryList: [],
    };
  }

  let zip: JSZip;
  const decryptedSizes = new Map<string, number>();
  try {
    const encrypted = await hasEncryptedEntries(file);
    if (encrypted && !password) {
      errors.push('This ZIP is encrypted. Enter its AES/ZIP password before analysis; no files were extracted.');
      return { isValid: false, totalEntries: 0, totalUncompressedSize: 0, errors, warnings, entryList: [] };
    }
    if (password) {
      // zip.js supports traditional/WinZip AES encrypted archives; materialize the
      // decrypted entries into JSZip so the existing analysis pipeline stays unchanged.
      const reader = new ZipReader(new BlobReader(file));
      try {
        const entries = await reader.getEntries();
        if (entries.length > limits.maxEntries) throw new Error(`Archive contains ${entries.length} entries; limit is ${limits.maxEntries}.`);
        const estimatedSize = entries.reduce((sum, entry) => sum + (entry.directory ? 0 : Number(entry.uncompressedSize || 0)), 0);
        if (estimatedSize > limits.maxUncompressedSizeBytes) throw new Error(`Decrypted archive exceeds the ${Math.round(limits.maxUncompressedSizeBytes / (1024 * 1024))} MB uncompressed size limit.`);
        if (file.size > 0 && estimatedSize / file.size > limits.maxCompressionRatio) throw new Error(`Unsafe compression ratio detected (${Math.round(estimatedSize / file.size)}:1).`);
        for (const entry of entries) if (isUnsafePath(entry.filename)) throw new Error(`Unsafe archive path: ${entry.filename}`);
        zip = new JSZip();
        for (const entry of entries) {
          if (entry.directory) { zip.folder(entry.filename); continue; }
          if (entry.filename.includes('__MACOSX/') || entry.filename.endsWith('.DS_Store')) continue;
          const bytes = await entry.getData(new Uint8ArrayWriter(), { password });
          decryptedSizes.set(entry.filename, Number(entry.uncompressedSize || bytes.byteLength));
          zip.file(entry.filename, bytes, { binary: true, createFolders: true });
        }
      } finally {
        await reader.close();
      }
    } else {
      zip = await JSZip.loadAsync(file);
    }
  } catch (err: any) {
    const message = String(err?.message || 'Failed to parse');
    const validationFailure = /limit is|exceeds the|unsafe compression ratio|unsafe archive path|too many entries/i.test(message);
    errors.push(validationFailure
      ? message
      : password
        ? `Could not decrypt/read ZIP. Check the password and archive integrity: ${message}`
        : `Archive could not be opened. If it uses AES encryption, enter its ZIP password and retry. Details: ${message}`);
    return {
      isValid: false,
      totalEntries: 0,
      totalUncompressedSize: 0,
      errors,
      warnings,
      entryList: [],
    };
  }

  const fileKeys = Object.keys(zip.files);
  const totalEntries = fileKeys.length;

  if (totalEntries === 0) {
    errors.push('Archive is empty.');
    return {
      isValid: false,
      totalEntries: 0,
      totalUncompressedSize: 0,
      errors,
      warnings,
      entryList: [],
    };
  }

  if (totalEntries > limits.maxEntries) {
    errors.push(
      `Archive contains ${totalEntries} entries, which exceeds the limit of ${limits.maxEntries}.`
    );
  }

  let totalUncompressedSize = 0;
  const entryList: ZipValidationResult['entryList'] = [];

  for (const path of fileKeys) {
    const entry = zip.files[path];

    if (isUnsafePath(path)) {
      errors.push(`Archive contains forbidden or unsafe file path: "${path}"`);
    }

    // Skip MacOS resource fork folders
    if (path.includes('__MACOSX/') || path.endsWith('.DS_Store')) {
      continue;
    }

    // Approximate size from internal zip entry data or 0 for directory
    const size = decryptedSizes.get(path) ?? ((entry as any)._data ? (entry as any)._data.uncompressedSize || ((entry as any)._data.byteLength ?? 0) : 0);
    totalUncompressedSize += size;

    const lowerPath = path.toLowerCase();
    const isText = lowerPath.endsWith('.txt') || lowerPath.endsWith('.csv') || lowerPath.endsWith('.json');
    const isImage =
      lowerPath.endsWith('.png') ||
      lowerPath.endsWith('.jpg') ||
      lowerPath.endsWith('.jpeg') ||
      lowerPath.endsWith('.webp');

    entryList.push({
      path,
      isDir: entry.dir,
      size,
      isText,
      isImage,
    });
  }

  // 2. Uncompressed size limit check
  if (totalUncompressedSize > limits.maxUncompressedSizeBytes) {
    errors.push(
      `Total uncompressed size (${(totalUncompressedSize / (1024 * 1024)).toFixed(1)}MB) exceeds limit of ${(limits.maxUncompressedSizeBytes / (1024 * 1024)).toFixed(0)}MB.`
    );
  }

  // 3. Zip bomb ratio check
  if (file.size > 0 && totalUncompressedSize / file.size > limits.maxCompressionRatio) {
    errors.push(
      `Unsafe compression ratio detected (${(totalUncompressedSize / file.size).toFixed(0)}:1). Archive rejected for security reasons.`
    );
  }

  return {
    isValid: errors.length === 0,
    zipInstance: zip,
    totalEntries,
    totalUncompressedSize,
    errors,
    warnings,
    entryList,
  };
}
