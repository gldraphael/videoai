import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import {
  readDevassetStatus,
  type DevassetReadiness,
  type DevassetStatusConfig
} from "./devassets.js";

export const DEFAULT_CLIP_SEARCH_LIMIT = 8;
export const MAX_CLIP_SEARCH_LIMIT = 20;

const DEVASSET_REFERENCE_PREFIX = "var/devassets";
const THUMBNAIL_REFERENCE_PREFIX = "var/thumbnails";
const TARGET_TRANSCRIPT_WINDOW_MS = 12_000;
const MAX_TRANSCRIPT_WINDOW_MS = 20_000;
const FALLBACK_WINDOW_MS = 10_000;
const idPattern = /^[a-z0-9](?:[a-z0-9-]{0,78}[a-z0-9])?$/;

export type ClipSearchConfig = DevassetStatusConfig & {
  devassetRoot: string;
  thumbnailRoot: string;
};

export type GeneratedMediaLibrary = {
  version: 1;
  generatedAt: string;
  catalogIdentity: string;
  assets: GeneratedMediaLibraryAsset[];
};

export type GeneratedMediaLibraryAsset = {
  id: string;
  title: string;
  type: "video";
  source: {
    path: string;
  };
  media: {
    durationSeconds: number;
  };
  thumbnail: {
    path: string;
  };
  transcript: {
    json: {
      path: string;
    };
  };
};

export type WhisperTranscriptJson = {
  transcription: WhisperTranscriptEntry[];
};

export type WhisperTranscriptEntry = {
  offsets: {
    from: number;
    to: number;
  };
  text: string;
};

export type TranscriptSegment = {
  startMs: number;
  endMs: number;
  text: string;
};

export type ClipDocument = {
  id: string;
  assetId: string;
  title: string;
  startMs: number;
  endMs: number;
  snippet: string;
  thumbnailPath: string;
  previewPath: string;
  titleText: string;
  snippetText: string;
};

export type ClipSearchRequest = {
  query: string;
  limit?: number;
};

export type ValidatedClipSearchRequest = {
  query: string;
  terms: string[];
  limit: number;
};

export type ClipSearchResult = {
  id: string;
  assetId: string;
  title: string;
  startMs: number;
  endMs: number;
  snippet: string;
  thumbnailPath: string;
  previewPath: string;
  score: number;
};

export type ClipSearchResponse = {
  query: string;
  results: ClipSearchResult[];
};

export type ClipIndex = {
  libraryIdentity: string;
  documents: ClipDocument[];
};

export type ClipIndexLoadResult =
  | {
      ready: true;
      cacheKey: string;
      index: ClipIndex;
    }
  | {
      ready: false;
      devassets: DevassetReadiness;
    };

export type ClipSearchOutcome =
  | {
      ready: true;
      response: ClipSearchResponse;
    }
  | {
      ready: false;
      devassets: DevassetReadiness;
    };

