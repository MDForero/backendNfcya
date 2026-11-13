import { Transform } from 'class-transformer';

/** Recorta espacios de los strings recibidos; deja otros tipos para que los rechace la validación. */
export const Trim = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  );

/** Copia solo las propiedades definidas: un campo omitido en un PATCH no debe borrar datos. */
export function definedOnly<T extends object>(dto: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(dto).filter(([, value]) => value !== undefined),
  ) as Partial<T>;
}
