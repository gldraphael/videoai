import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import type { FastifyReply, FastifyRequest } from "fastify";

const THUMBNAIL_REFERENCE_PREFIX = "var/thumbnails";
const DEVASSET_REFERENCE_PREFIX = "var/devassets";

const thumbnailContentTypes = new Map([
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".png", "image/png"],
  [".webp", "image/webp"]
]);

const previewContentTypes = new Map([
  [".mp4", "video/mp4"],
  [".mov", "video/quicktime"],
  [".webm", "video/webm"]
]);

export type MediaRouteKind = "thumbnail" | "devasset-preview";

export type MediaRouteConfig = {
  devassetRoot: string;
  thumbnailRoot: string;
};

export type MediaPathResolution =
  | {
      ok: true;
      contentType: string;
      filePath: string;
      kind: MediaRouteKind;
    }
  | {
      ok: false;
      statusCode: 400 | 404;
      message: string;
    };

type ByteRange =
  | {
      ok: true;
      start: number;
      end: number;
    }
  | {
      ok: false;
    };

export function generatedMediaReferenceToUrl(reference: string): string | null {
  const normalized = normalizeReference(reference);
  const thumbnailSuffix = referenceSuffix(
    normalized,
    THUMBNAIL_REFERENCE_PREFIX
  );
  if (thumbnailSuffix) {
    return `/api/media/thumbnails/${encodePathSuffix(thumbnailSuffix)}`;
  }

  const devassetSuffix = referenceSuffix(normalized, DEVASSET_REFERENCE_PREFIX);
  if (devassetSuffix) {
    return `/api/media/devassets/${encodePathSuffix(devassetSuffix)}`;
  }

  return null;
}

export function resolveMediaRoutePath(
  root: string,
  suffix: string,
  kind: MediaRouteKind
): MediaPathResolution {
  const normalizedSuffix = normalizeReference(suffix);
  if (!normalizedSuffix || path.isAbsolute(normalizedSuffix)) {
    return {
      ok: false,
      statusCode: 400,
      message: "Media path must be a relative generated path."
    };
  }

  const parts = normalizedSuffix.split("/");
  if (parts.some((part) => part === "" || part === "." || part === "..")) {
    return {
      ok: false,
      statusCode: 400,
      message: "Media path must not contain empty or relative segments."
    };
  }

  const extension = path.extname(parts.at(-1) ?? "").toLowerCase();
  const contentType =
    kind === "thumbnail"
      ? thumbnailContentTypes.get(extension)
      : previewContentTypes.get(extension);
  if (!contentType) {
    return {
      ok: false,
      statusCode: 400,
      message: "Media type is not supported for browser preview routes."
    };
  }

  if (kind === "devasset-preview" && !isGeneratedSourceName(parts.at(-1) ?? "")) {
    return {
      ok: false,
      statusCode: 400,
      message: "Devasset preview routes only expose generated source videos."
    };
  }

  const rootPath = path.resolve(root);
  const filePath = path.resolve(rootPath, ...parts);
  if (!isInsideRoot(filePath, rootPath)) {
    return {
      ok: false,
      statusCode: 400,
      message: "Media path must resolve within the configured generated root."
    };
  }

  return {
    ok: true,
    contentType,
    filePath,
    kind
  };
}

export async function sendGeneratedMedia(
  request: FastifyRequest,
  reply: FastifyReply,
  resolution: MediaPathResolution
) {
  if (!resolution.ok) {
    return reply.code(resolution.statusCode).send({
      error: resolution.statusCode === 404 ? "not_found" : "invalid_media_path",
      message: resolution.message
    });
  }

  let fileStat: Awaited<ReturnType<typeof stat>>;
  try {
    fileStat = await stat(resolution.filePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return reply.code(404).send({
        error: "not_found",
        message: "Generated media was not found."
      });
    }

    throw error;
  }

  if (!fileStat.isFile()) {
    return reply.code(404).send({
      error: "not_found",
      message: "Generated media was not found."
    });
  }

  const size = fileStat.size;
  reply.header("accept-ranges", "bytes");
  reply.type(resolution.contentType);

  const rangeHeader = request.headers.range;
  if (resolution.kind === "devasset-preview" && rangeHeader) {
    const range = parseByteRange(rangeHeader, size);
    if (!range.ok) {
      return reply
        .code(416)
        .header("content-range", `bytes */${size}`)
        .send();
    }

    reply
      .code(206)
      .header("content-range", `bytes ${range.start}-${range.end}/${size}`)
      .header("content-length", String(range.end - range.start + 1));
    return reply.send(
      createReadStream(resolution.filePath, {
        start: range.start,
        end: range.end
      })
    );
  }

  reply.header("content-length", String(size));
  return reply.send(createReadStream(resolution.filePath));
}

export function mediaSuffixFromParams(params: unknown): string {
  if (!params || typeof params !== "object") {
    return "";
  }

  const suffix = (params as Record<string, unknown>)["*"];
  return typeof suffix === "string" ? suffix : "";
}

function parseByteRange(header: string, size: number): ByteRange {
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match || size < 1) {
    return { ok: false };
  }

  const [, startText, endText] = match;
  if (!startText && !endText) {
    return { ok: false };
  }

  if (!startText) {
    const suffixLength = Number(endText);
    if (!Number.isInteger(suffixLength) || suffixLength < 1) {
      return { ok: false };
    }
    return {
      ok: true,
      start: Math.max(0, size - suffixLength),
      end: size - 1
    };
  }

  const start = Number(startText);
  const end = endText ? Number(endText) : size - 1;
  if (
    !Number.isInteger(start) ||
    !Number.isInteger(end) ||
    start < 0 ||
    end < start ||
    start >= size
  ) {
    return { ok: false };
  }

  return {
    ok: true,
    start,
    end: Math.min(end, size - 1)
  };
}

function referenceSuffix(reference: string, prefix: string): string | null {
  if (reference === prefix || !reference.startsWith(`${prefix}/`)) {
    return null;
  }

  const suffix = reference.slice(prefix.length + 1);
  const parts = suffix.split("/");
  if (path.isAbsolute(suffix) || parts.some((part) => part === "" || part === "." || part === "..")) {
    return null;
  }

  return suffix;
}

function encodePathSuffix(suffix: string): string {
  return suffix.split("/").map(encodeURIComponent).join("/");
}

function normalizeReference(reference: string): string {
  return reference.replaceAll("\\", "/");
}

function isGeneratedSourceName(fileName: string): boolean {
  return /^source\.(mp4|mov|webm)$/i.test(fileName);
}

function isInsideRoot(candidatePath: string, rootPath: string): boolean {
  const relativePath = path.relative(rootPath, candidatePath);
  return (
    relativePath === "" ||
    (!relativePath.startsWith("..") && !path.isAbsolute(relativePath))
  );
}