export type ClipSearchService = {
  search(request: ValidatedClipSearchRequest): Promise<ClipSearchOutcome>;
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

type ClipIndexCacheEntry = {
  cacheKey: string;
  index: ClipIndex;
};

export class ClipIndexCache implements ClipSearchService {
  private cached?: ClipIndexCacheEntry;

  constructor(
    private readonly config: ClipSearchConfig,
    private readonly readStatus: (
      config: DevassetStatusConfig
    ) => Promise<DevassetReadiness> = readDevassetStatus
  ) {}

  async getIndex(): Promise<ClipIndexLoadResult> {
    const devassets = await this.readStatus({
      statusPath: this.config.statusPath,
      libraryPath: this.config.libraryPath
    });

    if (!devassets.ready) {
      return {
        ready: false,
        devassets
      };
    }

    let libraryState: Awaited<ReturnType<typeof stat>>;
    try {
      libraryState = await stat(this.config.libraryPath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return {
          ready: false,
          devassets: {
            state: "missing",
            ready: false,
            message:
              "Local devasset library is missing. Run the seed service to prepare it.",
            catalogIdentity: devassets.catalogIdentity
          }
        };
      }

      throw error;
    }

    const cacheKey = [
      devassets.catalogIdentity ?? "unknown",
      libraryState.size,
      libraryState.mtimeMs
    ].join(":");

    if (this.cached?.cacheKey === cacheKey) {
      return {
        ready: true,
        cacheKey,
        index: this.cached.index
      };
    }

    const library = validateMediaLibrary(
      JSON.parse(await readFile(this.config.libraryPath, "utf8")),
      this.config
    );
    const index = await buildClipIndex(library, this.config);

    this.cached = {
      cacheKey,
      index
    };

    return {
      ready: true,
      cacheKey,
      index
    };
  }

  async search(request: ValidatedClipSearchRequest): Promise<ClipSearchOutcome> {
    const loaded = await this.getIndex();

    if (!loaded.ready) {
      return loaded;
    }

    return {
      ready: true,
      response: searchClipIndex(loaded.index, request)
    };
  }
}

export function validateClipSearchRequest(
  value: unknown
): ValidationResult<ValidatedClipSearchRequest> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {
      ok: false,
      message: "Request body must be a JSON object."
    };
  }

  const request = value as Record<string, unknown>;
  if (typeof request.query !== "string") {
    return {
      ok: false,
      message: "query must be a string."
    };
  }

  const normalizedQuery = normalizeLexicalText(request.query);
  const terms = tokenize(normalizedQuery);
  if (terms.length === 0) {
    return {
      ok: false,
      message: "query must contain non-whitespace search text."
    };
  }

  const limit =
    request.limit === undefined ? DEFAULT_CLIP_SEARCH_LIMIT : request.limit;

  if (!Number.isInteger(limit) || (limit as number) < 1) {
    return {
      ok: false,
      message: "limit must be a positive integer."
    };
  }

  if ((limit as number) > MAX_CLIP_SEARCH_LIMIT) {
    return {
      ok: false,
      message: `limit must be less than or equal to ${MAX_CLIP_SEARCH_LIMIT}.`
    };
  }

  return {
    ok: true,
    value: {
      query: normalizedQuery,
      terms,
      limit: limit as number
    }
  };
}

export function validateMediaLibrary(
  value: unknown,
  config: Pick<ClipSearchConfig, "devassetRoot" | "thumbnailRoot">
): GeneratedMediaLibrary {
  const library = expectObject(value, "library");
  const version = library.version;
  const generatedAt = expectNonEmptyString(library.generatedAt, "library.generatedAt");
  const catalogIdentity = expectNonEmptyString(
    library.catalogIdentity,
    "library.catalogIdentity"
  );

  if (version !== 1) {
    throw new Error("library.version must be 1");
  }

  if (!Array.isArray(library.assets)) {
    throw new Error("library.assets must be an array");
  }

  const seenIds = new Set<string>();
  const assets = library.assets.map((asset, index) => {
    const validated = validateMediaLibraryAsset(asset, index, config);
    if (seenIds.has(validated.id)) {
      throw new Error(`library.assets[${index}].id must be unique`);
    }
    seenIds.add(validated.id);
    return validated;
  });

  return {
    version: 1,
    generatedAt,
    catalogIdentity,
    assets
  };
}

export function normalizeTranscriptText(value: string): string | undefined {
  const normalized = value
    .normalize("NFKC")
    .replace(/\[_[A-Z0-9_]+\]/gi, " ")
    .replace(/<\|[^|]+?\|>/g, " ")
    .replace(/\uFFFD/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized || !/[\p{L}\p{N}]/u.test(normalized)) {
    return undefined;
  }

  return normalized;
}

export function transcriptSegmentsFromWhisperJson(
  value: unknown,
  durationMs: number
): TranscriptSegment[] {
  const transcript = expectObject(value, "transcript");
  if (!Array.isArray(transcript.transcription)) {
    return [];
  }

  return transcript.transcription
    .map((entry, index) => parseWhisperTranscriptEntry(entry, index, durationMs))
    .filter((entry): entry is TranscriptSegment => entry !== undefined)
    .sort((left, right) => {
      const startComparison = left.startMs - right.startMs;
      return startComparison === 0 ? left.endMs - right.endMs : startComparison;
    });
}

