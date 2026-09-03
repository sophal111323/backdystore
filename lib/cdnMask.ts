/**
 * Rewrites legacy infrastructure domains (e.g. cdn.rithtopup.com) to a safe,
 * local proxy route (/api/cdn/...) to prevent internal infrastructure disclosure.
 */
export function maskCdnUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;

  // Mask legacy infrastructure domain
  if (/cdn\.rithtopup\.com/i.test(trimmed)) {
    const cleanPath = trimmed.replace(/^https?:\/\/cdn\.rithtopup\.com\/?/i, "");
    return `/api/cdn/${cleanPath}`;
  }

  return trimmed;
}

