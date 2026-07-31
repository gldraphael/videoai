export type SeedStatusState = "missing" | "running" | "ready" | "error";

export type SeedStatus = {
  version: 1;
  state: SeedStatusState;
  message: string;
  updatedAt: string;
  catalogIdentity?: string;
  libraryPath?: string;
  assetCount?: number;
  error?: {
    message: string;
  };
};

export type MediaMetadata = {
  durationSeconds?: number;
  width?: number;
  height?: number;
  formatName?: string;
  videoCodec?: string;
  audioCodec?: string;
};

export type ThumbnailReference = {
  path: string;
  format: "jpeg";
  width?: number;
  height?: number;
};

export type TranscriptReference = {
  path: string;
  format: "srt";
  generator: "whisper.cpp";
  model: string;
  language: string;
};

export type MediaLibraryAsset = {
  id: string;
  title: string;
  type: "video";
  sourceIdentity: string;
  source: {
    url: string;
    path: string;
  };
  audio: {
    path: string;
    format: "wav";
  };
  media: MediaMetadata;
  thumbnail: ThumbnailReference;
  transcript: TranscriptReference;
};

export type MediaLibrary = {
  version: 1;
  generatedAt: string;
  catalogIdentity: string;
  assets: MediaLibraryAsset[];
};
