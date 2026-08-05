## Why

The root README has grown into a mixed quick-start, architecture, API, media, and phase-notes document. It should instead work as the project home page: enough to run the prototype, configure the sample media catalog, and understand the system at a high level without reading service internals first.

## What Changes

- Rewrite the top-level `README.md` around four primary sections:
  - Quick start: prerequisites, `podman compose up --build`, and the app URL to open.
  - Configuration: how `devassets/catalog.yaml` controls local sample media, with a small example and the important catalog rules.
  - System architecture: a simple high-level diagram showing browser, Traefik, webapp, API, seed, render, PostgreSQL, and generated local data.
  - How it works: a non-technical explanation of how the services fit together, including how the seed service hides download/probing/transcription/thumbnail complexity.
- Keep detailed API route contracts, response examples, and service-specific development commands out of the root README unless they are needed for the high-level story.
- Do not make a dedicated seed-service README the primary home for devasset catalog documentation; the catalog belongs in the root README because it is part of configuring the whole local prototype.
- Preserve useful details from the current root README by either keeping a concise version in the new root sections or moving deep route/service details to service-owned docs only where helpful.

## Capabilities

### New Capabilities

None. This is a documentation organization change.

### Modified Capabilities

None. This change does not modify application behavior or accepted spec requirements.

## Impact

- Affects repository documentation only.
- Expected files include `README.md` and possibly service-level README files for details that no longer belong in the root README.
- No runtime APIs, compose services, dependencies, generated assets, or product behavior should change.
