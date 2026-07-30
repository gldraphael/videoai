import { Pool } from "pg";

export type Database = {
  check(): Promise<{ database: string; schemaVersion: string }>;
  close(): Promise<void>;
};

export function createDatabase(connectionString: string): Database {
  const pool = new Pool({ connectionString });

  return {
    async check() {
      const result = await pool.query<{
        database: string;
        schema_version: string;
      }>(
        `
          select
            current_database() as database,
            coalesce(
              (select value from app_metadata where key = 'schema_version'),
              'unknown'
            ) as schema_version
        `
      );

      const row = result.rows[0];
      if (!row) {
        throw new Error("database check returned no rows");
      }

      return {
        database: row.database,
        schemaVersion: row.schema_version
      };
    },

    async close() {
      await pool.end();
    }
  };
}
