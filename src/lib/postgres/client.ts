import * as path from 'node:path';
import { createRequire } from 'node:module';

type QueryResult<T = unknown> = {
  rows: T[];
  rowCount: number | null;
};

type PoolLike = {
  query: <T = unknown>(text: string, values?: unknown[]) => Promise<QueryResult<T>>;
};

type PgModuleLike = {
  Pool?: new (options: { connectionString: string }) => PoolLike;
  default?: {
    Pool?: new (options: { connectionString: string }) => PoolLike;
  };
};

const globalForPostgres = globalThis as typeof globalThis & {
  __ffPostgresPool?: PoolLike;
};

const requireFromHere = createRequire(path.join(process.cwd(), 'package.json'));

function tryRequire(moduleId: string): PgModuleLike | null {
  try {
    return requireFromHere(moduleId) as PgModuleLike;
  } catch {
    return null;
  }
}

function loadPgModule(): PgModuleLike {
  const fromRoot = tryRequire('pg');
  if (fromRoot) {
    return fromRoot;
  }

  const fromV2Path = path.join(process.cwd(), 'apps/v2/node_modules/pg');
  const fromV2 = tryRequire(fromV2Path);
  if (fromV2) {
    return fromV2;
  }

  throw new Error(
    'Módulo pg não encontrado. Instale "pg" no projeto raiz para acesso Postgres direto.'
  );
}

export function getPostgresPool(): PoolLike {
  if (globalForPostgres.__ffPostgresPool) {
    return globalForPostgres.__ffPostgresPool;
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL não configurada para acesso Postgres.');
  }

  const pgModule = loadPgModule();
  const PoolCtor = pgModule.Pool ?? pgModule.default?.Pool;

  if (!PoolCtor) {
    throw new Error('Não foi possível inicializar o Pool do módulo pg.');
  }

  globalForPostgres.__ffPostgresPool = new PoolCtor({ connectionString });
  return globalForPostgres.__ffPostgresPool;
}
