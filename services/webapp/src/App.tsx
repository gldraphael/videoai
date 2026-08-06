import {
  AssistantRuntimeProvider,
  MessagePartPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
  useAui,
  useAuiState,
  useLocalRuntime,
  type MessageState,
  type TextMessagePartProps
} from "@assistant-ui/react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type Dispatch,
  type FormEvent,
  type KeyboardEvent,
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
      <section className="assistant-surface" aria-label="VideoAI assistant">
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
                <div className="thread-empty">
                  Ask for launch moments, reactions, product shots, or other
                  local clips.
                </div>
              </ThreadPrimitive.Empty>
              <ThreadPrimitive.ViewportFooter>
                <LocalComposer />
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

function LocalComposer() {
  const aui = useAui();
  const committedText = useAuiState((state) => state.composer.text);
  const isInputDisabled = useAuiState(
    (state) =>
      state.thread.isDisabled || Boolean(state.composer.dictation?.inputDisabled)
  );
  const isSendBlocked = useAuiState(
    (state) => state.thread.isRunning && !state.thread.capabilities.queue
  );
  const [draft, setDraft] = useState("");
  const canSend = draft.trim().length > 0 && !isInputDisabled && !isSendBlocked;

  useEffect(() => {
    if (committedText === "") {
      setDraft("");
    }
  }, [committedText]);

  const commitAndSend = useCallback(() => {
    if (!canSend) {
      return;
    }

    aui.composer.setText(draft);
    aui.composer.send();
    setDraft("");
  }, [aui, canSend, draft]);

  const handleSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      commitAndSend();
    },
    [commitAndSend]
  );

  const handleChange = useCallback((event: ChangeEvent<HTMLTextAreaElement>) => {
    setDraft(event.target.value);
  }, []);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.nativeEvent.isComposing) {
        return;
      }

      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        commitAndSend();
      }
    },
    [commitAndSend]
  );

  return (
    <form className="composer" onSubmit={handleSubmit}>
      <textarea
        className="composer-input"
        disabled={isInputDisabled}
        name="input"
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder="Search for launch moments, reactions, product shots..."
        rows={2}
        value={draft}
      />
      <button className="composer-send" disabled={!canSend} type="submit">
        Send
      </button>
    </form>
  );
}

export function ChatMessage({
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
    <MessagePrimitive.Root
      className={`chat-message chat-message-${message.role}`}
    >
      <div className="message-label">{label}</div>
      <div className="message-body">
        <MessagePrimitive.Parts>
          {({ part }) => {
            if (part.type === "text") {
              return <MessageTextPart {...part} />;
            }

            if (part.type === "data" && part.name === "clip-candidates") {
              return (
                <ClipCandidatesDataPart
                  data={part.data}
                  onDeselect={onDeselect}
                  onSelect={onSelect}
                  selectedIds={selectedIds}
                />
              );
            }

            return null;
          }}
        </MessagePrimitive.Parts>
      </div>
    </MessagePrimitive.Root>
  );
}

function MessageTextPart({ status, text }: TextMessagePartProps) {
  const isRunningEmpty = status?.type === "running" && text.length === 0;

  return (
    <p className="message-text">
      <MessagePartPrimitive.Text />
      <MessagePartPrimitive.InProgress>
        {isRunningEmpty ? (
          "Searching local clips..."
        ) : (
          <span className="message-running-dot" aria-label="Assistant running" />
        )}
      </MessagePartPrimitive.InProgress>
    </p>
  );
}

function ClipCandidatesDataPart({
  data,
  onDeselect,
  onSelect,
  selectedIds
}: {
  data: unknown;
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
