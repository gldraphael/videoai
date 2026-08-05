import {
  DEFAULT_CLIP_SEARCH_LIMIT,
  MAX_CLIP_SEARCH_LIMIT,
  validateClipSearchRequest,
  type ClipSearchResult,
  type ClipSearchService,
  type ValidatedClipSearchRequest
} from "./clips.js";
import type { DevassetReadiness } from "./devassets.js";
import { generatedMediaReferenceToUrl } from "./media.js";

export type ChatRequest = {
  message: string;
  limit?: number;
};

export type ValidatedChatRequest = {
  message: string;
  search: ValidatedClipSearchRequest;
};

export type ChatTextPart = {
  type: "text";
  text: string;
};

export type ChatClipCandidatesPart = {
  type: "clip-candidates";
  query: string;
  candidates: ChatClipCandidate[];
};

export type ChatResponse = {
  role: "assistant";
  content: [ChatTextPart, ChatClipCandidatesPart];
};

export type ChatClipCandidate = ClipSearchResult & {
  thumbnailUrl: string | null;
  previewUrl: string | null;
};

export type ChatOutcome =
  | {
      ready: true;
      response: ChatResponse;
    }
  | {
      ready: false;
      devassets: DevassetReadiness;
    };

type ValidationResult<T> =
  | {
      ok: true;
      value: T;
    }
  | {
      ok: false;
      message: string;
    };

export class ClipAssistantChatService {
  constructor(private readonly clipSearch: ClipSearchService) {}

  async respond(request: ValidatedChatRequest): Promise<ChatOutcome> {
    const result = await this.clipSearch.search(request.search);
    if (!result.ready) {
      return result;
    }

    return {
      ready: true,
      response: buildChatResponse(result.response.query, result.response.results)
    };
  }
}

export function validateChatRequest(
  value: unknown
): ValidationResult<ValidatedChatRequest> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {
      ok: false,
      message: "Request body must be a JSON object."
    };
  }

  const request = value as Record<string, unknown>;
  if (typeof request.message !== "string") {
    return {
      ok: false,
      message: "message must be a string."
    };
  }

  const searchValidation = validateClipSearchRequest({
    query: request.message,
    limit: request.limit
  });
  if (!searchValidation.ok) {
    return {
      ok: false,
      message: searchValidation.message.replace(/^query/, "message")
    };
  }

  return {
    ok: true,
    value: {
      message: request.message.trim(),
      search: searchValidation.value
    }
  };
}

export function buildChatResponse(
  query: string,
  results: ClipSearchResult[]
): ChatResponse {
  const candidates = results.map(toChatClipCandidate);
  const count = candidates.length;
  const text =
    count === 0
      ? `I searched the local clip library for "${query}" but did not find matching clips.`
      : `I found ${count} local clip${count === 1 ? "" : "s"} matching "${query}". Select clips to keep them for a later edit plan.`;

  return {
    role: "assistant",
    content: [
      {
        type: "text",
        text
      },
      {
        type: "clip-candidates",
        query,
        candidates
      }
    ]
  };
}

export function chatDefaults() {
  return {
    defaultLimit: DEFAULT_CLIP_SEARCH_LIMIT,
    maxLimit: MAX_CLIP_SEARCH_LIMIT
  };
}

function toChatClipCandidate(result: ClipSearchResult): ChatClipCandidate {
  return {
    ...result,
    thumbnailUrl: generatedMediaReferenceToUrl(result.thumbnailPath),
    previewUrl: generatedMediaReferenceToUrl(result.previewPath)
  };
}
