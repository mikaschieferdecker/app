import Database from 'better-sqlite3';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export type DB = Database.Database;

const here = dirname(fileURLToPath(import.meta.url));

/** The bundled schema, applied by {@link openDb} on a fresh database. */
export const SCHEMA_SQL = readFileSync(join(here, 'schema.sql'), 'utf8');

export interface OpenDbOptions {
  /** File path for the database, or ':memory:' (default) for an ephemeral one. */
  filename?: string;
  /** Apply schema.sql on open. Defaults to true. */
  migrate?: boolean;
  /** Passed through to better-sqlite3 (e.g. { verbose: console.log }). */
  verbose?: (message?: unknown, ...args: unknown[]) => void;
}

/**
 * Opens (and, by default, migrates) the recovery database.
 *
 * Foreign key enforcement is turned on for every connection — SQLite defaults
 * it to off, and the schema relies on ON DELETE CASCADE / SET NULL.
 */
export function openDb(options: OpenDbOptions = {}): DB {
  const { filename = ':memory:', migrate = true, verbose } = options;
  const db = new Database(filename, verbose ? { verbose } : {});
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  if (migrate) db.exec(SCHEMA_SQL);
  return db;
}
