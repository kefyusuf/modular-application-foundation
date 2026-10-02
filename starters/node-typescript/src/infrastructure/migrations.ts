import { createHash } from 'node:crypto';
import type { SqlDatabase, SqlMigration } from '../kernel/sql.js';

export async function runMigrations(database: SqlDatabase, schema: string, migrations: readonly SqlMigration[]): Promise<void> {
  if (!/^[a-z][a-z0-9_]{0,62}$/.test(schema)) throw new Error('Invalid migration schema');
  let previousVersion = 0;
  const catalog = migrations.map((migration) => {
    if (!Number.isInteger(migration.version) || migration.version <= previousVersion || migration.version > 2147483647 || !migration.name.trim()) {
      throw new Error('Invalid migration catalog');
    }
    previousVersion = migration.version;
    const checksum = createHash('sha256').update(JSON.stringify([migration.version, migration.name, migration.statements])).digest('hex');
    return { ...migration, checksum };
  });
  const historyTable = `"${schema}".schema_migrations`;
  await database.withinTransaction(async () => {
    await database.query(`CREATE SCHEMA IF NOT EXISTS "${schema}"`);
    await database.query(`CREATE TABLE IF NOT EXISTS ${historyTable} (
      version integer PRIMARY KEY, name text NOT NULL, checksum text NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT now()
    )`);
    const { rows } = await database.query<{ version: number; name: string; checksum: string }>(`SELECT version, name, checksum FROM ${historyTable} ORDER BY version`);
    // Applied migrations must be an unchanged prefix of the supplied catalog.
    for (const [index, applied] of rows.entries()) {
      const migration = catalog[index];
      if (!migration || migration.version !== applied.version) throw new Error('Migration history does not match catalog');
      if (migration.name !== applied.name || migration.checksum !== applied.checksum) throw new Error('Applied migration changed');
    }
    for (const migration of catalog.slice(rows.length)) {
      for (const statement of migration.statements) await database.query(statement);
      await database.query(`INSERT INTO ${historyTable} (version, name, checksum) VALUES ($1, $2, $3)`, [migration.version, migration.name, migration.checksum]);
    }
  });
}
