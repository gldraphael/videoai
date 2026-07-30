export type ApiConfig = {
  databaseUrl: string;
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
  return {
    databaseUrl:
      process.env.DATABASE_URL ?? "postgres://videoai:videoai@localhost:5432/videoai",
    host: process.env.API_HOST ?? "0.0.0.0",
    port: numberFromEnv("API_PORT", 8080)
  };
}
