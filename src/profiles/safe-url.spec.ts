import { isSafeLinkUrl, isWebLink } from './safe-url';

describe('isSafeLinkUrl', () => {
  it.each([
    'https://nfcya.com',
    'http://example.com/ruta?x=1',
    'https://wa.me/573001234567',
    'mailto:ana@example.com',
    'tel:+573001234567',
    'http://localhost:3000/p/ana',
  ])('acepta %s', (url) => expect(isSafeLinkUrl(url)).toBe(true));

  it.each([
    'javascript:alert(1)',
    'JaVaScRiPt:alert(1)',
    'java\tscript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'vbscript:msgbox',
    'file:///etc/passwd',
    'ftp://example.com',
    'https://user:pass@example.com',
    'https://sin-tld',
    'example.com',
    'https://exa mple.com',
    'mailto:no-es-email',
    'tel:abc',
    `https://example.com/${'a'.repeat(2048)}`,
    42,
    null,
  ])('rechaza %p', (url) => expect(isSafeLinkUrl(url)).toBe(false));
});

describe('isWebLink', () => {
  it('con httpsOnly rechaza http', () => {
    expect(isWebLink('http://example.com/a.png', true)).toBe(false);
    expect(isWebLink('https://example.com/a.png', true)).toBe(true);
  });

  it('no acepta mailto ni tel', () => {
    expect(isWebLink('mailto:ana@example.com')).toBe(false);
    expect(isWebLink('tel:+57300')).toBe(false);
  });
});
