import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { setTimeout } from "node:timers/promises";
import test from "node:test";
import {
  ClipIndexCache,
  deriveFallbackClipDocuments,
  deriveTranscriptClipDocuments,
  normalizeTranscriptText,
  searchClipIndex,
  transcriptSegmentsFromWhisperJson,
  validateClipSearchRequest,
  validateMediaLibrary,
  type ClipSearchConfig
} from "./clips.js";
import {
  changedLibraryIdentity,
  emptyNoisyWhisperTranscript,
  mediaLibraryAssetFixture,
  mediaLibraryFixture,
  readyDevassetStatus,
  runningDevassetStatus,
  usableWhisperTranscript,
  whisperTranscriptFixture
} from "./clipFixtures.js";

test("parses transcript entries, filters noise, and derives stable clip windows", () => {
  assert.equal(normalizeTranscriptText("  [_BEG_]  "), undefined);
  assert.equal(normalizeTranscriptText(" \uFFFD "), undefined);
  assert.equal(normalizeTranscriptText("  Product   demo  "), "Product demo");

  const noisySegments = transcriptSegmentsFromWhisperJson(
    emptyNoisyWhisperTranscript(),
    32_000
  );
  assert.deepEqual(noisySegments, []);

  const asset = mediaLibraryAssetFixture();
  const segments = transcriptSegmentsFromWhisperJson(usableWhisperTranscript(), 32_000);
  const documents = deriveTranscriptClipDocuments(asset, segments);

  assert.equal(documents.length, 2);
  assert.equal(documents[0]?.id, "launch-demo:0-13400");
  assert.equal(documents[0]?.startMs, 0);
  assert.equal(documents[0]?.endMs, 13_400);
  assert.match(documents[0]?.snippet ?? "", /product demo/i);
  assert.equal(documents[0]?.thumbnailPath, asset.thumbnail.path);
  assert.equal(documents[0]?.previewPath, asset.source.path);
});

test("derives fallback fixed-duration windows without transcript snippets", () => {
  const asset = mediaLibraryAssetFixture({
    id: "silent-demo",
    title: "Silent Demo",
    media: {
      durationSeconds: 21.5
    },
    source: {
      path: "var/devassets/assets/silent-demo/test/source.mp4"
    },
    thumbnail: {
      path: "var/thumbnails/silent-demo.jpg"
    },
    transcript: {
      json: {
        path: "var/devassets/assets/silent-demo/test/transcript.json"
      }
    }
  });

  const documents = deriveFallbackClipDocuments(asset);

  assert.deepEqual(
    documents.map((document) => [document.id, document.startMs, document.endMs]),
    [
      ["silent-demo:0-10000", 0, 10_000],
      ["silent-demo:10000-20000", 10_000, 20_000],
      ["silent-demo:20000-21500", 20_000, 21_500]
    ]
  );
  assert.deepEqual(
    documents.map((document) => document.snippet),
    ["", "", ""]
  );
});

test("validates consumed media library fields and generated path roots", () => {
  const config = {
    devassetRoot: "/tmp/videoai-devassets",
    thumbnailRoot: "/tmp/videoai-thumbnails"
  };

  const library = validateMediaLibrary(mediaLibraryFixture(), config);
  assert.equal(library.assets[0]?.id, "launch-demo");

  assert.throws(
    () =>
      validateMediaLibrary(
        mediaLibraryFixture({
          assets: [
            mediaLibraryAssetFixture({
              media: {
                durationSeconds: 0
              }
            })
          ]
        }),
        config
      ),
    /durationSeconds must be greater than 0/
  );

  assert.throws(
    () =>
      validateMediaLibrary(
        mediaLibraryFixture({
          assets: [
            mediaLibraryAssetFixture({
              thumbnail: {
                path: "var/devassets/not-a-thumbnail.jpg"
              }
            })
          ]
        }),
        config
      ),
    /var\/thumbnails/
  );
});