export function deriveTranscriptClipDocuments(
  asset: GeneratedMediaLibraryAsset,
  segments: TranscriptSegment[]
): ClipDocument[] {
  const documents: ClipDocument[] = [];
  let windowSegments: TranscriptSegment[] = [];

  const flushWindow = () => {
    const first = windowSegments[0];
    const last = windowSegments[windowSegments.length - 1];
    if (!first || !last) {
      return;
    }

    documents.push(
      createClipDocument(
        asset,
        first.startMs,
        last.endMs,
        windowSegments.map((segment) => segment.text).join(" ")
      )
    );
    windowSegments = [];
  };

  for (const segment of segments) {
    const first = windowSegments[0];
    if (
      first &&
      segment.endMs - first.startMs > MAX_TRANSCRIPT_WINDOW_MS &&
      windowSegments.length > 0
    ) {
      flushWindow();
    }

    windowSegments.push(segment);

    const currentFirst = windowSegments[0];
    const currentLast = windowSegments[windowSegments.length - 1];
    if (
      currentFirst &&
      currentLast &&
      currentLast.endMs - currentFirst.startMs >= TARGET_TRANSCRIPT_WINDOW_MS
    ) {
      flushWindow();
    }
  }

  flushWindow();
  return documents;
}

export function deriveFallbackClipDocuments(
  asset: GeneratedMediaLibraryAsset
): ClipDocument[] {
  const durationMs = assetDurationMs(asset);
  const documents: ClipDocument[] = [];

  for (let startMs = 0; startMs < durationMs; startMs += FALLBACK_WINDOW_MS) {
    const endMs = Math.min(durationMs, startMs + FALLBACK_WINDOW_MS);
    if (endMs <= startMs) {
      break;
    }
    documents.push(createClipDocument(asset, startMs, endMs, ""));
  }

  return documents;
}

export async function buildClipIndex(
  library: GeneratedMediaLibrary,
  config: Pick<ClipSearchConfig, "devassetRoot">
): Promise<ClipIndex> {
  const documents: ClipDocument[] = [];

  for (const asset of library.assets) {
    const transcriptPath = resolveGeneratedReferencePath(
      asset.transcript.json.path,
      config.devassetRoot,
      DEVASSET_REFERENCE_PREFIX
    );
    const transcriptJson = JSON.parse(await readFile(transcriptPath, "utf8"));
    const segments = transcriptSegmentsFromWhisperJson(
      transcriptJson,
      assetDurationMs(asset)
    );

    documents.push(
      ...(segments.length > 0
        ? deriveTranscriptClipDocuments(asset, segments)
        : deriveFallbackClipDocuments(asset))
    );
  }

  documents.sort(compareClipDocuments);

  return {
    libraryIdentity: library.catalogIdentity,
    documents
  };
}

export function searchClipIndex(
  index: ClipIndex,
  request: ValidatedClipSearchRequest
): ClipSearchResponse {
  const uniqueTerms = Array.from(new Set(request.terms));
  const results = index.documents
    .map((document) => ({
      document,
      score: scoreClipDocument(document, request.query, uniqueTerms)
    }))
    .filter((candidate) => candidate.score > 0)
    .sort((left, right) => {
      const scoreComparison = right.score - left.score;
      if (scoreComparison !== 0) {
        return scoreComparison;
      }

      return compareClipDocuments(left.document, right.document);
    })
    .slice(0, request.limit)
    .map(({ document, score }) => ({
      id: document.id,
      assetId: document.assetId,
      title: document.title,
      startMs: document.startMs,
      endMs: document.endMs,
      snippet: document.snippet,
      thumbnailPath: document.thumbnailPath,
      previewPath: document.previewPath,
      score: Number(score.toFixed(4))
    }));

  return {
    query: request.query,
    results
  };
}

