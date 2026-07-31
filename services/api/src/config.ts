export type ApiConfig = {
  databaseUrl: string;
  devassetLibraryPath: string;
  devassetStatusPath: string;
  host: string;
  port: number;
};

function numberFromEnv(name: string, fallback: number): number {
  const value = process.env[name];
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }

  return parsed;
}

export function readConfig(): ApiConfig {
  const devassetsDir = process.env.DEVASSETS_DIR ?? "var/devassets";

  return {
    databaseUrl:
      process.env.DATABASE_URL ?? "postgres://videoai:videoai@localhost:5432/videoai",
    devassetLibraryPath:
      process.env.DEVASSET_LIBRARY_PATH ?? `${devassetsDir}/library.json`,
    devassetStatusPath:
      process.env.DEVASSET_STATUS_PATH ?? `${devassetsDir}/.seed/status.json`,
    host: process.env.API_HOST ?? "0.0.0.0",
    port: numberFromEnv("API_PORT", 8080)
  };
}
