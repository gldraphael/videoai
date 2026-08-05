import type {
  ChatModelAdapter,
  ChatModelRunResult,
  ThreadAssistantMessagePart,
  ThreadMessage
} from "@assistant-ui/react";

export const DEFAULT_CHAT_LIMIT = 8;
export const selectedClipsStorageKey = "videoai:selected-clips:v1";

export type DevassetStatus = {
  state: "missing" | "running" | "ready" | "error";
  ready: boolean;
  message: string;
  assetCount?: number;
  catalogIdentity?: string;
  updatedAt?: string;
};

export type ChatApiResponse = {
  role: "assistant";
  content: ChatApiPart[];
};

export type ChatApiPart =
  | {
      type: "text";
      text: string;
    }
  | {
      type: "clip-candidates";
      query: string;
      candidates: ClipCandidate[];
    };

export type ClipCandidate = {
  id: string;
  assetId: string;
  title: string;
  startMs: number;
  endMs: number;
  snippet: string;
  thumbnailPath: string;
  previewPath: string;
  thumbnailUrl: string | null;
  previewUrl: string | null;
  score: number;
};

export type ClipCandidatesData = {
  query: string;
  candidates: ClipCandidate[];
};

export type SelectedClip = Pick<
  ClipCandidate,
  | "id"
  | "assetId"
  | "title"
  | "startMs"
  | "endMs"
  | "thumbnailPath"
  | "previewPath"
  | "thumbnailUrl"
  | "previewUrl"
> & {
  score: number;
};

export type ChatNotice =
  | {
      type: "devassets";
      devassets: DevassetStatus;
      message: string;
    }
  | {
      type: "error";
      message: string;
    };

export type AppMode = "setup" | "error" | "chat";

type ChatFetch = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>;

type CreateClipChatAdapterOptions = {
  fetchImpl?: ChatFetch;
  limit?: number;
  onNotice?: (notice: ChatNotice | null) => void;
};

type ChatErrorBody = {
  error?: unknown;
  message?: unknown;
  devassets?: unknown;
};

class DevassetsNotReadyError extends Error {
  constructor(
    message: string,
    readonly devassets: DevassetStatus
  ) {
    super(message);
  }
}

export function appModeForDevassetStatus(status: DevassetStatus): AppMode {
  if (status.state === "error") {
    return "error";
  }

  return status.ready ? "chat" : "setup";
}

export function isPromptSubmittable(value: string): boolean {
  return value.trim().length > 0;
}

export function createClipChatAdapter({
  fetchImpl = fetch,
  limit = DEFAULT_CHAT_LIMIT,
  onNotice
}: CreateClipChatAdapterOptions = {}): ChatModelAdapter {
  return {
    async run(options): Promise<ChatModelRunResult> {
      const message = extractLatestUserText(options.messages);
      if (!isPromptSubmittable(message)) {
        return completeAssistantMessage([
          {
            type: "text",
            text: "Enter a non-empty local clip search request."
          }
        ]);
      }

      try {
        const response = await requestClipChat(
          fetchImpl,
          message.trim(),
          limit,
          options.abortSignal
        );
        onNotice?.(null);
        return completeAssistantMessage(chatResponseToAssistantContent(response));
      } catch (error) {
        if (error instanceof DevassetsNotReadyError) {
          onNotice?.({
            type: "devassets",
            devassets: error.devassets,
            message: error.message
          });
          return completeAssistantMessage([
            {
              type: "text",
              text: `${error.devassets.state}: ${error.message}`
            },
            emptyClipCandidatesData(message.trim())
          ]);
        }

        const messageText =
          error instanceof Error
            ? error.message
            : "The local API returned an unexpected error.";
        onNotice?.({
          type: "error",
          message: messageText
        });
        return completeAssistantMessage([
          {
            type: "text",
            text: `I could not search local clips: ${messageText}`
          },
          emptyClipCandidatesData(message.trim())
        ]);
      }
    }
  };
}

export async function requestClipChat(
  fetchImpl: ChatFetch,
  message: string,
  limit: number,
  signal?: AbortSignal
): Promise<ChatApiResponse> {
  const response = await fetchImpl("/api/chat", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      message,
      limit
    }),
    signal
  });

  const body = (await readJsonResponse(response)) as
    | ChatApiResponse
    | ChatErrorBody;
  if (response.ok) {
    return body as ChatApiResponse;
  }

  const errorBody = isObject(body) ? (body as ChatErrorBody) : {};
  if (
    response.status === 503 &&
    errorBody.error === "devassets_not_ready" &&
    isDevassetStatus(errorBody.devassets)
  ) {
    throw new DevassetsNotReadyError(
      typeof errorBody.message === "string"
        ? errorBody.message
        : errorBody.devassets.message,
      errorBody.devassets
    );
  }

  throw new Error(
    typeof errorBody.message === "string"
      ? errorBody.message
      : `API returned HTTP ${response.status}`
  );
}

