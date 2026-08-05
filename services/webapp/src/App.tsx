import {
  AssistantRuntimeProvider,
  ComposerPrimitive,
  ThreadPrimitive,
  useLocalRuntime,
  type MessageState
} from "@assistant-ui/react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction
} from "react";
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
  type ChatNotice,
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

  return <ChatExperience status={status} />;
}

function ChatExperience({ status }: { status: DevassetStatus }) {
  const [notice, setNotice] = useState<ChatNotice | null>(null);
  const [selectedClips, setSelectedClips] = useSessionSelectedClips();
  const selectedIds = useMemo(
    () => new Set(selectedClips.map((clip) => clip.id)),
    [selectedClips]
  );
  const adapter = useMemo(
    () =>
      createClipChatAdapter({
        onNotice: setNotice
      }),
    []
  );
  const runtime = useLocalRuntime(adapter);

  const handleSelect = useCallback((candidate: ClipCandidate) => {
    setSelectedClips((current) => selectClip(current, candidate));
  }, [setSelectedClips]);

  const handleDeselect = useCallback((clipId: string) => {
    setSelectedClips((current) => deselectClip(current, clipId));
  }, [setSelectedClips]);

  return (
    <main className="chat-shell">
      <section className="workspace">
        <header className="workspace-header">
          <div>
            <p className="eyebrow">VideoAI prototype</p>
            <h1>Local clip search</h1>
          </div>
          <div className="workspace-meta" aria-label="Devasset status">
            <span>{status.assetCount ?? 0} assets</span>
            <span>Phase 3 local search only</span>
          </div>
        </header>

        {notice ? <ChatNoticeBanner notice={notice} /> : null}

        <AssistantRuntimeProvider runtime={runtime}>
          <ThreadPrimitive.Root className="thread-root">
            <ThreadPrimitive.Viewport className="thread-viewport">
              <ThreadPrimitive.Messages>
                {({ message }) => (
                  <ChatMessage
                    message={message}
                    onDeselect={handleDeselect}
                    onSelect={handleSelect}
                    selectedIds={selectedIds}
                  />
                )}
              </ThreadPrimitive.Messages>
              <ThreadPrimitive.Empty>
                <div className="thread-empty">Local clips are ready.</div>
              </ThreadPrimitive.Empty>
              <ThreadPrimitive.ViewportFooter>
                <ComposerPrimitive.Root className="composer">
                  <ComposerPrimitive.Input
                    className="composer-input"
                    placeholder="Search for launch moments, reactions, product shots..."
                    rows={2}
                    submitMode="enter"
                  />
                  <ComposerPrimitive.Send className="composer-send">
                    Send
                  </ComposerPrimitive.Send>
                </ComposerPrimitive.Root>
              </ThreadPrimitive.ViewportFooter>
            </ThreadPrimitive.Viewport>
          </ThreadPrimitive.Root>
        </AssistantRuntimeProvider>
      </section>

      <SelectedClipsPanel
        onDeselect={handleDeselect}
        selectedClips={selectedClips}
      />
    </main>
  );
}

function ChatMessage({
  message,
  onDeselect,
  onSelect,
  selectedIds
}: {
  message: MessageState;
  onDeselect: (clipId: string) => void;
  onSelect: (candidate: ClipCandidate) => void;
  selectedIds: Set<string>;
}) {
  const label =
    message.role === "user"
      ? "You"
      : message.role === "assistant"
        ? "Assistant"
        : "System";

  return (
    <article className="chat-message">
      <div className="message-label">{label}</div>
      <div className="message-body">
        {message.content.length > 0 ? (
          message.content.map((part, index) => {
            if (part.type === "text") {
              return (
                <p className="message-text" key={index}>
                  {part.text}
                </p>
              );
            }

            if (
              part.type === "data" &&
              part.name === "clip-candidates" &&
              isClipCandidatesData(part.data)
            ) {
              return (
                <ClipCandidatesPart
                  data={part.data}
                  key={index}
                  onDeselect={onDeselect}
                  onSelect={onSelect}
                  selectedIds={selectedIds}
                />
              );
            }

            return null;
          })
        ) : message.role === "assistant" &&
          message.status?.type === "running" ? (
          <p className="message-text">Searching local clips...</p>
        ) : null}
      </div>
    </article>
  );
}

function isClipCandidatesData(value: unknown): value is ClipCandidatesData {
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
  const previewUrl = clipPreviewUrl(candidate);

  return (
    <article className="clip-card">
      <div className="clip-media">
        {previewUrl ? (
          <video
            controls
            poster={candidate.thumbnailUrl ?? undefined}
            preload="metadata"
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
        <button
          className={selected ? "clip-button clip-button-active" : "clip-button"}
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

function ChatNoticeBanner({ notice }: { notice: ChatNotice }) {
  return (
    <div
      className={notice.type === "error" ? "chat-notice error" : "chat-notice"}
      role={notice.type === "error" ? "alert" : "status"}
    >
      <strong>
        {notice.type === "devassets"
          ? `Devassets ${notice.devassets.state}`
          : "Chat unavailable"}
      </strong>
      <span>{notice.message}</span>
    </div>
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
