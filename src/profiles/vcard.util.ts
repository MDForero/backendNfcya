export interface VCardData {
  displayName: string;
  headline?: string | null;
  bio?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  locationLabel?: string | null;
  profileUrl: string;
}

/** Escapa un valor de texto según RFC 6350 §3.4 (también válido para vCard 3.0). */
export function escapeVCard(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\r\n|\r|\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

/** Pliega una línea a 75 octetos UTF-8 sin partir caracteres multibyte. */
export function foldLine(line: string): string {
  const out: string[] = [];
  let current = '';
  let bytes = 0;
  for (const char of line) {
    const size = Buffer.byteLength(char, 'utf8');
    const limit = out.length === 0 ? 75 : 74; // las continuaciones empiezan con un espacio
    if (bytes + size > limit) {
      out.push(current);
      current = '';
      bytes = 0;
    }
    current += char;
    bytes += size;
  }
  out.push(current);
  return out.join('\r\n ');
}

/** vCard 3.0 (la versión que mejor importan iOS y Android) solo con los datos recibidos. */
export function buildVCard(data: VCardData): string {
  const name = data.displayName.trim();
  const parts = name.split(/\s+/);
  const family = parts.length > 1 ? parts.pop()! : '';
  const given = parts.join(' ');

  const lines = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `FN:${escapeVCard(name)}`,
    `N:${escapeVCard(family)};${escapeVCard(given)};;;`,
  ];
  if (data.headline) lines.push(`TITLE:${escapeVCard(data.headline)}`);
  if (data.email) lines.push(`EMAIL;TYPE=INTERNET:${escapeVCard(data.email)}`);
  if (data.phone) lines.push(`TEL;TYPE=CELL:${escapeVCard(data.phone)}`);
  if (data.website) lines.push(`URL:${escapeVCard(data.website)}`);
  lines.push(`URL:${escapeVCard(data.profileUrl)}`);
  if (data.locationLabel)
    lines.push(`ADR;TYPE=WORK:;;${escapeVCard(data.locationLabel)};;;;`);
  if (data.bio) lines.push(`NOTE:${escapeVCard(data.bio)}`);
  lines.push('END:VCARD');

  return lines.map(foldLine).join('\r\n') + '\r\n';
}
