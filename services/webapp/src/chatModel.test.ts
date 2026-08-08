import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import {
  AssistantRuntimeProvider,
  fromThreadMessageLike,
  type ChatModelAdapter,
  type ChatModelRunOptions,
  type ChatModelRunResult,
  type ThreadMessage,
  type ThreadMessageLike,
  useExternalStoreRuntime
} from "@assistant-ui/react";
import { Thread } from "@/components/assistant-ui/thread";
import { AppView, OutputWorkspacePane } from "./App";
import {
  appendOutputResultGroup,
  appModeForDevassetStatus,
  chatResponseToAssistantContent,
  clipCandidateOutputsFromResponse,
  createOutputResultGroup,
  createClipChatAdapter,
  deselectClip,
  emptyOutputWorkspaceState,
  excludeOutputClip,
  extractLatestUserText,
  formatScore,
  formatTimeRange,
  includeOutputClip,
  isPromptSubmittable,
  outputClipFromCandidate,
  parseOutputWorkspaceState,
  parseSelectedClips,
  removeOutputClip,
  removeOutputGroup,
  restoreOutputWorkspaceState,
  selectClip,
  serializeOutputWorkspaceState,
  serializeSelectedClips,
  type ChatApiResponse,
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
  assert.doesNotMatch(setupMarkup, /Send a message/);

  const readyMarkup = renderToString(
    createElement(AppView, {
      status: statusFixture("ready", true)
    })
  );
  assert.doesNotMatch(readyMarkup, /Local clip search/);
  assert.match(readyMarkup, /assistant-surface/);
  assert.match(readyMarkup, /output-workspace/);
  assert.match(readyMarkup, /How can I help you today/);
  assert.match(readyMarkup, /Send a message/);
  assert.match(readyMarkup, /Output workspace/);
  assert.match(readyMarkup, /Included context/);
  assert.doesNotMatch(readyMarkup, /Selected clips/);
});

test("prevents empty prompt submissions before API calls", async () => {
  let called = false;
  const outputGroups: ReturnType<typeof createOutputResultGroup>[] = [];
  const adapter = createClipChatAdapter({
    onOutputGroup: (group) => outputGroups.push(group),
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
  assert.equal(outputGroups.length, 0);
  assert.match(textContent(result), /non-empty/);
});

test("maps chat responses to assistant text only and extracts output data", () => {
  const candidate = clipCandidateFixture();
  const response: ChatApiResponse = {
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
      },
      {
        type: "clip-candidates",
        query: "product demo",
        candidates: [candidate]
      }
    ]
  };
  const content = chatResponseToAssistantContent(response);
  const outputs = clipCandidateOutputsFromResponse(response);

  assert.equal(content[0]?.type, "text");
  assert.equal(content.length, 1);
  assert.equal(outputs.length, 1);
  assert.equal(outputs[0]?.query, "product demo");
  assert.equal(outputs[0]?.candidates[0]?.id, candidate.id);
});

