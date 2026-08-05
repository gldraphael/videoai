import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import type {
  ChatModelAdapter,
  ChatModelRunOptions,
  ChatModelRunResult
} from "@assistant-ui/react";
import { AppView } from "./App";
import {
  appModeForDevassetStatus,
  chatResponseToAssistantContent,
  clipPreviewUrl,
  createClipChatAdapter,
  deselectClip,
  extractLatestUserText,
  formatScore,
  formatTimeRange,
  isPromptSubmittable,
  parseSelectedClips,
  selectClip,
  serializeSelectedClips,
  type ChatNotice,
  type ClipCandidate,
  type DevassetStatus
} from "./chatModel";

test("gates setup, error, and ready chat modes from devasset status", () => {
  assert.equal(appModeForDevassetStatus(statusFixture("missing", false)), "setup");
  assert.equal(appModeForDevassetStatus(statusFixture("running", false)), "setup");
  assert.equal(appModeForDevassetStatus(statusFixture("error", false)), "error");
  assert.equal(appModeForDevassetStatus(statusFixture("ready", true)), "chat");
});

test("renders setup states until ready and assistant chat once ready", () => {
  const setupMarkup = renderToString(
    createElement(AppView, {
      status: statusFixture("running", false)
    })
  );
  assert.match(setupMarkup, /Setting things up/);
  assert.doesNotMatch(setupMarkup, /Local clip search/);

  const readyMarkup = renderToString(
    createElement(AppView, {
      status: statusFixture("ready", true)
    })
  );
  assert.match(readyMarkup, /Local clip search/);
  assert.match(readyMarkup, /Search for launch moments/);
  assert.match(readyMarkup, /Selected clips/);
});

test("prevents empty prompt submissions before API calls", async () => {
  let called = false;
  const adapter = createClipChatAdapter({
    fetchImpl: async () => {
      called = true;
      throw new Error("fetch should not run");
    }
  });

  assert.equal(isPromptSubmittable("   "), false);
  assert.equal(isPromptSubmittable(" launch "), true);

  const result = await runAdapter(adapter, [
    {
      role: "user",
      content: [{ type: "text", text: "   " }]
    }
  ]);
  assert.equal(called, false);
  assert.match(textContent(result), /non-empty/);
});

test("maps chat responses to assistant text and structured clip-candidates data", () => {
  const content = chatResponseToAssistantContent({
    role: "assistant",
    content: [
      {
        type: "text",
        text: "No clips found."
      },
      {
        type: "clip-candidates",
        query: "does-not-match",
        candidates: []
      }
    ]
  });

  assert.equal(content[0]?.type, "text");
  assert.equal(content[1]?.type, "data");
  assert.equal(content[1]?.name, "clip-candidates");
  assert.deepEqual(content[1]?.data, {
    query: "does-not-match",
    candidates: []
  });
});

test("extracts latest user text from assistant-ui message history", () => {
  const latest = extractLatestUserText([
    {
      role: "user",
      content: [{ type: "text", text: "first request" }]
    },
    {
      role: "assistant",
      content: [{ type: "text", text: "first response" }]
    },
    {
      role: "user",
      content: [
        { type: "text", text: "second" },
        { type: "text", text: "request" }
      ]
    }
  ] as never);

  assert.equal(latest, "second request");
});

test("selects, deselects, and deduplicates clips by deterministic id", () => {
  const candidate = clipCandidateFixture({
    snippet: ""
  });
  const selected = selectClip([], candidate);
  const duplicate = selectClip(selected, candidate);

  assert.equal(selected.length, 1);
  assert.equal(selected[0]?.id, "launch-demo:0-13400");
  assert.equal(selected[0]?.assetId, "launch-demo");
  assert.equal(selected[0]?.thumbnailUrl, "/api/media/thumbnails/launch-demo.jpg");
  assert.equal(duplicate.length, 1);
  assert.deepEqual(deselectClip(duplicate, candidate.id), []);

  const parsed = parseSelectedClips(serializeSelectedClips(selected));
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0]?.title, "Launch Product Demo");
});

test("formats clip timing, scores, and preview URLs for clip cards", () => {
  const candidate = clipCandidateFixture();

  assert.equal(formatTimeRange(candidate.startMs, candidate.endMs), "0:00 - 0:13");
  assert.equal(formatScore(candidate.score), "34.2");
  assert.equal(
    clipPreviewUrl(candidate),
    "/api/media/devassets/assets/launch-demo/test/source.mp4#t=0,13.4"
  );
});

