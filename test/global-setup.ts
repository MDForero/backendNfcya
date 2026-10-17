/**
 * Deja la base de test (DATABASE_URL de .env.test) vacía y con todas las migraciones
 * aplicadas antes de ejecutar las suites e2e.
 */
export default async function globalSetup() {
  process.env.NODE_ENV = 'test';
  // require (no import estático) para que NODE_ENV=test ya esté puesto al cargar el .env.
  const { default: dataSource } =
    require('../src/database/data-source') as typeof import('../src/database/data-source');

  if (!/_test\b/.test(process.env.DATABASE_URL ?? '')) {
    throw new Error(
      'Los tests e2e solo corren contra una base cuyo nombre termine en _test',
    );
  }

  await dataSource.initialize();
  await dataSource.query('DROP SCHEMA public CASCADE');
  await dataSource.query('CREATE SCHEMA public');
  await dataSource.destroy();

  // Al reconectar TypeORM vuelve a crear la extensión uuid-ossp que usan las migraciones.
  await dataSource.initialize();
  await dataSource.runMigrations();
  await dataSource.destroy();
}
