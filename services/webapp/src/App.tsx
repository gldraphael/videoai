import {
  AssistantRuntimeProvider,
  useLocalRuntime
} from "@assistant-ui/react";
import { MinusIcon, PlusIcon, Trash2Icon, XIcon } from "lucide-react";
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
  appendOutputResultGroup,
  appModeForDevassetStatus,
  createClipChatAdapter,
  excludeOutputClip,
  formatScore,
  formatTimeRange,
  includeOutputClip,
  outputWorkspaceStorageKey,
  removeOutputClip,
  removeOutputGroup,
  restoreOutputWorkspaceState,
  selectedClipsStorageKey,
  serializeOutputWorkspaceState,
  type DevassetStatus,
  type IncludedClip,
  type OutputClip,
  type OutputResultGroup,
  type OutputWorkspaceState
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
  const [workspace, setWorkspace] = useSessionOutputWorkspace();
  const includedIds = useMemo(
    () => new Set(workspace.includedClips.map((clip) => clip.id)),
    [workspace.includedClips]
  );

  const handleOutputGroup = useCallback(
    (group: OutputResultGroup) => {
      setWorkspace((current) => appendOutputResultGroup(current, group));
    },
    [setWorkspace]
  );

  const adapter = useMemo(
    () => createClipChatAdapter({ onOutputGroup: handleOutputGroup }),
    [handleOutputGroup]
  );
  const runtime = useLocalRuntime(adapter);

  const handleInclude = useCallback(
    (clip: OutputClip) => {
      setWorkspace((current) => includeOutputClip(current, clip));
    },
    [setWorkspace]
  );

  const handleExclude = useCallback(
    (clipId: string) => {
      setWorkspace((current) => excludeOutputClip(current, clipId));
    },
    [setWorkspace]
  );

  const handleRemoveClip = useCallback(
    (groupId: string, clipId: string) => {
      setWorkspace((current) => removeOutputClip(current, groupId, clipId));
    },
    [setWorkspace]
  );

  const handleRemoveGroup = useCallback(
    (groupId: string) => {
      setWorkspace((current) => removeOutputGroup(current, groupId));
    },
    [setWorkspace]
  );

  return (
    <main className="chat-shell">
      <section className="assistant-surface" aria-label="VideoAI assistant">
        <AssistantRuntimeProvider runtime={runtime}>
          <Thread />
        </AssistantRuntimeProvider>
      </section>

      <OutputWorkspacePane
        includedIds={includedIds}
        onExclude={handleExclude}
        onInclude={handleInclude}
        onRemoveClip={handleRemoveClip}
        onRemoveGroup={handleRemoveGroup}
        workspace={workspace}
      />
    </main>
  );
}

export function OutputWorkspacePane({
  includedIds,
  onExclude,
  onInclude,
  onRemoveClip,
  onRemoveGroup,
  workspace
}: {
  includedIds: Set<string>;
  onExclude: (clipId: string) => void;
  onInclude: (clip: OutputClip) => void;
  onRemoveClip: (groupId: string, clipId: string) => void;
  onRemoveGroup: (groupId: string) => void;
  workspace: OutputWorkspaceState;
}) {
  const totalClips = workspace.groups.reduce(
    (total, group) => total + group.clips.length,
    0
  );

  return (
    <aside className="output-workspace" aria-label="Output workspace">
      <IncludedContext
        includedClips={workspace.includedClips}
        onExclude={onExclude}
      />

      <section className="output-results" aria-label="Clip outputs">
        <div className="output-pane-header">
          <div>
            <h2>Output workspace</h2>
            <p>{pluralize(totalClips, "clip")} across this session</p>
          </div>
          <span>{workspace.groups.length}</span>
        </div>

        {workspace.groups.length === 0 ? (
          <p className="output-empty">No clip outputs yet.</p>
        ) : (
          <div className="output-group-list">
            {workspace.groups.map((group) => (
              <OutputResultGroupCard
                group={group}
                includedIds={includedIds}
                key={group.id}
                onExclude={onExclude}
                onInclude={onInclude}
                onRemoveClip={onRemoveClip}
                onRemoveGroup={onRemoveGroup}
              />
            ))}
          </div>
        )}
      </section>
    </aside>
  );
}

