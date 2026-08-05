## Context

See `proposal.md` for motivation. The current root README contains useful information, but it mixes first-run guidance with detailed API contracts, media route mappings, phase notes, and seed workflow internals. The repo already has `devassets/catalog.yaml`, `compose.yaml`, service directories under `services/`, and an existing `devassets/README.md`.

## Goals / Non-Goals

**Goals:**

- Make the root README the project home page for running, configuring, and understanding the local prototype.
- Put `devassets/catalog.yaml` configuration in the root README because changing the catalog is a primary whole-system configuration task.
- Explain the system in plain language for readers who do not need service-level API detail.
- Keep commands Podman-first because local development is containerized with `compose.yaml`.

**Non-Goals:**

- Do not change compose configuration, ports, routes, package scripts, generated data paths, or service behavior.
- Do not create a dedicated seed README as the main catalog documentation surface.
- Do not keep long API response examples or route contracts in the root README.
- Do not rewrite broader ADRs or architecture docs as part of this change.

## Decisions

### Structure The Root README As A Home Page

The root README should have four main sections:

```text
1. Quick start
2. Configuration
3. System architecture
4. How it works
```

The quick start should make `podman compose up --build` and `http://videoai.localhost:8080` easy to find. The other sections should help a new reader understand what they are running and how to customize the local sample media.

Alternative considered: keep the root README to only a quick start and move all details elsewhere. That is fast to scan, but it hides `catalog.yaml`, which is one of the most important local configuration surfaces.

### Document Catalog Configuration In The Root README

The configuration section should describe `devassets/catalog.yaml` directly in the root README. It should include:

- A small catalog example.
- The role of asset `id`, `title`, `type`, and `source.url`.
- The important validation rules.
- A short explanation that changing catalog inputs causes the seed flow to prepare local generated assets.

Seed implementation details should be explained at the level a user needs to operate the system: the seed service downloads media, probes metadata, extracts/derives supporting files, and writes generated local data for the app. The root README does not need to expose every command or implementation detail unless it helps configuration.

Alternative considered: put catalog documentation only in `devassets/README.md` or `tools/seed/README.md`. That makes ownership tidy for maintainers, but it makes the project home page less useful for the most common local customization task.

### Keep Architecture High-Level

The architecture section should use a simple text diagram, not a detailed sequence diagram or exhaustive service spec. It should show the major pieces:

```text
Browser -> Traefik -> Webapp -> API
                         |       |
                         |       +-> generated devasset data
                         |       +-> PostgreSQL
                         |
Seed -> devassets/catalog.yaml -> generated local media/index files
Render service -> generated renders
```

The diagram can be adjusted for accuracy during implementation, but it should stay intentionally simple and readable in Markdown.

Alternative considered: generate a richer diagram in Mermaid or an image. Plain Markdown is easier to maintain and enough for this README.

### Explain The System In Friendly Language

The "How it works" section should be written for a non-technical or lightly technical reader. It should explain that:

- The catalog lists sample videos for local development.
- The seed service hides the tedious preparation work and turns the catalog into local media, thumbnails, transcripts, and metadata.
- The webapp gives the user a chat interface.
- The API connects the chat request to local clip search and serves generated media previews.
- The render service is the boundary for turning future edit plans into rendered videos.
- PostgreSQL and Traefik are supporting infrastructure for local development.

Alternative considered: describe the system by listing services and endpoints. That is precise, but it reads like an operator reference rather than a home page.

### Move Only Deep Details Out Of Root

Detailed API route contracts, large JSON examples, and service-specific development commands can move to service-owned README files if they are still worth preserving. The implementation does not need to create a service README for every service just to satisfy this change; it should create or update only the documentation needed to avoid losing useful details removed from the root README.

Alternative considered: always create `services/webapp/README.md`, `services/api/README.md`, `services/render/README.md`, and `tools/seed/README.md`. That creates more files, but the new direction favors a stronger root README and fewer docs surfaces unless a detail clearly needs a separate owner.

## Risks / Trade-offs

- Root README becomes too long again -> Keep root content high-level, use short examples, and move only deep API/service details out.
- Catalog docs drift between root and `devassets/README.md` -> Treat the root README as the primary catalog overview and make `devassets/README.md` supplemental or link back instead of duplicating full content.
- Seed abstraction is oversimplified -> Explain what seed produces without documenting every internal processing step.
- Details get lost while trimming route sections -> Preserve deep API contracts in service-owned docs only where they remain useful.
