import {
  AssistantRuntimeProvider,
  useAssistantDataUI,
  useLocalRuntime,
  type DataMessagePartProps
} from "@assistant-ui/react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction
} from "react";
import { Thread } from "@/components/assistant-ui/thread";
import {
  appModeForDevassetStatus,
  clipPreviewUrl,
  createClipChatAdapter,
  deselectClip,
  formatScore,
  formatTimeRange,
  parseSelectedClips,
  selectClip,
  selectedClipsStorageKey,
  serializeSelectedClips,
  type ClipCandidate,
  type ClipCandidatesData,
  type DevassetStatus,
  type SelectedClip
} from "./chatModel";

const setupPollMs = 2500;
const initialStatus: DevassetStatus = {
  state: "missing",
  ready: false,
  message: "Checking local development assets."
};

export function App() {
  const status = useDevassetStatus();

  return <AppView status={status} />;
}

export function AppView({ status }: { status: DevassetStatus }) {
  const mode = appModeForDevassetStatus(status);

  if (mode === "error") {
    return <SetupError status={status} />;
  }

  if (mode === "setup") {
    return <SetupScreen status={status} />;
  }

  return <ChatExperience />;
}

function ChatExperience() {
  const [selectedClips, setSelectedClips] = useSessionSelectedClips();
  const selectedIds = useMemo(
    () => new Set(selectedClips.map((clip) => clip.id)),
    [selectedClips]
  );
  const adapter = useMemo(() => createClipChatAdapter(), []);
  const runtime = useLocalRuntime(adapter);

  const handleSelect = useCallback((candidate: ClipCandidate) => {
    setSelectedClips((current) => selectClip(current, candidate));
  }, [setSelectedClips]);

  const handleDeselect = useCallback((clipId: string) => {
    setSelectedClips((current) => deselectClip(current, clipId));
  }, [setSelectedClips]);

  return (
    <main className="chat-shell">
      <section className="assistant-surface" aria-label="VideoAI assistant">
        <AssistantRuntimeProvider runtime={runtime}>
          <ClipCandidatesDataUI
            onDeselect={handleDeselect}
            onSelect={handleSelect}
            selectedIds={selectedIds}
          />
          <Thread />
        </AssistantRuntimeProvider>
      </section>

      <SelectedClipsPanel
        onDeselect={handleDeselect}
        selectedClips={selectedClips}
      />
    </main>
  );
}

export function ClipCandidatesDataUI({
  onDeselect,
  onSelect,
  selectedIds
}: {
  onDeselect: (clipId: string) => void;
  onSelect: (candidate: ClipCandidate) => void;
  selectedIds: Set<string>;
}) {
  const render = useCallback(
    (props: DataMessagePartProps) => (
      <ClipCandidatesDataRenderer
        {...props}
        onDeselect={onDeselect}
        onSelect={onSelect}
        selectedIds={selectedIds}
      />
    ),
    [onDeselect, onSelect, selectedIds]
  );

  useAssistantDataUI({
    name: "clip-candidates",
    render
  });

  return null;
}

export function ClipCandidatesDataRenderer({
  data,
  onDeselect,
  onSelect,
  selectedIds
}: DataMessagePartProps & {
  onDeselect: (clipId: string) => void;
  onSelect: (candidate: ClipCandidate) => void;
  selectedIds: Set<string>;
}) {
  if (!isClipCandidatesData(data)) {
    return null;
  }

  return (
    <ClipCandidatesPart
      data={data}
      onDeselect={onDeselect}
      onSelect={onSelect}
      selectedIds={selectedIds}
    />
  );
}

export function isClipCandidatesData(value: unknown): value is ClipCandidatesData {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidateData = value as ClipCandidatesData;
  return (
    typeof candidateData.query === "string" &&
    Array.isArray(candidateData.candidates)
  );
}

function ClipCandidatesPart({
  data,
  onDeselect,
  onSelect,
  selectedIds
}: {
  data: ClipCandidatesData;
  onDeselect: (clipId: string) => void;
  onSelect: (candidate: ClipCandidate) => void;
  selectedIds: Set<string>;
}) {
  const candidates: ClipCandidate[] = data.candidates;

  if (candidates.length === 0) {
    return (
      <div className="clip-empty" data-testid="clip-empty">
        No clips returned for this request.
      </div>
    );
  }

  return (
    <div className="clip-results" aria-label={`Clip results for ${data.query}`}>
      {candidates.map((candidate) => {
        const selected = selectedIds.has(candidate.id);
        return (
          <ClipCard
            candidate={candidate}
            key={candidate.id}
            onDeselect={onDeselect}
            onSelect={onSelect}
            selected={selected}
          />
        );
      })}
    </div>
  );
}

