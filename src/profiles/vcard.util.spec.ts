import { buildVCard, escapeVCard, foldLine } from './vcard.util';

describe('escapeVCard', () => {
  it('escapa barra, coma, punto y coma y saltos de línea', () => {
    expect(escapeVCard('a\\b, c; d\r\ne\nf')).toBe('a\\\\b\\, c\\; d\\ne\\nf');
  });
});

describe('foldLine', () => {
  it('no pliega líneas de hasta 75 octetos', () => {
    const line = 'x'.repeat(75);
    expect(foldLine(line)).toBe(line);
  });

  it('pliega a 75 octetos sin partir caracteres multibyte', () => {
    const folded = foldLine(`NOTE:${'ñ'.repeat(100)}`);
    const parts = folded.split('\r\n');
    expect(parts.length).toBeGreaterThan(1);
    for (const part of parts)
      expect(Buffer.byteLength(part, 'utf8')).toBeLessThanOrEqual(75);
    expect(parts.slice(1).every((p) => p.startsWith(' '))).toBe(true);
    expect(parts.map((p, i) => (i ? p.slice(1) : p)).join('')).toBe(
      `NOTE:${'ñ'.repeat(100)}`,
    );
  });
});

describe('buildVCard', () => {
  const base = {
    displayName: 'José Pérez Gómez',
    profileUrl: 'https://nfcya.test/p/jose',
  };

  it('genera vCard 3.0 con CRLF y solo los campos recibidos', () => {
    const card = buildVCard(base);
    expect(card.startsWith('BEGIN:VCARD\r\nVERSION:3.0\r\n')).toBe(true);
    expect(card.endsWith('END:VCARD\r\n')).toBe(true);
    expect(card).toContain('FN:José Pérez Gómez\r\n');
    expect(card).toContain('N:Gómez;José Pérez;;;\r\n');
    expect(card).toContain('URL:https://nfcya.test/p/jose\r\n');
    expect(card).not.toMatch(/EMAIL|TEL|NOTE|TITLE/);
  });

  it('incluye email, teléfono y notas escapadas cuando se autorizan', () => {
    const card = buildVCard({
      ...base,
      headline: 'CEO; fundador',
      email: 'jose@example.com',
      phone: '+57 300 123 4567',
      bio: 'Línea 1\nLínea 2, con coma',
    });
    expect(card).toContain('TITLE:CEO\\; fundador\r\n');
    expect(card).toContain('EMAIL;TYPE=INTERNET:jose@example.com\r\n');
    expect(card).toContain('TEL;TYPE=CELL:+57 300 123 4567\r\n');
    expect(card).toContain('NOTE:Línea 1\\nLínea 2\\, con coma\r\n');
  });

  it('un nombre de una sola palabra va como nombre de pila', () => {
    expect(buildVCard({ ...base, displayName: 'Cher' })).toContain(
      'N:;Cher;;;\r\n',
    );
  });
});
