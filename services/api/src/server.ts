import { createDatabase } from "./db.js";
import { readConfig } from "./config.js";
import { createApiApp } from "./app.js";

const config = readConfig();
const database = createDatabase(config.databaseUrl);
const app = createApiApp({ config, database });

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
