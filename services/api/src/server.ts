import Fastify from "fastify";
import { createDatabase } from "./db.js";
import { readDevassetStatus } from "./devassets.js";
import { readConfig } from "./config.js";

const config = readConfig();
const database = createDatabase(config.databaseUrl);
const app = Fastify({ logger: true });

app.get("/health", async () => ({
  service: "api",
  status: "ok"
}));

app.get("/health/db", async () => {
  const check = await database.check();

  return {
    service: "api",
    status: "ok",
    database: check.database,
    schemaVersion: check.schemaVersion
  };
});

app.get("/devassets/status", async () =>
  readDevassetStatus({
    statusPath: config.devassetStatusPath,
    libraryPath: config.devassetLibraryPath
  })
);

async function shutdown() {
  await database.close();
  await app.close();
}

process.on("SIGINT", () => {
  shutdown().finally(() => process.exit(0));
});

process.on("SIGTERM", () => {
  shutdown().finally(() => process.exit(0));
});

try {
  await app.listen({ host: config.host, port: config.port });
} catch (error) {
  app.log.error(error);
  await shutdown();
  process.exit(1);
}