test("ranks title and snippet matches deterministically and enforces limits", () => {
  const launchAsset = mediaLibraryAssetFixture();
  const supportAsset = mediaLibraryAssetFixture({
    id: "support-recap",
    title: "Customer Support Recap",
    source: {
      path: "var/devassets/assets/support-recap/test/source.mp4"
    },
    thumbnail: {
      path: "var/thumbnails/support-recap.jpg"
    },
    transcript: {
      json: {
        path: "var/devassets/assets/support-recap/test/transcript.json"
      }
    }
  });
  const alphaAsset = mediaLibraryAssetFixture({
    id: "alpha-recap",
    title: "Recap",
    source: {
      path: "var/devassets/assets/alpha-recap/test/source.mp4"
    },
    thumbnail: {
      path: "var/thumbnails/alpha-recap.jpg"
    },
    transcript: {
      json: {
        path: "var/devassets/assets/alpha-recap/test/transcript.json"
      }
    }
  });

  const index = {
    libraryIdentity: "sha256:test-catalog",
    documents: [
      ...deriveTranscriptClipDocuments(
        supportAsset,
        transcriptSegmentsFromWhisperJson(
          whisperTranscriptFixture([
            {
              text: "A recap of support calls mentions a demo only briefly.",
              from: 0,
              to: 12_000
            }
          ]),
          32_000
        )
      ),
      ...deriveTranscriptClipDocuments(
        launchAsset,
        transcriptSegmentsFromWhisperJson(usableWhisperTranscript(), 32_000)
      ),
      ...deriveTranscriptClipDocuments(
        alphaAsset,
        transcriptSegmentsFromWhisperJson(
          whisperTranscriptFixture([
            {
              text: "Recap.",
              from: 0,
              to: 12_000
            }
          ]),
          32_000
        )
      )
    ]
  };

  const validation = validateClipSearchRequest({
    query: "launch product demo",
    limit: 1
  });
  assert.equal(validation.ok, true);
  if (!validation.ok) {
    return;
  }

  const limited = searchClipIndex(index, validation.value);
  assert.equal(limited.results.length, 1);
  assert.equal(limited.results[0]?.assetId, "launch-demo");
  assert.equal(typeof limited.results[0]?.score, "number");

  const tieValidation = validateClipSearchRequest({
    query: "recap",
    limit: 10
  });
  assert.equal(tieValidation.ok, true);
  if (!tieValidation.ok) {
    return;
  }

  const tied = searchClipIndex(
    {
      ...index,
      documents: index.documents.filter(
        (document) =>
          document.assetId === "alpha-recap" || document.assetId === "support-recap"
      )
    },
    tieValidation.value
  );
  assert.deepEqual(
    tied.results.map((result) => result.assetId),
    ["alpha-recap", "support-recap"]
  );
});

test("reuses clip index cache and rebuilds after library identity changes", async () => {
  const fixture = await createReadyFileFixture();
  try {
    const cache = new ClipIndexCache(fixture.config);
    const first = await cache.getIndex();
    assert.equal(first.ready, true);
    if (!first.ready) {
      return;
    }

    const second = await cache.getIndex();
    assert.equal(second.ready, true);
    if (!second.ready) {
      return;
    }
    assert.strictEqual(second.index, first.index);

    await setTimeout(20);
    const changed = changedLibraryIdentity(fixture.library);
    await writeJson(fixture.libraryPath, changed);
    await writeJson(fixture.statusPath, readyDevassetStatus({ catalogIdentity: changed.catalogIdentity }));

    const third = await cache.getIndex();
    assert.equal(third.ready, true);
    if (!third.ready) {
      return;
    }
    assert.notStrictEqual(third.index, first.index);
    assert.equal(third.index.libraryIdentity, "sha256:changed-catalog");
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

test("does not read library files before devassets are ready", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "videoai-clips-not-ready-"));
  try {
    const cache = new ClipIndexCache(
      {
        statusPath: path.join(dir, ".seed", "status.json"),
        libraryPath: path.join(dir, "library.json"),
        devassetRoot: dir,
        thumbnailRoot: path.join(dir, "thumbnails")
      },
      async () => runningDevassetStatus()
    );

    const result = await cache.getIndex();
    assert.equal(result.ready, false);
    if (!result.ready) {
      assert.equal(result.devassets.state, "running");
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

async function createReadyFileFixture(): Promise<{
  root: string;
  config: ClipSearchConfig;
  libraryPath: string;
  statusPath: string;
  library: ReturnType<typeof mediaLibraryFixture>;
}> {
  const root = await mkdtemp(path.join(tmpdir(), "videoai-clips-ready-"));
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
  const library = mediaLibraryFixture();

  await mkdir(path.dirname(transcriptPath), { recursive: true });
  await mkdir(path.dirname(statusPath), { recursive: true });
  await mkdir(thumbnailRoot, { recursive: true });
  await writeJson(transcriptPath, usableWhisperTranscript());
  await writeJson(libraryPath, library);
  await writeJson(statusPath, readyDevassetStatus());

  return {
    root,
    config: {
      statusPath,
      libraryPath,
      devassetRoot,
      thumbnailRoot
    },
    libraryPath,
    statusPath,
    library
  };
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