function IncludedContext({
  includedClips,
  onExclude
}: {
  includedClips: IncludedClip[];
  onExclude: (clipId: string) => void;
}) {
  return (
    <section className="included-context" aria-label="Included context">
      <div className="output-pane-header">
        <div>
          <h2>Included context</h2>
          <p>Carried into your next request</p>
        </div>
        <span>{includedClips.length}</span>
      </div>

      {includedClips.length === 0 ? (
        <p className="output-empty">No clips included.</p>
      ) : (
        <ul className="included-list">
          {includedClips.map((clip) => (
            <li className="included-item" key={clip.id}>
              <div className="included-thumb">
                {clip.thumbnailUrl ? (
                  <img alt="" src={clip.thumbnailUrl} />
                ) : (
                  <span>No thumbnail</span>
                )}
              </div>
              <div>
                <strong>{clip.title}</strong>
                <span>{formatTimeRange(clip.startMs, clip.endMs)}</span>
              </div>
              <button
                aria-label={`Exclude ${clip.title}`}
                className="icon-button"
                onClick={() => onExclude(clip.id)}
                type="button"
              >
                <XIcon aria-hidden="true" size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function OutputResultGroupCard({
  group,
  includedIds,
  onExclude,
  onInclude,
  onRemoveClip,
  onRemoveGroup
}: {
  group: OutputResultGroup;
  includedIds: Set<string>;
  onExclude: (clipId: string) => void;
  onInclude: (clip: OutputClip) => void;
  onRemoveClip: (groupId: string, clipId: string) => void;
  onRemoveGroup: (groupId: string) => void;
}) {
  const label = group.query.trim() || "Clip request";

  return (
    <section className="output-group" aria-label={`Results for ${label}`}>
      <div className="output-group-header">
        <div>
          <h3>{label}</h3>
          <span>{pluralize(group.clips.length, "clip")}</span>
        </div>
        <button
          aria-label={`Remove result group for ${label}`}
          className="icon-button"
          onClick={() => onRemoveGroup(group.id)}
          type="button"
        >
          <Trash2Icon aria-hidden="true" size={16} />
        </button>
      </div>

      <div className="output-clip-list">
        {group.clips.map((clip) => (
          <OutputClipCard
            clip={clip}
            groupId={group.id}
            included={includedIds.has(clip.id)}
            key={clip.id}
            onExclude={onExclude}
            onInclude={onInclude}
            onRemoveClip={onRemoveClip}
          />
        ))}
      </div>
    </section>
  );
}

function OutputClipCard({
  clip,
  groupId,
  included,
  onExclude,
  onInclude,
  onRemoveClip
}: {
  clip: OutputClip;
  groupId: string;
  included: boolean;
  onExclude: (clipId: string) => void;
  onInclude: (clip: OutputClip) => void;
  onRemoveClip: (groupId: string, clipId: string) => void;
}) {
  return (
    <article className="output-clip-card">
      <div className="output-clip-media">
        {clip.thumbnailUrl ? (
          <img alt="" src={clip.thumbnailUrl} />
        ) : (
          <span>No thumbnail</span>
        )}
      </div>
      <div className="output-clip-detail">
        <div className="output-clip-heading">
          <h4>{clip.title}</h4>
          <span>{formatScore(clip.score)}</span>
        </div>
        <p className="output-clip-time">
          {formatTimeRange(clip.startMs, clip.endMs)}
        </p>
        {clip.snippet.trim() ? (
          <p className="output-clip-snippet">{clip.snippet}</p>
        ) : null}
        <div className="output-clip-actions">
          <button
            className={included ? "output-action included" : "output-action"}
            onClick={() => {
              if (included) {
                onExclude(clip.id);
                return;
              }

              onInclude(clip);
            }}
            type="button"
          >
            {included ? (
              <MinusIcon aria-hidden="true" size={15} />
            ) : (
              <PlusIcon aria-hidden="true" size={15} />
            )}
            {included ? "Exclude" : "Include"}
          </button>
          <button
            aria-label={`Remove ${clip.title} from output workspace`}
            className="icon-button"
            onClick={() => onRemoveClip(groupId, clip.id)}
            type="button"
          >
            <Trash2Icon aria-hidden="true" size={16} />
          </button>
        </div>
      </div>
    </article>
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

function useSessionOutputWorkspace(): [
  OutputWorkspaceState,
  Dispatch<SetStateAction<OutputWorkspaceState>>
] {
  const [workspace, setWorkspace] = useState<OutputWorkspaceState>(() => {
    if (typeof window === "undefined") {
      return restoreOutputWorkspaceState(null, null);
    }

    return restoreOutputWorkspaceState(
      window.sessionStorage.getItem(outputWorkspaceStorageKey),
      window.sessionStorage.getItem(selectedClipsStorageKey)
    );
  });

  useEffect(() => {
    window.sessionStorage.setItem(
      outputWorkspaceStorageKey,
      serializeOutputWorkspaceState(workspace)
    );
  }, [workspace]);

  return [workspace, setWorkspace];
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

function pluralize(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}
