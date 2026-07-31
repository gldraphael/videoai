import { useEffect, useState } from "react";

type DevassetStatus = {
  state: "missing" | "running" | "ready" | "error";
  ready: boolean;
  message: string;
  assetCount?: number;
  catalogIdentity?: string;
  updatedAt?: string;
};

const setupPollMs = 2500;
const initialStatus: DevassetStatus = {
  state: "missing",
  ready: false,
  message: "Checking local development assets."
};

const serviceChecks = [
  { label: "Web shell", value: "running" },
  { label: "API service", value: "health endpoint ready" },
  { label: "Render service", value: "health endpoint ready" },
  { label: "Devassets", value: "ready" }
];

export function App() {
  const status = useDevassetStatus();

  if (status.state === "error") {
    return <SetupError status={status} />;
  }

  if (!status.ready) {
    return <SetupScreen status={status} />;
  }

  return (
    <main className="app-shell">
      <section className="intro">
        <p className="eyebrow">VideoAI prototype</p>
        <h1>Local media library is ready</h1>
        <p className="summary">
          The local stack can now read generated media, thumbnails, and
          transcript references from the devasset seed output.
        </p>
      </section>

      <section className="status-grid" aria-label="Skeleton status">
        {serviceChecks.map((item) => (
          <article className="status-tile" key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </article>
        ))}
        <article className="status-tile">
          <span>Media assets</span>
          <strong>{status.assetCount ?? 0}</strong>
        </article>
      </section>
    </main>
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
