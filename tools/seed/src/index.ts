import { spawn } from "node:child_process";
import { createWriteStream, existsSync } from "node:fs";
import {
  mkdir,
  readFile,
  rename,
  rm,
  stat,
  writeFile
} from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream } from "node:stream/web";
import {
  assetIdentity,
  catalogIdentity,
  loadCatalog,
  shortIdentity,
  type CatalogAsset,
  type DevassetCatalog
} from "./catalog.js";
import type {
  MediaLibrary,
  MediaLibraryAsset,
  MediaMetadata,
  SeedStatus
} from "./contracts.js";

type CliOptions = {
  catalogPath: string;
  devassetsDir: string;
  thumbnailsDir: string;
  force: boolean;
  whisperModel: string;
  whisperLanguage: string;
};

type RuntimePaths = {
  devassetsDir: string;
  thumbnailsDir: string;
  statusPath: string;
  libraryPath: string;
};

type AssetPaths = {
  assetDir: string;
  sourcePath: string;
  audioPath: string;
  transcriptPath: string;
  transcriptOutputBase: string;
  thumbnailPath: string;
  sourceRelPath: string;
  audioRelPath: string;
  transcriptRelPath: string;
  thumbnailRelPath: string;
};

type CommandResult = {
  stdout: string;
  stderr: string;
};

const defaultCatalogPath = "devassets/catalog.yaml";
const defaultDevassetsDir = "var/devassets";
const defaultThumbnailsDir = "var/thumbnails";
const defaultWhisperModel = "/models/ggml-base.en.bin";

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const runtimePaths = getRuntimePaths(options);

  await mkdir(path.dirname(runtimePaths.statusPath), { recursive: true });
  await mkdir(runtimePaths.devassetsDir, { recursive: true });
  await mkdir(runtimePaths.thumbnailsDir, { recursive: true });

  try {
    const previousStatus = await readJsonIfExists<SeedStatus>(runtimePaths.statusPath);
    const previousLibrary = await readJsonIfExists<MediaLibrary>(runtimePaths.libraryPath);

    await writeStatus(runtimePaths.statusPath, {
      state: "running",
      message: "Validating local development asset catalog."
    });

    const catalog = await loadCatalog(options.catalogPath);
    const identity = catalogIdentity(catalog);

    await writeStatus(runtimePaths.statusPath, {
      state: "running",
      message: `Preparing ${catalog.assets.length} local development asset(s).`,
      catalogIdentity: identity,
      assetCount: catalog.assets.length
    });

    const canReuseAllArtifacts =
      !options.force &&
      previousStatus?.state === "ready" &&
      previousStatus.catalogIdentity === identity &&
      previousLibrary?.catalogIdentity === identity &&
      (await requiredOutputsExist(catalog, runtimePaths));

    const library = canReuseAllArtifacts
      ? await buildLibraryFromExistingArtifacts(
          catalog,
          identity,
          previousLibrary,
          runtimePaths,
          options
        )
      : await generateLibrary(catalog, identity, runtimePaths, options);

    await atomicWriteJson(runtimePaths.libraryPath, library);
    await writeStatus(runtimePaths.statusPath, {
      state: "ready",
      message: canReuseAllArtifacts
        ? "Local development assets are ready; reused existing media artifacts."
        : "Local development assets are ready.",
      catalogIdentity: identity,
      libraryPath: "var/devassets/library.json",
      assetCount: library.assets.length
    });

    console.log(
      canReuseAllArtifacts
        ? "Devasset seed complete: reused existing media artifacts."
        : "Devasset seed complete: generated local media artifacts."
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await writeStatus(runtimePaths.statusPath, {
      state: "error",
      message: `Local development asset setup failed: ${message}`,
      error: { message }
    });
    console.error(message);
    process.exitCode = 1;
  }
}

