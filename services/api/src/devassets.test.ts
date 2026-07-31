import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { readDevassetStatus } from "./devassets.js";

test("reports missing devassets when status is absent", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "videoai-devassets-"));
  try {
    const result = await readDevassetStatus({
      statusPath: path.join(dir, ".seed", "status.json"),
      libraryPath: path.join(dir, "library.json")
    });

    assert.equal(result.state, "missing");
    assert.equal(result.ready, false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("reports ready devassets when status and library are ready", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "videoai-devassets-"));
  try {
    await mkdir(path.join(dir, ".seed"), { recursive: true });
    await writeJson(path.join(dir, ".seed", "status.json"), {
      version: 1,
      state: "ready",
      message: "ready",
      updatedAt: "2026-07-31T00:00:00.000Z",
      catalogIdentity: "sha256:test",
      libraryPath: "var/devassets/library.json"
    });
    await writeJson(path.join(dir, "library.json"), {
      version: 1,
      catalogIdentity: "sha256:test",
      assets: [{ id: "sintel-trailer" }]
    });

    const result = await readDevassetStatus({
      statusPath: path.join(dir, ".seed", "status.json"),
      libraryPath: path.join(dir, "library.json")
    });

    assert.equal(result.state, "ready");
    assert.equal(result.ready, true);
    assert.equal(result.assetCount, 1);
    assert.equal(result.catalogIdentity, "sha256:test");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("reports seed errors with their setup message", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "videoai-devassets-"));
  try {
    await mkdir(path.join(dir, ".seed"), { recursive: true });
    await writeJson(path.join(dir, ".seed", "status.json"), {
      version: 1,
      state: "error",
      message: "failed",
      updatedAt: "2026-07-31T00:00:00.000Z",
      error: {
        message: "catalog.version must be 1"
      }
    });

    const result = await readDevassetStatus({
      statusPath: path.join(dir, ".seed", "status.json"),
      libraryPath: path.join(dir, "library.json")
    });

    assert.equal(result.state, "error");
    assert.equal(result.ready, false);
    assert.equal(result.message, "catalog.version must be 1");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
