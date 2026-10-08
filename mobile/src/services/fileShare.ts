/**
 * Save an exported report file to cache and open the system share dialog.
 * Uses react-native-fs + react-native-share (native modules — requires
 * one native rebuild after install).
 */
import RNFS from 'react-native-fs';
import Share from 'react-native-share';
import { ExportedFile } from './reportApi';

/** ArrayBuffer -> base64 (chunked to avoid call-stack limits on large files). */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunk = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(
      null,
      bytes.subarray(i, i + chunk) as unknown as number[],
    );
  }
  // btoa exists in the React Native runtime (Hermes/JSC)
  const btoaFn: (s: string) => string = (globalThis as { btoa?: (s: string) => string }).btoa
    ?? ((s: string) => {
      // fallback: manual base64 (should never be needed on RN)
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
      let out = '';
      let i = 0;
      while (i < s.length) {
        const a = s.charCodeAt(i++);
        const b = s.charCodeAt(i++);
        const c = s.charCodeAt(i++);
        const n = (a << 16) | (b << 8) | c;
        out += chars[(n >> 18) & 63] + chars[(n >> 12) & 63]
          + (isNaN(b) ? '=' : chars[(n >> 6) & 63])
          + (isNaN(b) || isNaN(c) ? '=' : chars[n & 63]);
      }
      return out;
    });
  return btoaFn(binary);
}

/**
 * Writes the file to the app cache dir and opens the OS share sheet.
 * Returns true when the share dialog was opened.
 */
export async function saveAndShare(file: ExportedFile): Promise<boolean> {
  const base64 = arrayBufferToBase64(file.data);
  // sanitize filename: keep alphanumerics, dash, underscore, dot
  const safeName = file.filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `${RNFS.CachesDirectoryPath}/${safeName}`;

  await RNFS.writeFile(path, base64, 'base64');

  const result = await Share.open({
    url: `file://${path}`,
    type: file.contentType,
    filename: safeName,
    failOnCancel: false,
  });
  return result !== undefined;
}

/** Removes a previously written cache file (best-effort). */
export async function cleanupCacheFile(filename: string): Promise<void> {
  try {
    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `${RNFS.CachesDirectoryPath}/${safeName}`;
    if (await RNFS.exists(path)) {
      await RNFS.unlink(path);
    }
  } catch {
    // best-effort
  }
}
