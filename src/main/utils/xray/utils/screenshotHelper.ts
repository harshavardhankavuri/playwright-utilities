import * as fs from 'fs';
import * as path from 'path';
import type { XRayEvidence } from '../types';

const MIME_MAP: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
};

/**
 * Reads a screenshot file and converts it to X-Ray evidence format.
 * Returns null on any error — never throws.
 */
export function screenshotToEvidence(filePath: string): XRayEvidence | null {
  try {
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_MAP[ext];
    if (!contentType) return null;

    const buffer = fs.readFileSync(filePath);
    const data = buffer.toString('base64');
    const filename = path.basename(filePath);

    return { data, filename, contentType };
  } catch {
    return null;
  }
}

/**
 * Filters an array of Playwright attachments to existing image file paths.
 *
 * An attachment qualifies if:
 *   - contentType starts with "image/", OR
 *   - name is "screenshot", OR
 *   - path matches an image extension
 *
 * AND the file exists on disk.
 */
export function extractScreenshots(
  attachments: Array<{ name?: string; contentType?: string; path?: string }>,
): string[] {
  const imageExtRe = /\.(png|jpe?g|webp)$/i;
  const paths: string[] = [];

  for (const att of attachments) {
    if (!att.path) continue;

    const isImage =
      att.contentType?.startsWith('image/') ||
      att.name === 'screenshot' ||
      imageExtRe.test(att.path);

    if (isImage && fs.existsSync(att.path)) {
      paths.push(att.path);
    }
  }

  return paths;
}