export function chatResponseToAssistantContent(
  response: ChatApiResponse
): ThreadAssistantMessagePart[] {
  return response.content.map((part) => {
    if (part.type === "text") {
      return {
        type: "text",
        text: part.text
      };
    }

    return {
      type: "data",
      name: "clip-candidates",
      data: {
        query: part.query,
        candidates: part.candidates
      }
    };
  });
}

export function extractLatestUserText(
  messages: readonly Pick<ThreadMessage, "role" | "content">[]
): string {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (!message || message.role !== "user") {
      continue;
    }

    return extractTextFromContent(message.content);
  }

  return "";
}

export function selectedClipFromCandidate(candidate: ClipCandidate): SelectedClip {
  return {
    id: candidate.id,
    assetId: candidate.assetId,
    title: candidate.title,
    startMs: candidate.startMs,
    endMs: candidate.endMs,
    thumbnailPath: candidate.thumbnailPath,
    previewPath: candidate.previewPath,
    thumbnailUrl: candidate.thumbnailUrl,
    previewUrl: candidate.previewUrl,
    score: candidate.score
  };
}

export function selectClip(
  selectedClips: readonly SelectedClip[],
  candidate: ClipCandidate
): SelectedClip[] {
  if (selectedClips.some((clip) => clip.id === candidate.id)) {
    return [...selectedClips];
  }

  return [...selectedClips, selectedClipFromCandidate(candidate)];
}

export function deselectClip(
  selectedClips: readonly SelectedClip[],
  clipId: string
): SelectedClip[] {
  return selectedClips.filter((clip) => clip.id !== clipId);
}

export function parseSelectedClips(value: string | null): SelectedClip[] {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(isSelectedClip);
  } catch {
    return [];
  }
}

export function serializeSelectedClips(
  selectedClips: readonly SelectedClip[]
): string {
  return JSON.stringify(selectedClips);
}

export function formatTime(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${pad2(minutes)}:${pad2(seconds)}`;
  }

  return `${minutes}:${pad2(seconds)}`;
}

export function formatTimeRange(startMs: number, endMs: number): string {
  return `${formatTime(startMs)} - ${formatTime(endMs)}`;
}

export function formatScore(score: number): string {
  return Number.isFinite(score) ? score.toFixed(1) : "0.0";
}

export function clipPreviewUrl(
  candidate: Pick<ClipCandidate, "previewUrl" | "startMs" | "endMs">
): string | null {
  if (!candidate.previewUrl) {
    return null;
  }

  return `${candidate.previewUrl}#t=${formatSeconds(candidate.startMs)},${formatSeconds(candidate.endMs)}`;
}

function completeAssistantMessage(
  content: ThreadAssistantMessagePart[]
): ChatModelRunResult {
  return {
    content,
    status: {
      type: "complete",
      reason: "stop"
    }
  };
}

function emptyClipCandidatesData(query: string): ThreadAssistantMessagePart {
  return {
    type: "data",
    name: "clip-candidates",
    data: {
      query,
      candidates: []
    }
  };
}

function extractTextFromContent(content: ThreadMessage["content"]): string {
  if (typeof content === "string") {
    return content;
  }

  if (!Array.isArray(content)) {
    return "";
  }

  return content
    .map((part) => (part.type === "text" ? part.text : ""))
    .join(" ")
    .trim();
}

async function readJsonResponse(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) {
    return {};
  }

  return JSON.parse(text);
}

function isDevassetStatus(value: unknown): value is DevassetStatus {
  if (!isObject(value)) {
    return false;
  }

  return (
    (value.state === "missing" ||
      value.state === "running" ||
      value.state === "ready" ||
      value.state === "error") &&
    typeof value.ready === "boolean" &&
    typeof value.message === "string"
  );
}

function isSelectedClip(value: unknown): value is SelectedClip {
  if (!isObject(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    typeof value.assetId === "string" &&
    typeof value.title === "string" &&
    typeof value.startMs === "number" &&
    typeof value.endMs === "number" &&
    typeof value.thumbnailPath === "string" &&
    typeof value.previewPath === "string" &&
    (typeof value.thumbnailUrl === "string" || value.thumbnailUrl === null) &&
    (typeof value.previewUrl === "string" || value.previewUrl === null) &&
    typeof value.score === "number"
  );
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function formatSeconds(ms: number): string {
  return (Math.max(0, ms) / 1000).toFixed(3).replace(/\.?0+$/, "");
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}
