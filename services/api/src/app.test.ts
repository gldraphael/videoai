import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { createApiApp } from "./app.js";
import { ClipIndexCache, type ClipSearchConfig } from "./clips.js";
import type { ApiConfig } from "./config.js";
import {
  errorDevassetStatus,
  mediaLibraryFixture,
  missingDevassetStatus,
  readyDevassetStatus,
  runningDevassetStatus,
  usableWhisperTranscript
} from "./clipFixtures.js";

test("POST /clips/search returns ranked clip results with required fields", async () => {
  const fixture = await createReadyFileFixture();
  const app = createApiApp({
    config: fixture.apiConfig,
    logger: false
  });

  try {
    const response = await app.inject({
      method: "POST",
      url: "/clips/search",
      payload: {
        query: "launch recap product demo",
        limit: 3
      }
    });

    assert.equal(response.statusCode, 200);
    const body = response.json();
    assert.equal(body.query, "launch recap product demo");
    assert.ok(Array.isArray(body.results));
    assert.ok(body.results.length > 0);

    const result = body.results[0];
    assert.equal(typeof result.id, "string");
    assert.equal(result.assetId, "launch-demo");
    assert.equal(result.title, "Launch Product Demo");
    assert.equal(typeof result.startMs, "number");
    assert.equal(typeof result.endMs, "number");
    assert.ok(result.startMs < result.endMs);
    assert.equal(typeof result.snippet, "string");
    assert.equal(result.thumbnailPath, "var/thumbnails/launch-demo.jpg");
    assert.equal(result.previewPath, "var/devassets/assets/launch-demo/test/source.mp4");
    assert.equal(typeof result.score, "number");
  } finally {
    await app.close();
    await rm(fixture.root, { recursive: true, force: true });
  }
});

test("POST /clips/search rejects invalid requests without querying the index", async () => {
  let searched = false;
  const app = createApiApp({
    config: apiConfigFixture(),
    clipSearch: {
      async search() {
        searched = true;
        throw new Error("search should not be called for invalid requests");
      }
    },
    logger: false
  });

  try {
    const emptyResponse = await app.inject({
      method: "POST",
      url: "/clips/search",
      payload: {
        query: "   "
      }
    });
    assert.equal(emptyResponse.statusCode, 400);
    assert.equal(emptyResponse.json().error, "validation_error");

    const limitResponse = await app.inject({
      method: "POST",
      url: "/clips/search",
      payload: {
        query: "launch",
        limit: 21
      }
    });
    assert.equal(limitResponse.statusCode, 400);
    assert.equal(limitResponse.json().error, "validation_error");
    assert.equal(searched, false);
  } finally {
    await app.close();
  }
});

test("POST /clips/search returns non-ready devasset states", async () => {
  for (const status of [
    missingDevassetStatus(),
    runningDevassetStatus(),
    errorDevassetStatus()
  ]) {
    const app = createApiApp({
      config: apiConfigFixture(),
      clipSearch: {
        async search() {
          return {
            ready: false,
            devassets: status
          };
        }
      },
      logger: false
    });

    try {
      const response = await app.inject({
        method: "POST",
        url: "/clips/search",
        payload: {
          query: "launch"
        }
      });

      assert.equal(response.statusCode, 503);
      assert.equal(response.json().error, "devassets_not_ready");
      assert.equal(response.json().devassets.state, status.state);
      assert.equal(response.json().message, status.message);
    } finally {
      await app.close();
    }
  }
});

test("clip search route does not require PostgreSQL when devassets are ready", async () => {
  const fixture = await createReadyFileFixture();
  const app = createApiApp({
    config: fixture.apiConfig,
    clipSearch: new ClipIndexCache(fixture.clipConfig),
    logger: false
  });

  try {
    const response = await app.inject({
      method: "POST",
      url: "/clips/search",
      payload: {
        query: "product demo"
      }
    });

    assert.equal(response.statusCode, 200);
    assert.ok(response.json().results.length > 0);
  } finally {
    await app.close();
    await rm(fixture.root, { recursive: true, force: true });
  }
});

