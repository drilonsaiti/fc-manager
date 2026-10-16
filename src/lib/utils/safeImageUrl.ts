/**
 * Accept remote team artwork only from ordinary HTTPS hostnames. Images are rendered
 * directly in the browser (never through the Next image optimizer), so reject local,
 * credential-bearing, non-HTTPS and nonstandard-port URLs before they are persisted.
 */
export function safeImageUrl(value: string | null | undefined): string | null {
  const raw = value?.trim();
  if (!raw) return null;

  try {
    const url = new URL(raw);
    const host = url.hostname.toLowerCase();
    if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443")) return null;
    if (host.length > 253) return null;
    const labels = host.split(".");
    if (labels.length < 2 || labels.some((label) => label.length > 63 || !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label))) return null;
    if (/(^|\.)(localhost|local|internal|test|example|invalid|home|lan|intranet|corp|home\.arpa)$/.test(host)) return null;
    // IP literals are deliberately unsupported; this prevents obvious loopback/private-network targets.
    if (/^\[?[0-9a-f:.]+\]?$/i.test(host) || /^\d+$/.test(host)) return null;
    return url.href;
  } catch {
    return null;
  }
}
