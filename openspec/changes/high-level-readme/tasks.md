## 1. Documentation Inventory

- [x] 1.1 Review the current root `README.md` and identify which details should remain in the four home-page sections versus move out as deep service reference.
- [x] 1.2 Verify the local startup command, primary app URL, and useful health/status URLs against `compose.yaml` and Traefik routing.
- [x] 1.3 Review `devassets/catalog.yaml` and `devassets/README.md` so the root configuration section documents the current catalog contract accurately.

## 2. Root README Home Page

- [x] 2.1 Rewrite the Quick start section with prerequisites, `podman compose up --build`, and `http://videoai.localhost:8080`.
- [x] 2.2 Add a Configuration section that documents `devassets/catalog.yaml`, including a compact YAML example, supported fields, key validation rules, and how catalog changes feed the seed flow.
- [x] 2.3 Add a System architecture section with a simple high-level Markdown diagram of the browser, Traefik, webapp, API, seed, render service, PostgreSQL, and generated local data.
- [x] 2.4 Add a How it works section written for a non-technical audience, including how the seed service abstracts media download, metadata probing, transcription, thumbnail generation, and local library preparation.

## 3. Detail Preservation

- [x] 3.1 Remove long phase-specific API/chat/search/seed details from the root README once the new high-level sections cover the user-facing story.
- [x] 3.2 Create or update service-owned README files only for deep API contracts, route examples, or service-specific development commands that should be preserved outside the root README.
- [x] 3.3 Update `devassets/README.md` only as needed so it complements the root catalog overview without duplicating the full configuration section.
- [x] 3.4 Do not create `tools/seed/README.md` solely to document `devassets/catalog.yaml`; catalog configuration belongs in the root README.

## 4. Verification

- [x] 4.1 Check all README links resolve to existing files or anchors.
- [x] 4.2 Confirm documented commands match existing package scripts and compose service names.
- [x] 4.3 Review the root README for the required section order: Quick start, Configuration, System architecture, How it works.
- [x] 4.4 Confirm a new reader can find both the startup command and catalog configuration without scanning service internals.
