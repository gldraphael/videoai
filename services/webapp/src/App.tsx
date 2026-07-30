const serviceChecks = [
  { label: "Web shell", value: "running" },
  { label: "API service", value: "health endpoint ready" },
  { label: "Render service", value: "health endpoint ready" },
  { label: "Devassets", value: "catalog-driven" }
];

export function App() {
  return (
    <main className="app-shell">
      <section className="intro">
        <p className="eyebrow">VideoAI prototype</p>
        <h1>Repo skeleton is running</h1>
        <p className="summary">
          This Phase 0 shell verifies that the web service can run inside the
          local Podman development stack before chat, seeding, and rendering are
          implemented.
        </p>
      </section>

      <section className="status-grid" aria-label="Skeleton status">
        {serviceChecks.map((item) => (
          <article className="status-tile" key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </article>
        ))}
      </section>
    </main>
  );
}
