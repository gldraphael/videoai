import Fastify, { type FastifyInstance } from "fastify";
import type { ApiConfig } from "./config.js";
import type { Database } from "./db.js";
import { readDevassetStatus } from "./devassets.js";
import {
  ClipIndexCache,
  validateClipSearchRequest,
  type ClipSearchService
} from "./clips.js";

export type CreateApiAppOptions = {
  config: ApiConfig;
  database: Database;
  clipSearch?: ClipSearchService;
  logger?: boolean;
};

export function createApiApp(options: CreateApiAppOptions): FastifyInstance {
  const app = Fastify({ logger: options.logger ?? true });
  const clipSearch =
    options.clipSearch ??
    new ClipIndexCache({
      statusPath: options.config.devassetStatusPath,
      libraryPath: options.config.devassetLibraryPath,
      devassetRoot: options.config.devassetRoot,
      thumbnailRoot: options.config.thumbnailRoot
    });

  app.get("/health", async () => ({
    service: "api",
    status: "ok"
  }));

  app.get("/health/db", async () => {
    const check = await options.database.check();

    return {
      service: "api",
      status: "ok",
      database: check.database,
      schemaVersion: check.schemaVersion
    };
  });

  app.get("/devassets/status", async () =>
    readDevassetStatus({
      statusPath: options.config.devassetStatusPath,
      libraryPath: options.config.devassetLibraryPath
    })
  );

  app.post("/clips/search", async (request, reply) => {
    const validation = validateClipSearchRequest(request.body);
    if (!validation.ok) {
      return reply.code(400).send({
        error: "validation_error",
        message: validation.message
      });
    }

    const result = await clipSearch.search(validation.value);
    if (!result.ready) {
      return reply.code(503).send({
        error: "devassets_not_ready",
        message: result.devassets.message,
        devassets: result.devassets
      });
    }

    return result.response;
  });

  return app;
}