function parseArgs(args: string[]): CliOptions {
  let catalogPath = defaultCatalogPath;
  let force = false;
  const workspaceRoot = findWorkspaceRoot(process.cwd());

  for (const arg of args) {
    if (arg === "--force") {
      force = true;
      continue;
    }

    if (arg.startsWith("--")) {
      throw new Error(`Unsupported option "${arg}"`);
    }

    catalogPath = arg;
  }

  return {
    catalogPath: resolveWorkspacePath(catalogPath, workspaceRoot),
    devassetsDir: resolveWorkspacePath(
      process.env.DEVASSETS_DIR ?? defaultDevassetsDir,
      workspaceRoot
    ),
    thumbnailsDir: resolveWorkspacePath(
      process.env.THUMBNAILS_DIR ?? defaultThumbnailsDir,
      workspaceRoot
    ),
    force,
    whisperModel: process.env.WHISPER_MODEL ?? defaultWhisperModel,
    whisperLanguage: process.env.WHISPER_LANGUAGE ?? "auto"
  };
}

function findWorkspaceRoot(startPath: string): string | undefined {
  let currentPath = startPath;

  while (true) {
    if (existsSync(path.join(currentPath, "pnpm-workspace.yaml"))) {
      return currentPath;
    }

    const parentPath = path.dirname(currentPath);
    if (parentPath === currentPath) {
      return undefined;
    }

    currentPath = parentPath;
  }
}

function resolveWorkspacePath(inputPath: string, workspaceRoot: string | undefined): string {
  if (path.isAbsolute(inputPath)) {
    return inputPath;
  }

  const cwdPath = path.resolve(inputPath);
  if (existsSync(cwdPath) || !workspaceRoot) {
    return cwdPath;
  }

  return path.join(workspaceRoot, inputPath);
}

function getRuntimePaths(options: CliOptions): RuntimePaths {
  return {
    devassetsDir: options.devassetsDir,
    thumbnailsDir: options.thumbnailsDir,
    statusPath: path.join(options.devassetsDir, ".seed", "status.json"),
    libraryPath: path.join(options.devassetsDir, "library.json")
  };
}

async function generateLibrary(
  catalog: DevassetCatalog,
  identity: string,
  runtimePaths: RuntimePaths,
  options: CliOptions
): Promise<MediaLibrary> {
  const assets: MediaLibraryAsset[] = [];

  for (const [index, asset] of catalog.assets.entries()) {
    const paths = getAssetPaths(asset, runtimePaths);
    const prefix = `Asset ${index + 1}/${catalog.assets.length} (${asset.id})`;

    await mkdir(paths.assetDir, { recursive: true });

    if (options.force || !(await exists(paths.sourcePath))) {
      await writeStatus(runtimePaths.statusPath, {
        state: "running",
        message: `${prefix}: downloading source media.`,
        catalogIdentity: identity,
        assetCount: catalog.assets.length
      });
      await downloadFile(asset.source.url, paths.sourcePath);
    }

    await writeStatus(runtimePaths.statusPath, {
      state: "running",
      message: `${prefix}: probing media metadata.`,
      catalogIdentity: identity,
      assetCount: catalog.assets.length
    });
    const metadata = await probeMedia(paths.sourcePath);

    if (options.force || !(await exists(paths.audioPath))) {
      await writeStatus(runtimePaths.statusPath, {
        state: "running",
        message: `${prefix}: extracting transcription audio.`,
        catalogIdentity: identity,
        assetCount: catalog.assets.length
      });
      await extractAudio(paths.sourcePath, paths.audioPath);
    }

    if (options.force || !(await exists(paths.thumbnailPath))) {
      await writeStatus(runtimePaths.statusPath, {
        state: "running",
        message: `${prefix}: generating thumbnail.`,
        catalogIdentity: identity,
        assetCount: catalog.assets.length
      });
      await generateThumbnail(paths.sourcePath, paths.thumbnailPath, metadata.durationSeconds);
    }

    if (options.force || !(await exists(paths.transcriptPath))) {
      await writeStatus(runtimePaths.statusPath, {
        state: "running",
        message: `${prefix}: generating timestamped transcript.`,
        catalogIdentity: identity,
        assetCount: catalog.assets.length
      });
      await transcribeAudio(paths.audioPath, paths.transcriptOutputBase, options);
    }

    assets.push(toLibraryAsset(asset, paths, metadata, options));
  }

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    catalogIdentity: identity,
    assets
  };
}