test("default API routes work without DATABASE_URL", async () => {
  const previousDatabaseUrl = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;

  const fixture = await createReadyFileFixture();
  const app = createApiApp({
    config: fixture.apiConfig,
    logger: false
  });

  try {
    const health = await app.inject({
      method: "GET",
      url: "/health"
    });
    assert.equal(health.statusCode, 200);
    assert.equal(health.json().status, "ok");

    const devassets = await app.inject({
      method: "GET",
      url: "/devassets/status"
    });
    assert.equal(devassets.statusCode, 200);
    assert.equal(devassets.json().state, "ready");

    const clips = await app.inject({
      method: "POST",
      url: "/clips/search",
      payload: {
        query: "product demo"
      }
    });
    assert.equal(clips.statusCode, 200);
    assert.ok(clips.json().results.length > 0);

    const chat = await app.inject({
      method: "POST",
      url: "/chat",
      payload: {
        message: "product demo"
      }
    });
    assert.equal(chat.statusCode, 200);
    assert.equal(chat.json().content[1].type, "clip-candidates");

    const thumbnail = await app.inject({
      method: "GET",
      url: "/media/thumbnails/launch-demo.jpg"
    });
    assert.equal(thumbnail.statusCode, 200);
    assert.match(thumbnail.headers["content-type"] as string, /image\/jpeg/);

    const preview = await app.inject({
      method: "GET",
      url: "/media/devassets/assets/launch-demo/test/source.mp4"
    });
    assert.equal(preview.statusCode, 200);
    assert.match(preview.headers["content-type"] as string, /video\/mp4/);

    const dbHealth = await app.inject({
      method: "GET",
      url: "/health/db"
    });
    assert.equal(dbHealth.statusCode, 404);
  } finally {
    restoreOptionalEnv("DATABASE_URL", previousDatabaseUrl);
    await app.close();
    await rm(fixture.root, { recursive: true, force: true });
  }
});

function apiConfigFixture(overrides: Partial<ApiConfig> = {}): ApiConfig {
  return {
    devassetLibraryPath: "/tmp/videoai/library.json",
    devassetRoot: "/tmp/videoai/devassets",
    devassetStatusPath: "/tmp/videoai/.seed/status.json",
    host: "127.0.0.1",
    port: 8080,
    thumbnailRoot: "/tmp/videoai/thumbnails",
    ...overrides
  };
}

async function createReadyFileFixture(): Promise<{
  root: string;
  apiConfig: ApiConfig;
  clipConfig: ClipSearchConfig;
}> {
  const root = await mkdtemp(path.join(tmpdir(), "videoai-api-clips-"));
  const devassetRoot = path.join(root, "devassets");
  const thumbnailRoot = path.join(root, "thumbnails");
  const libraryPath = path.join(devassetRoot, "library.json");
  const statusPath = path.join(devassetRoot, ".seed", "status.json");
  const transcriptPath = path.join(
    devassetRoot,
    "assets",
    "launch-demo",
    "test",
    "transcript.json"
  );

  await mkdir(path.dirname(transcriptPath), { recursive: true });
  await mkdir(path.dirname(statusPath), { recursive: true });
  await mkdir(thumbnailRoot, { recursive: true });
  await writeFile(path.join(thumbnailRoot, "launch-demo.jpg"), "jpg-data", "utf8");
  await writeFile(
    path.join(devassetRoot, "assets", "launch-demo", "test", "source.mp4"),
    "abcdef",
    "utf8"
  );
  await writeJson(transcriptPath, usableWhisperTranscript());
  await writeJson(libraryPath, mediaLibraryFixture());
  await writeJson(statusPath, readyDevassetStatus());

  const clipConfig = {
    statusPath,
    libraryPath,
    devassetRoot,
    thumbnailRoot
  };

  return {
    root,
    clipConfig,
    apiConfig: apiConfigFixture({
      devassetLibraryPath: libraryPath,
      devassetRoot,
      devassetStatusPath: statusPath,
      thumbnailRoot
    })
  };
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function restoreOptionalEnv(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
    return;
  }

  process.env[name] = value;
}