function ClipCard({
  candidate,
  onDeselect,
  onSelect,
  selected
}: {
  candidate: ClipCandidate;
  onDeselect: (clipId: string) => void;
  onSelect: (candidate: ClipCandidate) => void;
  selected: boolean;
}) {
  const [isPreviewing, setIsPreviewing] = useState(false);
  const previewUrl = clipPreviewUrl(candidate);

  return (
    <article className="clip-card">
      <div className="clip-media">
        {isPreviewing && previewUrl ? (
          <video
            autoPlay
            controls
            poster={candidate.thumbnailUrl ?? undefined}
            preload="none"
            src={previewUrl}
          />
        ) : candidate.thumbnailUrl ? (
          <img alt="" src={candidate.thumbnailUrl} />
        ) : (
          <div className="clip-media-missing" aria-hidden="true" />
        )}
      </div>
      <div className="clip-detail">
        <div className="clip-heading">
          <h2>{candidate.title}</h2>
          <span>{formatScore(candidate.score)}</span>
        </div>
        <p className="clip-time">
          {formatTimeRange(candidate.startMs, candidate.endMs)}
        </p>
        {candidate.snippet.trim() ? (
          <p className="clip-snippet">{candidate.snippet}</p>
        ) : null}
        <div className="clip-actions">
          {previewUrl ? (
            <button
              className="clip-preview-button"
              data-preview-url={previewUrl}
              onClick={() => setIsPreviewing(true)}
              type="button"
            >
              {isPreviewing ? "Restart preview" : "Play preview"}
            </button>
          ) : null}
          <button
            className={
              selected ? "clip-button clip-button-active" : "clip-button"
            }
            onClick={() => {
              if (selected) {
                onDeselect(candidate.id);
                return;
              }

              onSelect(candidate);
            }}
            type="button"
          >
            {selected ? "Deselect" : "Select"}
          </button>
        </div>
      </div>
    </article>
  );
}

function SelectedClipsPanel({
  onDeselect,
  selectedClips
}: {
  onDeselect: (clipId: string) => void;
  selectedClips: SelectedClip[];
}) {
  return (
    <aside className="selected-panel" aria-label="Selected clips">
      <div className="selected-panel-header">
        <h2>Selected clips</h2>
        <span>{selectedClips.length}</span>
      </div>

      {selectedClips.length === 0 ? (
        <p className="selected-empty">No clips selected.</p>
      ) : (
        <ul className="selected-list">
          {selectedClips.map((clip) => (
            <li className="selected-item" key={clip.id}>
              {clip.thumbnailUrl ? <img alt="" src={clip.thumbnailUrl} /> : null}
              <div>
                <strong>{clip.title}</strong>
                <span>{formatTimeRange(clip.startMs, clip.endMs)}</span>
              </div>
              <button onClick={() => onDeselect(clip.id)} type="button">
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}

function SetupScreen({ status }: { status: DevassetStatus }) {
  return (
    <main className="setup-shell">
      <section className="setup-panel" aria-live="polite">
        <p className="eyebrow">Local setup</p>
        <h1>Setting things up</h1>
        <p className="summary">{status.message}</p>
        <div className="setup-progress" aria-hidden="true">
          <span />
        </div>
      </section>
    </main>
  );
}

function SetupError({ status }: { status: DevassetStatus }) {
  return (
    <main className="setup-shell">
      <section className="setup-panel setup-panel-error" role="alert">
        <p className="eyebrow">Local setup</p>
        <h1>Setup needs attention</h1>
        <p className="summary">{status.message}</p>
      </section>
    </main>
  );
}

function useSessionSelectedClips(): [
  SelectedClip[],
  Dispatch<SetStateAction<SelectedClip[]>>
] {
  const [selectedClips, setSelectedClips] = useState<SelectedClip[]>(() => {
    if (typeof window === "undefined") {
      return [];
    }

    return parseSelectedClips(
      window.sessionStorage.getItem(selectedClipsStorageKey)
    );
  });

  useEffect(() => {
    window.sessionStorage.setItem(
      selectedClipsStorageKey,
      serializeSelectedClips(selectedClips)
    );
  }, [selectedClips]);

  return [selectedClips, setSelectedClips];
}

function useDevassetStatus(): DevassetStatus {
  const [status, setStatus] = useState<DevassetStatus>(initialStatus);

  useEffect(() => {
    let cancelled = false;

    async function loadStatus() {
      try {
        const response = await fetch("/api/devassets/status", {
          cache: "no-store"
        });

        if (!response.ok) {
          throw new Error(`API returned HTTP ${response.status}`);
        }

        const nextStatus = (await response.json()) as DevassetStatus;
        if (!cancelled) {
          setStatus(nextStatus);
        }
      } catch {
        if (!cancelled) {
          setStatus({
            state: "running",
            ready: false,
            message: "Waiting for the API readiness endpoint."
          });
        }
      }
    }

    void loadStatus();
    const interval = window.setInterval(loadStatus, setupPollMs);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  return status;
}
