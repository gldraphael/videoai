import type { DevassetReadiness } from "./devassets.js";
import type {
  GeneratedMediaLibrary,
  GeneratedMediaLibraryAsset,
  WhisperTranscriptJson
} from "./clips.js";

export function readyDevassetStatus(
  overrides: Partial<DevassetReadiness> = {}
): DevassetReadiness {
  return {
    state: "ready",
    ready: true,
    message: "Local devassets are ready.",
    updatedAt: "2026-08-02T00:00:00.000Z",
    catalogIdentity: "sha256:test-catalog",
    libraryPath: "var/devassets/library.json",
    assetCount: 1,
    ...overrides
  };
}

export function missingDevassetStatus(
  overrides: Partial<DevassetReadiness> = {}
): DevassetReadiness {
  return {
    state: "missing",
    ready: false,
    message: "Local devassets have not been prepared yet.",
    ...overrides
  };
}

export function runningDevassetStatus(
  overrides: Partial<DevassetReadiness> = {}
): DevassetReadiness {
  return {
    state: "running",
    ready: false,
    message: "Local devassets are being prepared.",
    updatedAt: "2026-08-02T00:00:00.000Z",
    catalogIdentity: "sha256:test-catalog",
    assetCount: 1,
    ...overrides
  };
}

export function errorDevassetStatus(
  overrides: Partial<DevassetReadiness> = {}
): DevassetReadiness {
  return {
    state: "error",
    ready: false,
    message: "Local devasset setup failed.",
    updatedAt: "2026-08-02T00:00:00.000Z",
    catalogIdentity: "sha256:test-catalog",
    assetCount: 1,
    ...overrides
  };
}

export function mediaLibraryFixture(
  overrides: Partial<GeneratedMediaLibrary> = {}
): GeneratedMediaLibrary {
  return {
    version: 1,
    generatedAt: "2026-08-02T00:00:00.000Z",
    catalogIdentity: "sha256:test-catalog",
    assets: [mediaLibraryAssetFixture()],
    ...overrides
  };
}

export function changedLibraryIdentity(
  library: GeneratedMediaLibrary,
  catalogIdentity = "sha256:changed-catalog"
): GeneratedMediaLibrary {
  return {
    ...library,
    generatedAt: "2026-08-02T00:01:00.000Z",
    catalogIdentity
  };
}

export function mediaLibraryAssetFixture(
  overrides: Partial<GeneratedMediaLibraryAsset> = {}
): GeneratedMediaLibraryAsset {
  return {
    id: "launch-demo",
    title: "Launch Product Demo",
    type: "video",
    source: {
      path: "var/devassets/assets/launch-demo/test/source.mp4"
    },
    media: {
      durationSeconds: 32
    },
    thumbnail: {
      path: "var/thumbnails/launch-demo.jpg"
    },
    transcript: {
      json: {
        path: "var/devassets/assets/launch-demo/test/transcript.json"
      }
    },
    ...overrides
  };
}

export function usableWhisperTranscript(): WhisperTranscriptJson {
  return whisperTranscriptFixture([
    {
      text: "The launch recap opens with a product demo.",
      from: 0,
      to: 6200
    },
    {
      text: "Customer quotes explain the workflow and creative results.",
      from: 6200,
      to: 13_400
    },
    {
      text: "The ending shows pricing and next steps.",
      from: 13_400,
      to: 21_000
    }
  ]);
}

export function emptyNoisyWhisperTranscript(): WhisperTranscriptJson {
  return whisperTranscriptFixture([
    {
      text: "",
      from: 0,
      to: 1000
    },
    {
      text: "[_BEG_]",
      from: 1000,
      to: 2000
    },
    {
      text: "\uFFFD",
      from: 2000,
      to: 3000
    }
  ]);
}

export function whisperTranscriptFixture(
  entries: Array<{ text: string; from: number; to: number }>
): WhisperTranscriptJson {
  return {
    transcription: entries.map((entry) => ({
      text: entry.text,
      offsets: {
        from: entry.from,
        to: entry.to
      }
    }))
  };
}