export function resolveGeneratedReferencePath(
  reference: string,
  root: string,
  publicPrefix: string
): string {
  const rootPath = path.resolve(root);
  const normalizedReference = reference.replaceAll("\\", "/");

  if (path.isAbsolute(normalizedReference)) {
    return assertInsideRoot(path.resolve(normalizedReference), rootPath, reference);
  }

  if (
    normalizedReference === publicPrefix ||
    !normalizedReference.startsWith(`${publicPrefix}/`)
  ) {
    throw new Error(`${reference} must resolve under ${publicPrefix}`);
  }

  const suffix = normalizedReference.slice(publicPrefix.length + 1);
  const parts = suffix.split("/");
  if (parts.some((part) => part === "" || part === "." || part === "..")) {
    throw new Error(`${reference} must not contain empty or relative path segments`);
  }

  return assertInsideRoot(path.resolve(rootPath, ...parts), rootPath, reference);
}

function validateMediaLibraryAsset(
  value: unknown,
  index: number,
  config: Pick<ClipSearchConfig, "devassetRoot" | "thumbnailRoot">
): GeneratedMediaLibraryAsset {
  const location = `library.assets[${index}]`;
  const asset = expectObject(value, location);
  const id = expectNonEmptyString(asset.id, `${location}.id`);
  const title = expectNonEmptyString(asset.title, `${location}.title`);
  const type = asset.type;
  const source = expectObject(asset.source, `${location}.source`);
  const media = expectObject(asset.media, `${location}.media`);
  const thumbnail = expectObject(asset.thumbnail, `${location}.thumbnail`);
  const transcript = expectObject(asset.transcript, `${location}.transcript`);
  const transcriptJson = expectObject(
    transcript.json,
    `${location}.transcript.json`
  );
  const durationSeconds = expectFiniteNumber(
    media.durationSeconds,
    `${location}.media.durationSeconds`
  );

  if (!idPattern.test(id)) {
    throw new Error(`${location}.id must be a lowercase slug`);
  }

  if (type !== "video") {
    throw new Error(`${location}.type must be "video"`);
  }

  if (durationSeconds <= 0) {
    throw new Error(`${location}.media.durationSeconds must be greater than 0`);
  }

  const sourcePath = expectNonEmptyString(source.path, `${location}.source.path`);
  const thumbnailPath = expectNonEmptyString(
    thumbnail.path,
    `${location}.thumbnail.path`
  );
  const transcriptJsonPath = expectNonEmptyString(
    transcriptJson.path,
    `${location}.transcript.json.path`
  );

  resolveGeneratedReferencePath(
    sourcePath,
    config.devassetRoot,
    DEVASSET_REFERENCE_PREFIX
  );
  resolveGeneratedReferencePath(
    thumbnailPath,
    config.thumbnailRoot,
    THUMBNAIL_REFERENCE_PREFIX
  );
  resolveGeneratedReferencePath(
    transcriptJsonPath,
    config.devassetRoot,
    DEVASSET_REFERENCE_PREFIX
  );

  return {
    id,
    title,
    type: "video",
    source: {
      path: sourcePath
    },
    media: {
      durationSeconds
    },
    thumbnail: {
      path: thumbnailPath
    },
    transcript: {
      json: {
        path: transcriptJsonPath
      }
    }
  };
}

function parseWhisperTranscriptEntry(
  value: unknown,
  index: number,
  durationMs: number
): TranscriptSegment | undefined {
  const location = `transcript.transcription[${index}]`;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const entry = value as Record<string, unknown>;
  if (typeof entry.text !== "string") {
    return undefined;
  }

  const offsets = entry.offsets;
  if (!offsets || typeof offsets !== "object" || Array.isArray(offsets)) {
    return undefined;
  }

  const offsetRecord = offsets as Record<string, unknown>;
  if (
    typeof offsetRecord.from !== "number" ||
    typeof offsetRecord.to !== "number" ||
    !Number.isFinite(offsetRecord.from) ||
    !Number.isFinite(offsetRecord.to)
  ) {
    throw new Error(`${location}.offsets must contain finite from/to values`);
  }

  const text = normalizeTranscriptText(entry.text);
  if (!text) {
    return undefined;
  }

  const startMs = clampMs(Math.round(offsetRecord.from), durationMs);
  const endMs = clampMs(Math.round(offsetRecord.to), durationMs);
  if (endMs <= startMs) {
    return undefined;
  }

  return {
    startMs,
    endMs,
    text
  };
}

