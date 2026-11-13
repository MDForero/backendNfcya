import { normalizeSlug, slugProblem } from './slug.util';

describe('normalizeSlug', () => {
  it.each([
    ['Juan Pérez', 'juan-perez'],
    ['  ÑANDÚ & Cía.  ', 'nandu-cia'],
    ['--hola__mundo--', 'hola-mundo'],
    ['MiEmpresa123', 'miempresa123'],
    ['😀 emoji 😀', 'emoji'],
    ['', ''],
  ])('%j → %j', (input, expected) => {
    expect(normalizeSlug(input)).toBe(expected);
  });

  it('recorta a 40 caracteres sin dejar guion final', () => {
    const slug = normalizeSlug(`${'a'.repeat(39)} b`);
    expect(slug.length).toBeLessThanOrEqual(40);
    expect(slug.endsWith('-')).toBe(false);
  });
});

describe('slugProblem', () => {
  it('acepta slugs válidos', () => {
    expect(slugProblem('juan-perez')).toBeNull();
  });

  it.each([
    'ab',
    'a'.repeat(41),
    'Mayus',
    'con espacio',
    '-borde',
    'doble--guion',
  ])('rechaza %j', (slug) => expect(slugProblem(slug)).not.toBeNull());

  it('rechaza slugs reservados', () => {
    expect(slugProblem('admin')).toBe('Ese slug está reservado');
  });
});
