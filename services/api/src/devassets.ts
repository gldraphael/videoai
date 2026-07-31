import { readFile } from "node:fs/promises";

export type DevassetStatusState = "missing" | "running" | "ready" | "error";

type SeedStatusFile = {
  version?: number;
  state?: unknown;
  message?: unknown;
  updatedAt?: unknown;
  catalogIdentity?: unknown;
  libraryPath?: unknown;
  assetCount?: unknown;
  error?: {
    message?: unknown;
  };
};

type MediaLibraryFile = {
  version?: number;
  catalogIdentity?: unknown;
  assets?: unknown;
};

export type DevassetReadiness = {
  state: DevassetStatusState;
  ready: boolean;
  message: string;
  updatedAt?: string;
  catalogIdentity?: string;
  libraryPath?: string;
  assetCount?: number;
};

export type DevassetStatusConfig = {
  statusPath: string;
  libraryPath: string;
};

export async function readDevassetStatus(
  config: DevassetStatusConfig
): Promise<DevassetReadiness> {
  const status = await readJsonIfExists<SeedStatusFile>(config.statusPath);

  if (!status) {
    return missingStatus();
  }

  if (status.state === "running") {
    return {
      state: "running",
      ready: false,
      message: optionalString(status.message) ?? "Local devassets are being prepared.",
      updatedAt: optionalString(status.updatedAt),
      catalogIdentity: optionalString(status.catalogIdentity),
      assetCount: optionalNumber(status.assetCount)
    };
  }

  if (status.state === "error") {
    return {
      state: "error",
      ready: false,
      message:
        optionalString(status.error?.message) ??
        optionalString(status.message) ??
        "Local devasset setup failed.",
      updatedAt: optionalString(status.updatedAt),
      catalogIdentity: optionalString(status.catalogIdentity),
      assetCount: optionalNumber(status.assetCount)
    };
  }

  if (status.state !== "ready") {
    return {
      state: "error",
      ready: false,
      message: "Local devasset setup status is invalid.",
      updatedAt: optionalString(status.updatedAt)
    };
  }

  const library = await readJsonIfExists<MediaLibraryFile>(config.libraryPath);
  if (!library) {
    return {
      ...missingStatus(),
      message: "Local devasset library is missing. Run the seed service to prepare it.",
      updatedAt: optionalString(status.updatedAt),
      catalogIdentity: optionalString(status.catalogIdentity)
    };
  }

  if (!Array.isArray(library.assets)) {
    return {
      state: "error",
      ready: false,
      message: "Local devasset library is invalid.",
      updatedAt: optionalString(status.updatedAt),
      catalogIdentity: optionalString(status.catalogIdentity)
    };
  }

  return {
    state: "ready",
    ready: true,
    message: optionalString(status.message) ?? "Local devassets are ready.",
    updatedAt: optionalString(status.updatedAt),
    catalogIdentity:
      optionalString(status.catalogIdentity) ?? optionalString(library.catalogIdentity),
    libraryPath: optionalString(status.libraryPath) ?? "var/devassets/library.json",
    assetCount: library.assets.length
  };
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

function missingStatus(): DevassetReadiness {
  return {
    state: "missing",
    ready: false,
    message: "Local devassets have not been prepared yet."
  };
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function optionalNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
