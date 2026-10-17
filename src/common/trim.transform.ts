import { Transform } from 'class-transformer';

/** Recorta espacios de los strings recibidos; deja otros tipos para que los rechace la validación. */
export const Trim = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  );
