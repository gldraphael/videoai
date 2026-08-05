import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { createApiApp } from "./app.js";
import type { ApiConfig } from "./config.js";
import type { Database } from "./db.js";
import { generatedMediaReferenceToUrl } from "./media.js";

test("maps generated media references to browser media URLs", () => {
  assert.equal(
    generatedMediaReferenceToUrl("var/thumbnails/launch demo.jpg"),
    "/api/media/thumbnails/launch%20demo.jpg"
  );
  assert.equal(
    generatedMediaReferenceToUrl(
      "var/devassets/assets/launch-demo/test/source.mp4"
    ),
    "/api/media/devassets/assets/launch-demo/test/source.mp4"
  );
  assert.equal(generatedMediaReferenceToUrl("/tmp/source.mp4"), null);
  assert.equal(generatedMediaReferenceToUrl("var/devassets/../secret.mp4"), null);
  assert.equal(generatedMediaReferenceToUrl("var/renders/result.mp4"), null);
});

test("serves constrained thumbnails and preview video ranges", async () => {
  const fixture = await createMediaFixture();
  const app = createApiApp({
    config: fixture.apiConfig,
    database: databaseThatMustNotBeUsed(),
    logger: false
  });

  try {
    const thumbnail = await app.inject({
      method: "GET",
      url: "/media/thumbnails/launch-demo.jpg"
    });
    assert.equal(thumbnail.statusCode, 200);
    assert.match(thumbnail.headers["content-type"] as string, /image\/jpeg/);
    assert.equal(thumbnail.body, "jpg-data");

    const preview = await app.inject({
      method: "GET",
      url: "/media/devassets/assets/launch-demo/test/source.mp4",
      headers: {
        range: "bytes=1-3"
      }
    });
    assert.equal(preview.statusCode, 206);
    assert.match(preview.headers["content-type"] as string, /video\/mp4/);
    assert.equal(preview.headers["accept-ranges"], "bytes");
    assert.equal(preview.headers["content-range"], "bytes 1-3/6");
    assert.equal(preview.body, "bcd");
  } finally {
    await app.close();
    await rm(fixture.root, { recursive: true, force: true });
  }
});

test("rejects unsafe media paths and unsupported generated artifacts", async () => {
  const fixture = await createMediaFixture();
  const app = createApiApp({
    config: fixture.apiConfig,
    database: databaseThatMustNotBeUsed(),
    logger: false
  });

  try {
    for (const url of [
      "/media/thumbnails/%2e%2e/secret.jpg",
      "/media/devassets/assets/launch-demo/test/transcript.json",
      "/media/devassets/assets/launch-demo/test/transcript.srt",
      "/media/devassets/assets/launch-demo/test/audio.wav",
      "/media/devassets/assets/launch-demo/test/preview.mp4",
      "/media/devassets/library.json",
      "/media/devassets/.seed/status.json"
    ]) {
      const response = await app.inject({
        method: "GET",
        url
      });
      assert.equal(response.statusCode, 400, url);
      assert.equal(response.json().error, "invalid_media_path");
    }
  } finally {
    await app.close();
    await rm(fixture.root, { recursive: true, force: true });
  }
});

test("missing media returns not found while health checks remain available", async () => {
  const fixture = await createMediaFixture();
  const app = createApiApp({
    config: fixture.apiConfig,
    database: databaseThatMustNotBeUsed(),
    logger: false
  });

  try {
    const missing = await app.inject({
      method: "GET",
      url: "/media/thumbnails/missing.jpg"
    });
    assert.equal(missing.statusCode, 404);
    assert.equal(missing.json().error, "not_found");

    const health = await app.inject({
      method: "GET",
      url: "/health"
    });
    assert.equal(health.statusCode, 200);
    assert.equal(health.json().status, "ok");
  } finally {
    await app.close();
    await rm(fixture.root, { recursive: true, force: true });
  }
});

async function createMediaFixture(): Promise<{
  root: string;
  apiConfig: ApiConfig;
}> {
  const root = await mkdtemp(path.join(tmpdir(), "videoai-media-"));
  const devassetRoot = path.join(root, "devassets");
  const thumbnailRoot = path.join(root, "thumbnails");

  await writeText(path.join(thumbnailRoot, "launch-demo.jpg"), "jpg-data");
  await writeText(
    path.join(devassetRoot, "assets", "launch-demo", "test", "source.mp4"),
    "abcdef"
  );
  await writeText(
    path.join(devassetRoot, "assets", "launch-demo", "test", "transcript.json"),
    "{}"
  );
  await writeText(
    path.join(devassetRoot, "assets", "launch-demo", "test", "transcript.srt"),
    "1\n00:00:00,000 --> 00:00:01,000\nLaunch\n"
  );
  await writeText(
    path.join(devassetRoot, "assets", "launch-demo", "test", "audio.wav"),
    "audio"
  );
  await writeText(
    path.join(devassetRoot, "assets", "launch-demo", "test", "preview.mp4"),
    "preview"
  );
  await writeText(path.join(devassetRoot, "library.json"), "{}");
  await writeText(path.join(devassetRoot, ".seed", "status.json"), "{}");

  return {
    root,
    apiConfig: apiConfigFixture({
      devassetRoot,
      thumbnailRoot
    })
  };
}

async function writeText(filePath: string, value: string): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, value, "utf8");
}

function databaseThatMustNotBeUsed(): Database {
  return {
    async check() {
      throw new Error("database check should not run during media requests");
    },
    async close() {}
  };
}

function apiConfigFixture(overrides: Partial<ApiConfig> = {}): ApiConfig {
  return {
    databaseUrl: "postgres://example.invalid/videoai",
    devassetLibraryPath: "/tmp/videoai/library.json",
    devassetRoot: "/tmp/videoai/devassets",
    devassetStatusPath: "/tmp/videoai/.seed/status.json",
    host: "127.0.0.1",
    port: 8080,
    thumbnailRoot: "/tmp/videoai/thumbnails",
    ...overrides
  };
}