async function buildLibraryFromExistingArtifacts(
  catalog: DevassetCatalog,
  identity: string,
  previousLibrary: MediaLibrary,
  runtimePaths: RuntimePaths,
  options: CliOptions
): Promise<MediaLibrary> {
  const assets = catalog.assets.map((asset) => {
    const sourceIdentity = assetIdentity(asset);
    const previous = previousLibrary.assets.find(
      (candidate) => candidate.sourceIdentity === sourceIdentity
    );
    const paths = getAssetPaths(asset, runtimePaths);

    return {
      ...(previous ?? toLibraryAsset(asset, paths, {}, options)),
      id: asset.id,
      title: asset.title,
      type: asset.type,
      sourceIdentity,
      source: {
        url: asset.source.url,
        path: previous?.source.path ?? paths.sourceRelPath
      }
    };
  });

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    catalogIdentity: identity,
    assets
  };
}

function toLibraryAsset(
  asset: CatalogAsset,
  paths: AssetPaths,
  metadata: MediaMetadata,
  options: CliOptions
): MediaLibraryAsset {
  return {
    id: asset.id,
    title: asset.title,
    type: asset.type,
    sourceIdentity: assetIdentity(asset),
    source: {
      url: asset.source.url,
      path: paths.sourceRelPath
    },
    audio: {
      path: paths.audioRelPath,
      format: "wav"
    },
    media: metadata,
    thumbnail: {
      path: paths.thumbnailRelPath,
      format: "jpeg",
      width: metadata.width,
      height: metadata.height
    },
    transcript: {
      path: paths.transcriptRelPath,
      format: "srt",
      generator: "whisper.cpp",
      model: path.basename(options.whisperModel),
      language: options.whisperLanguage
    }
  };
}

async function requiredOutputsExist(
  catalog: DevassetCatalog,
  runtimePaths: RuntimePaths
): Promise<boolean> {
  if (!(await exists(runtimePaths.libraryPath))) {
    return false;
  }

  for (const asset of catalog.assets) {
    const paths = getAssetPaths(asset, runtimePaths);
    if (
      !(await exists(paths.sourcePath)) ||
      !(await exists(paths.audioPath)) ||
      !(await exists(paths.thumbnailPath)) ||
      !(await exists(paths.transcriptPath))
    ) {
      return false;
    }
  }

  return true;
}

function getAssetPaths(asset: CatalogAsset, runtimePaths: RuntimePaths): AssetPaths {
  const identity = shortIdentity(assetIdentity(asset));
  const sourceExtension = sourceExtensionForUrl(asset.source.url);
  const assetDir = path.join(runtimePaths.devassetsDir, "assets", asset.id, identity);
  const sourceFile = `source${sourceExtension}`;
  const thumbnailFile = `${asset.id}-${identity}.jpg`;

  return {
    assetDir,
    sourcePath: path.join(assetDir, sourceFile),
    audioPath: path.join(assetDir, "audio.wav"),
    transcriptPath: path.join(assetDir, "transcript.srt"),
    transcriptOutputBase: path.join(assetDir, "transcript"),
    thumbnailPath: path.join(runtimePaths.thumbnailsDir, thumbnailFile),
    sourceRelPath: posixJoin("var/devassets/assets", asset.id, identity, sourceFile),
    audioRelPath: posixJoin("var/devassets/assets", asset.id, identity, "audio.wav"),
    transcriptRelPath: posixJoin(
      "var/devassets/assets",
      asset.id,
      identity,
      "transcript.srt"
    ),
    thumbnailRelPath: posixJoin("var/thumbnails", thumbnailFile)
  };
}

function sourceExtensionForUrl(value: string): string {
  const extension = path.extname(new URL(value).pathname).toLowerCase();
  return /^\.[a-z0-9]{1,8}$/.test(extension) ? extension : ".mp4";
}

async function downloadFile(url: string, destinationPath: string): Promise<void> {
  const response = await fetch(url);
  if (!response.ok || !response.body) {
    throw new Error(`download failed for ${url}: HTTP ${response.status}`);
  }

  const tempPath = tempSiblingPath(destinationPath);
  await mkdir(path.dirname(destinationPath), { recursive: true });

  try {
    await pipeline(
      Readable.fromWeb(response.body as ReadableStream<Uint8Array>),
      createWriteStream(tempPath)
    );
    await rename(tempPath, destinationPath);
  } catch (error) {
    await rm(tempPath, { force: true });
    throw error;
  }
}