function createClipDocument(
  asset: GeneratedMediaLibraryAsset,
  startMs: number,
  endMs: number,
  snippet: string
): ClipDocument {
  const durationMs = assetDurationMs(asset);
  const clippedStartMs = clampMs(Math.round(startMs), durationMs);
  const clippedEndMs = clampMs(Math.round(endMs), durationMs);

  if (clippedEndMs <= clippedStartMs) {
    throw new Error(
      `clip ${asset.id}:${startMs}-${endMs} must have startMs less than endMs`
    );
  }

  const normalizedSnippet = snippet.replace(/\s+/g, " ").trim();

  return {
    id: `${asset.id}:${clippedStartMs}-${clippedEndMs}`,
    assetId: asset.id,
    title: asset.title,
    startMs: clippedStartMs,
    endMs: clippedEndMs,
    snippet: normalizedSnippet,
    thumbnailPath: asset.thumbnail.path,
    previewPath: asset.source.path,
    titleText: normalizeLexicalText(asset.title),
    snippetText: normalizeLexicalText(normalizedSnippet)
  };
}

function scoreClipDocument(
  document: ClipDocument,
  query: string,
  uniqueTerms: string[]
): number {
  const titleTerms = new Set(tokenize(document.titleText));
  const snippetTerms = new Set(tokenize(document.snippetText));
  let score = 0;
  let matchedTerms = 0;

  if (document.titleText.includes(query)) {
    score += 12;
  }

  if (document.snippetText.includes(query)) {
    score += 8;
  }

  for (const term of uniqueTerms) {
    let matched = false;

    if (titleTerms.has(term)) {
      score += 6;
      matched = true;
    } else if (document.titleText.includes(term)) {
      score += 2;
      matched = true;
    }

    if (snippetTerms.has(term)) {
      score += 3;
      matched = true;
    } else if (document.snippetText.includes(term)) {
      score += 1;
      matched = true;
    }

    if (matched) {
      matchedTerms += 1;
    }
  }

  if (uniqueTerms.length > 0 && matchedTerms > 0) {
    score += (matchedTerms / uniqueTerms.length) * 5;
  }

  return score;
}

function compareClipDocuments(left: ClipDocument, right: ClipDocument): number {
  const assetComparison = left.assetId.localeCompare(right.assetId);
  if (assetComparison !== 0) {
    return assetComparison;
  }

  const startComparison = left.startMs - right.startMs;
  if (startComparison !== 0) {
    return startComparison;
  }

  return left.id.localeCompare(right.id);
}

function normalizeLexicalText(value: string): string {
  return tokenize(value.normalize("NFKC").toLowerCase()).join(" ");
}

function tokenize(value: string): string[] {
  return Array.from(value.matchAll(/[\p{L}\p{N}]+/gu), (match) => match[0]);
}

function assetDurationMs(asset: GeneratedMediaLibraryAsset): number {
  return Math.max(1, Math.round(asset.media.durationSeconds * 1000));
}

function clampMs(value: number, maxMs: number): number {
  return Math.max(0, Math.min(maxMs, value));
}

function expectObject(value: unknown, location: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${location} must be an object`);
  }

  return value as Record<string, unknown>;
}

function expectNonEmptyString(value: unknown, location: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${location} must be a non-empty string`);
  }

  return value;
}

function expectFiniteNumber(value: unknown, location: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${location} must be a finite number`);
  }

  return value;
}

function assertInsideRoot(candidatePath: string, rootPath: string, reference: string): string {
  const relativePath = path.relative(rootPath, candidatePath);
  if (
    relativePath === "" ||
    (!relativePath.startsWith("..") && !path.isAbsolute(relativePath))
  ) {
    return candidatePath;
  }

  throw new Error(`${reference} must resolve within ${rootPath}`);
}
