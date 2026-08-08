import { readConfig } from "./config.js";
import { createApiApp } from "./app.js";

const config = readConfig();
const app = createApiApp({ config });

async function shutdown() {
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
