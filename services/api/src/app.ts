import Fastify, { type FastifyInstance } from "fastify";
import type { ApiConfig } from "./config.js";
import type { Database } from "./db.js";
import { readDevassetStatus } from "./devassets.js";
import { ClipAssistantChatService, validateChatRequest } from "./chat.js";
import {
  ClipIndexCache,
  validateClipSearchRequest,
  type ClipSearchService
} from "./clips.js";
import {
  mediaSuffixFromParams,
  resolveMediaRoutePath,
  sendGeneratedMedia
} from "./media.js";

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
  const chat = new ClipAssistantChatService(clipSearch);

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

  app.post("/chat", async (request, reply) => {
    const validation = validateChatRequest(request.body);
    if (!validation.ok) {
      return reply.code(400).send({
        error: "validation_error",
        message: validation.message
      });
    }

    const result = await chat.respond(validation.value);
    if (!result.ready) {
      return reply.code(503).send({
        error: "devassets_not_ready",
        message: result.devassets.message,
        devassets: result.devassets
      });
    }

    return result.response;
  });

  app.get("/media/thumbnails/*", async (request, reply) =>
    sendGeneratedMedia(
      request,
      reply,
      resolveMediaRoutePath(
        options.config.thumbnailRoot,
        mediaSuffixFromParams(request.params),
        "thumbnail"
      )
    )
  );

  app.get("/media/devassets/*", async (request, reply) =>
    sendGeneratedMedia(
      request,
      reply,
      resolveMediaRoutePath(
        options.config.devassetRoot,
        mediaSuffixFromParams(request.params),
        "devasset-preview"
      )
    )
  );

  app.get("/media/*", async (_request, reply) =>
    reply.code(400).send({
      error: "invalid_media_path",
      message: "Media routes only expose generated thumbnails and devasset previews."
    })
  );

  return app;
}