async function probeMedia(sourcePath: string): Promise<MediaMetadata> {
  const result = await runCommand("ffprobe", [
    "-v",
    "error",
    "-print_format",
    "json",
    "-show_format",
    "-show_streams",
    sourcePath
  ]);
  const probe = JSON.parse(result.stdout) as {
    format?: { duration?: string; format_name?: string };
    streams?: Array<{
      codec_type?: string;
      codec_name?: string;
      width?: number;
      height?: number;
      duration?: string;
    }>;
  };
  const videoStream = probe.streams?.find((stream) => stream.codec_type === "video");
  const audioStream = probe.streams?.find((stream) => stream.codec_type === "audio");
  const durationSeconds = numberFromProbe(
    videoStream?.duration ?? probe.format?.duration
  );

  return {
    durationSeconds,
    width: videoStream?.width,
    height: videoStream?.height,
    formatName: probe.format?.format_name,
    videoCodec: videoStream?.codec_name,
    audioCodec: audioStream?.codec_name
  };
}

async function extractAudio(sourcePath: string, audioPath: string): Promise<void> {
  const tempPath = tempSiblingPath(audioPath);
  await mkdir(path.dirname(audioPath), { recursive: true });
  await runCommand("ffmpeg", [
    "-y",
    "-i",
    sourcePath,
    "-vn",
    "-ac",
    "1",
    "-ar",
    "16000",
    "-c:a",
    "pcm_s16le",
    "-f",
    "wav",
    tempPath
  ]);
  await rename(tempPath, audioPath);
}

async function generateThumbnail(
  sourcePath: string,
  thumbnailPath: string,
  durationSeconds: number | undefined
): Promise<void> {
  const tempPath = tempSiblingPath(thumbnailPath);
  const seekTime = durationSeconds && durationSeconds > 2 ? "00:00:01" : "00:00:00.100";
  await mkdir(path.dirname(thumbnailPath), { recursive: true });
  await runCommand("ffmpeg", [
    "-y",
    "-ss",
    seekTime,
    "-i",
    sourcePath,
    "-frames:v",
    "1",
    "-vf",
    "scale=640:-2",
    "-f",
    "image2",
    tempPath
  ]);
  await rename(tempPath, thumbnailPath);
}

async function transcribeAudio(
  audioPath: string,
  transcriptOutputBase: string,
  options: CliOptions
): Promise<void> {
  await runCommand("whisper-cli", [
    "-m",
    options.whisperModel,
    "-f",
    audioPath,
    "-l",
    options.whisperLanguage,
    "-osrt",
    "-of",
    transcriptOutputBase,
    "-np"
  ]);
}

async function runCommand(command: string, args: string[]): Promise<CommandResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];

    child.stdout.on("data", (chunk: Buffer) => stdoutChunks.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => stderrChunks.push(chunk));
    child.on("error", reject);
    child.on("close", (code) => {
      const stdout = Buffer.concat(stdoutChunks).toString("utf8");
      const stderr = Buffer.concat(stderrChunks).toString("utf8");

      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }

      const detail = stderr.trim() || stdout.trim();
      reject(
        new Error(
          `${command} ${args.join(" ")} failed with exit code ${code}${
            detail ? `: ${detail}` : ""
          }`
        )
      );
    });
  });
}

async function writeStatus(
  statusPath: string,
  status: Omit<SeedStatus, "version" | "updatedAt">
): Promise<void> {
  await atomicWriteJson(statusPath, {
    version: 1,
    updatedAt: new Date().toISOString(),
    ...status
  });
}

async function atomicWriteJson(filePath: string, value: unknown): Promise<void> {
  const tempPath = tempSiblingPath(filePath);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(tempPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(tempPath, filePath);
}

async function readJsonIfExists<T>(filePath: string): Promise<T | undefined> {
  try {
    return JSON.parse(await readFile(filePath, "utf8")) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return undefined;
    }

    throw error;
  }
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return false;
    }

    throw error;
  }
}

function tempSiblingPath(filePath: string): string {
  return `${filePath}.${process.pid}.${Date.now()}.tmp`;
}

function numberFromProbe(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function posixJoin(...parts: string[]): string {
  return path.posix.join(...parts);
}

await main();
