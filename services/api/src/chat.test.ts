import assert from "node:assert/strict";
import test from "node:test";
import { createApiApp } from "./app.js";
import type { ClipSearchService } from "./clips.js";
import type { ApiConfig } from "./config.js";
import {
  errorDevassetStatus,
  missingDevassetStatus,
  runningDevassetStatus
} from "./clipFixtures.js";

test("POST /chat validates request text and result limits before searching", async () => {
  let searched = false;
  const app = createApiApp({
    config: apiConfigFixture(),
    clipSearch: {
      async search() {
        searched = true;
        throw new Error("search should not run for invalid chat requests");
      }
    },
    logger: false
  });

  try {
    const empty = await app.inject({
      method: "POST",
      url: "/chat",
      payload: {
        message: "   "
      }
    });
    assert.equal(empty.statusCode, 400);
    assert.equal(empty.json().error, "validation_error");

    const invalidLimit = await app.inject({
      method: "POST",
      url: "/chat",
      payload: {
        message: "find launch moments",
        limit: 21
      }
    });
    assert.equal(invalidLimit.statusCode, 400);
    assert.equal(invalidLimit.json().error, "validation_error");
    assert.equal(searched, false);
  } finally {
    await app.close();
  }
});

test("POST /chat returns search-backed assistant text and clip candidates", async () => {
  const app = createApiApp({
    config: apiConfigFixture(),
    clipSearch: clipSearchFixture({
      expectedQuery: "launch product demo",
      expectedLimit: 2
    }),
    logger: false
  });

  try {
    const response = await app.inject({
      method: "POST",
      url: "/chat",
      payload: {
        message: " Launch product demo ",
        limit: 2
      }
    });

    assert.equal(response.statusCode, 200);
    const body = response.json();
    assert.equal(body.role, "assistant");
    assert.equal(body.content[0].type, "text");
    assert.match(body.content[0].text, /1 local clip/);
    assert.equal(body.content[1].type, "clip-candidates");
    assert.equal(body.content[1].query, "launch product demo");
    assert.equal(body.content[1].candidates.length, 1);

    const candidate = body.content[1].candidates[0];
    assert.equal(candidate.id, "launch-demo:0-13400");
    assert.equal(candidate.assetId, "launch-demo");
    assert.equal(candidate.thumbnailPath, "var/thumbnails/launch-demo.jpg");
    assert.equal(
      candidate.previewPath,
      "var/devassets/assets/launch-demo/test/source.mp4"
    );
    assert.equal(candidate.thumbnailUrl, "/api/media/thumbnails/launch-demo.jpg");
    assert.equal(
      candidate.previewUrl,
      "/api/media/devassets/assets/launch-demo/test/source.mp4"
    );
  } finally {
    await app.close();
  }
});

test("POST /chat does not require PostgreSQL or model-provider credentials", async () => {
  const previousDatabaseUrl = process.env.DATABASE_URL;
  const previousOpenAiKey = process.env.OPENAI_API_KEY;
  const previousGeminiKey = process.env.GEMINI_API_KEY;
  delete process.env.DATABASE_URL;
  delete process.env.OPENAI_API_KEY;
  delete process.env.GEMINI_API_KEY;

  const app = createApiApp({
    config: apiConfigFixture(),
    clipSearch: clipSearchFixture({
      expectedQuery: "product demo",
      expectedLimit: 8
    }),
    logger: false
  });

  try {
    const response = await app.inject({
      method: "POST",
      url: "/chat",
      payload: {
        message: "product demo"
      }
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.json().content[1].candidates.length, 1);
  } finally {
    restoreOptionalEnv("DATABASE_URL", previousDatabaseUrl);
    restoreOptionalEnv("OPENAI_API_KEY", previousOpenAiKey);
    restoreOptionalEnv("GEMINI_API_KEY", previousGeminiKey);
    await app.close();
  }
});

test("POST /chat preserves devassets-not-ready states from clip search", async () => {
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
        url: "/chat",
        payload: {
          message: "launch"
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

function clipSearchFixture(options: {
  expectedQuery: string;
  expectedLimit: number;
}): ClipSearchService {
  return {
    async search(request) {
      assert.equal(request.query, options.expectedQuery);
      assert.equal(request.limit, options.expectedLimit);

      return {
        ready: true,
        response: {
          query: request.query,
          results: [
            {
              id: "launch-demo:0-13400",
              assetId: "launch-demo",
              title: "Launch Product Demo",
              startMs: 0,
              endMs: 13_400,
              snippet: "The launch recap opens with a product demo.",
              thumbnailPath: "var/thumbnails/launch-demo.jpg",
              previewPath: "var/devassets/assets/launch-demo/test/source.mp4",
              score: 34
            }
          ]
        }
      };
    }
  };
}

function restoreOptionalEnv(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
    return;
  }

  process.env[name] = value;
}

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