test("renders clip candidates in output workspace, not assistant messages", () => {
  const candidate = clipCandidateFixture();
  const response = {
    role: "assistant" as const,
    content: [
      {
        type: "text" as const,
        text: "I found 1 local clip."
      },
      {
        type: "clip-candidates" as const,
        query: "product demo",
        candidates: [candidate]
      }
    ]
  };
  const assistantMarkup = renderToString(
    createElement(RenderAssistantThread, {
      messages: [
        {
          role: "assistant",
          content: chatResponseToAssistantContent(response),
          status: {
            type: "complete",
            reason: "stop"
          }
        }
      ]
    })
  );
  const group = createOutputResultGroup(
    {
      query: "product demo",
      candidates: [candidate]
    },
    { sequence: 3, createdAt: "2026-08-08T08:00:00.000Z" }
  );
  const workspaceMarkup = renderToString(
    createElement(OutputWorkspacePane, {
      includedIds: new Set([candidate.id]),
      onExclude() {},
      onInclude() {},
      onRemoveClip() {},
      onRemoveGroup() {},
      workspace: {
        ...emptyOutputWorkspaceState(),
        groups: [group],
        includedClips: [outputClipFromCandidate(candidate)]
      }
    })
  );

  assert.match(assistantMarkup, /I found 1 local clip/);
  assert.doesNotMatch(assistantMarkup, /Launch Product Demo/);
  assert.match(workspaceMarkup, /product demo/);
  assert.match(workspaceMarkup, /Launch Product Demo/);
  assert.match(workspaceMarkup, /34\.2/);
  assert.match(workspaceMarkup, /Exclude/);
  assert.match(workspaceMarkup, /Included context/);
  assert.doesNotMatch(workspaceMarkup, /<video/);
  assert.doesNotMatch(workspaceMarkup, /source\.mp4#t=/);
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

test("creates output groups and manages included output clips", () => {
  const candidate = clipCandidateFixture();
  const duplicate = clipCandidateFixture({
    snippet: "Duplicate should be ignored."
  });
  const group = createOutputResultGroup(
    {
      query: "product demo",
      candidates: [candidate, duplicate]
    },
    { sequence: 2, createdAt: "2026-08-08T08:00:00.000Z" }
  );

  assert.match(group.id, /^clip-results:2:/);
  assert.equal(group.clips.length, 1);

  let workspace = appendOutputResultGroup(emptyOutputWorkspaceState(), group);
  workspace = includeOutputClip(workspace, group.clips[0]!);
  workspace = includeOutputClip(workspace, group.clips[0]!);
  assert.equal(workspace.includedClips.length, 1);

  workspace = excludeOutputClip(workspace, candidate.id);
  assert.equal(workspace.includedClips.length, 0);

  workspace = includeOutputClip(workspace, group.clips[0]!);
  workspace = removeOutputClip(workspace, group.id, candidate.id);
  assert.equal(workspace.groups.length, 0);
  assert.equal(workspace.includedClips.length, 0);
});

test("keeps included context coherent when removing output groups", () => {
  const candidate = clipCandidateFixture();
  const firstGroup = createOutputResultGroup(
    {
      query: "first",
      candidates: [candidate]
    },
    { sequence: 1, createdAt: "2026-08-08T08:00:00.000Z" }
  );
  const secondGroup = createOutputResultGroup(
    {
      query: "second",
      candidates: [candidate]
    },
    { sequence: 2, createdAt: "2026-08-08T08:01:00.000Z" }
  );

  let workspace = {
    ...emptyOutputWorkspaceState(),
    groups: [firstGroup, secondGroup],
    includedClips: [firstGroup.clips[0]!]
  };
  workspace = removeOutputGroup(workspace, firstGroup.id);
  assert.equal(workspace.groups.length, 1);
  assert.equal(workspace.includedClips.length, 1);

  workspace = removeOutputGroup(workspace, secondGroup.id);
  assert.equal(workspace.groups.length, 0);
  assert.equal(workspace.includedClips.length, 0);
});

test("serializes output workspace state and migrates v1 selected clips", () => {
  const candidate = clipCandidateFixture();
  const group = createOutputResultGroup(
    {
      query: "product demo",
      candidates: [candidate]
    },
    { sequence: 1, createdAt: "2026-08-08T08:00:00.000Z" }
  );
  const workspace = {
    ...emptyOutputWorkspaceState(),
    groups: [group],
    includedClips: [group.clips[0]!]
  };
  const parsed = parseOutputWorkspaceState(
    serializeOutputWorkspaceState(workspace)
  );
  assert.equal(parsed?.groups[0]?.query, "product demo");
  assert.equal(parsed?.includedClips.length, 1);

  const legacySelected = serializeSelectedClips([selectClip([], candidate)[0]!]);
  const migrated = restoreOutputWorkspaceState(null, legacySelected);
  assert.equal(migrated.groups.length, 0);
  assert.equal(migrated.includedClips.length, 1);
  assert.equal(migrated.includedClips[0]?.id, candidate.id);
  assert.equal(migrated.includedClips[0]?.snippet, "");

  const restored = restoreOutputWorkspaceState(
    serializeOutputWorkspaceState(workspace),
    legacySelected
  );
  assert.equal(restored.groups.length, 1);
  assert.equal(restored.includedClips.length, 1);
});

test("formats clip timing and scores for clip cards", () => {
  const candidate = clipCandidateFixture();

  assert.equal(formatTimeRange(candidate.startMs, candidate.endMs), "0:00 - 0:13");
  assert.equal(formatScore(candidate.score), "34.2");
});

test("local runtime adapter posts user text and routes output groups", async () => {
  let requestBody: unknown;
  const notices: Array<ChatNotice | null> = [];
  const outputGroups: ReturnType<typeof createOutputResultGroup>[] = [];
  const adapter = createClipChatAdapter({
    limit: 4,
    onNotice: (notice) => notices.push(notice),
    onOutputGroup: (group) => outputGroups.push(group),
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
  assert.equal(result.content?.length, 1);
  assert.equal(outputGroups.length, 1);
  assert.equal(outputGroups[0]?.query, "product demo");
  assert.equal(outputGroups[0]?.clips[0]?.id, "launch-demo:0-13400");
});

test("local runtime adapter keeps no-result responses text-only", async () => {
  const outputGroups: ReturnType<typeof createOutputResultGroup>[] = [];
  const adapter = createClipChatAdapter({
    onOutputGroup: (group) => outputGroups.push(group),
    fetchImpl: async () =>
      jsonResponse(200, {
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
      })
  });

  const result = await runAdapter(adapter, [
    {
      role: "user",
      content: [{ type: "text", text: "does not match" }]
    }
  ]);

  assert.match(textContent(result), /No clips found/);
  assert.equal(result.content?.length, 1);
  assert.equal(outputGroups.length, 0);
});

test("local runtime adapter surfaces devasset-not-ready without stale candidates", async () => {
  const notices: Array<ChatNotice | null> = [];
  const outputGroups: ReturnType<typeof createOutputResultGroup>[] = [];
  const devassets = statusFixture("running", false);
  const adapter = createClipChatAdapter({
    onNotice: (notice) => notices.push(notice),
    onOutputGroup: (group) => outputGroups.push(group),
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
  assert.equal(result.content?.length, 1);
  assert.equal(outputGroups.length, 0);
  assertRecoverableResultRenders(result, /running/);
});

test("local runtime adapter returns recoverable error content on API failure", async () => {
  const notices: Array<ChatNotice | null> = [];
  const outputGroups: ReturnType<typeof createOutputResultGroup>[] = [];
  const adapter = createClipChatAdapter({
    onNotice: (notice) => notices.push(notice),
    onOutputGroup: (group) => outputGroups.push(group),
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
  assert.equal(result.content?.length, 1);
  assert.equal(outputGroups.length, 0);
  assertRecoverableResultRenders(result, /clip index failed/);
});

test("stylesheet defines responsive chat and output pane layout", () => {
  const css = readFileSync(new URL("./styles.css", import.meta.url), "utf8");

  assert.match(
    css,
    /grid-template-columns: minmax\(0, 1fr\) minmax\(320px, 420px\)/
  );
  assert.match(css, /@media \(max-width: 980px\)/);
  assert.match(css, /\.output-workspace/);
  assert.doesNotMatch(css, /\.selected-panel/);
  assert.doesNotMatch(css, /\.clip-preview-button/);
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

function RenderAssistantThread({ messages }: { messages: ThreadMessageLike[] }) {
  const threadMessages = messages.map((message, index) =>
    fromThreadMessageLike(message, `message-${index}`, {
      type: "complete",
      reason: "stop"
    })
  );
  const runtime = useExternalStoreRuntime<ThreadMessage>({
    messages: threadMessages,
    async onNew() {}
  });

  return createElement(
    AssistantRuntimeProvider,
    { runtime },
    createElement(Thread)
  );
}

function RenderRecoverableResult({
  result
}: {
  result: ChatModelRunResult;
}) {
  return createElement(RenderAssistantThread, {
    messages: [
      {
        role: "assistant",
        content: result.content ?? [],
        status: result.status ?? {
          type: "complete",
          reason: "stop"
        }
      }
    ]
  });
}

function assertRecoverableResultRenders(
  result: ChatModelRunResult,
  expected: RegExp
) {
  const markup = renderToString(
    createElement(RenderRecoverableResult, {
      result
    })
  );

  assert.match(markup, expected);
  assert.doesNotMatch(markup, /No clips returned for this request/);
  assert.doesNotMatch(markup, /output-clip-card/);
  assert.doesNotMatch(markup, /chat-notice/);
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