test("local runtime adapter posts user text and returns clip-candidate parts", async () => {
  let requestBody: unknown;
  const notices: Array<ChatNotice | null> = [];
  const adapter = createClipChatAdapter({
    limit: 4,
    onNotice: (notice) => notices.push(notice),
    fetchImpl: async (_input, init) => {
      requestBody = JSON.parse(String(init?.body));
      return jsonResponse(200, {
        role: "assistant",
        content: [
          {
            type: "text",
            text: "I found 1 local clip."
          },
          {
            type: "clip-candidates",
            query: "product demo",
            candidates: [clipCandidateFixture()]
          }
        ]
      });
    }
  });

  const result = await runAdapter(adapter, [
    {
      role: "user",
      content: [{ type: "text", text: " product demo " }]
    }
  ]);

  assert.deepEqual(requestBody, {
    message: "product demo",
    limit: 4
  });
  assert.equal(notices.at(-1), null);
  assert.match(textContent(result), /found 1/);
  assert.equal(result.content?.[1]?.type, "data");
});

test("local runtime adapter surfaces devasset-not-ready without stale candidates", async () => {
  const notices: Array<ChatNotice | null> = [];
  const devassets = statusFixture("running", false);
  const adapter = createClipChatAdapter({
    onNotice: (notice) => notices.push(notice),
    fetchImpl: async () =>
      jsonResponse(
        503,
        {
          error: "devassets_not_ready",
          message: devassets.message,
          devassets
        }
      )
  });

  const result = await runAdapter(adapter, [
    {
      role: "user",
      content: [{ type: "text", text: "launch" }]
    }
  ]);

  assert.equal(notices.at(-1)?.type, "devassets");
  assert.match(textContent(result), /running/);
  assert.deepEqual(result.content?.[1], {
    type: "data",
    name: "clip-candidates",
    data: {
      query: "launch",
      candidates: []
    }
  });
});

test("local runtime adapter returns recoverable error content on API failure", async () => {
  const notices: Array<ChatNotice | null> = [];
  const adapter = createClipChatAdapter({
    onNotice: (notice) => notices.push(notice),
    fetchImpl: async () =>
      jsonResponse(500, {
        error: "unexpected",
        message: "clip index failed"
      })
  });

  const result = await runAdapter(adapter, [
    {
      role: "user",
      content: [{ type: "text", text: "launch" }]
    }
  ]);

  assert.equal(notices.at(-1)?.type, "error");
  assert.match(textContent(result), /clip index failed/);
  assert.deepEqual(result.content?.[1], {
    type: "data",
    name: "clip-candidates",
    data: {
      query: "launch",
      candidates: []
    }
  });
});

async function runAdapter(
  adapter: ChatModelAdapter,
  messages: unknown[]
): Promise<ChatModelRunResult> {
  const abortController = new AbortController();
  return adapter.run({
    messages: messages as never,
    abortSignal: abortController.signal,
    context: {} as never,
    runConfig: {},
    unstable_getMessage() {
      return messages.at(-1) as never;
    }
  } as ChatModelRunOptions) as Promise<ChatModelRunResult>;
}

function textContent(result: ChatModelRunResult): string {
  return (
    result.content
      ?.map((part) => (part.type === "text" ? part.text : ""))
      .join(" ") ?? ""
  );
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json"
    }
  });
}

function statusFixture(
  state: DevassetStatus["state"],
  ready: boolean
): DevassetStatus {
  return {
    state,
    ready,
    message: "Local devassets are being prepared.",
    assetCount: ready ? 1 : undefined
  };
}

function clipCandidateFixture(
  overrides: Partial<ClipCandidate> = {}
): ClipCandidate {
  return {
    id: "launch-demo:0-13400",
    assetId: "launch-demo",
    title: "Launch Product Demo",
    startMs: 0,
    endMs: 13_400,
    snippet: "The launch recap opens with a product demo.",
    thumbnailPath: "var/thumbnails/launch-demo.jpg",
    previewPath: "var/devassets/assets/launch-demo/test/source.mp4",
    thumbnailUrl: "/api/media/thumbnails/launch-demo.jpg",
    previewUrl: "/api/media/devassets/assets/launch-demo/test/source.mp4",
    score: 34.234,
    ...overrides
  };
}
