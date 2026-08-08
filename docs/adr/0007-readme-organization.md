# ADR 0007: README Organization

## Status

Accepted.

Records documentation organization decisions made during OpenSpec change
`high-level-readme`.

## Context

The root README had grown into a mixed project overview, quick start, local
runtime guide, API reference, media route contract, chat flow note, clip search
description, and seed implementation document. That made it useful as a
historical implementation log, but harder to use as the project home page.

The local prototype now has several documentation surfaces:

- root `README.md`
- service-owned README files such as `services/api/README.md`
- domain folders such as `devassets/` and `var/`
- ADRs for durable architectural decisions
- OpenSpec changes for planned work and task tracking

The project needed a clear rule for what belongs in the root README versus
what should move into more specific documentation.

## Decision

Use the root `README.md` as the project home page for running, configuring, and
understanding the local prototype.

The root README should be organized around four primary sections, in this
order:

```text
1. Quick start
2. Configuration
3. System architecture
4. How it works
```

The quick start must keep the local startup command and primary app URL easy to
find:

```bash
podman compose up --build
```

```text
http://videoai.localhost:8080
```

The configuration section should document `devassets/catalog.yaml` directly in
the root README because the catalog is the main whole-system configuration
surface for the local prototype. It should include a compact YAML example,
supported fields, important validation rules, and how catalog changes feed the
seed flow.

The architecture section should stay high-level and Markdown-native. It should
show the browser, Traefik, webapp, API, seed service, render service,
generated local data, and any explicitly deferred storage decisions without
becoming a detailed sequence diagram or service contract.

The "How it works" section should explain the system in plain language for a
new or lightly technical reader. It should describe how the seed service hides
media download, metadata probing, audio extraction, transcription, thumbnail
generation, and local library preparation.

Move detailed route contracts, large JSON examples, and service-specific
development commands out of the root README when they are still worth
preserving. Put them in the owning service's README. For this change, API route
details moved to `services/api/README.md`.

Keep domain folder READMEs supplemental:

- `devassets/README.md` should point to the root catalog overview and document
  directory conventions that are specific to `devassets/`.
- `var/README.md` owns generated runtime layout details.

Do not create `tools/seed/README.md` solely to document `devassets/catalog.yaml`.
Catalog configuration belongs in the root README because changing the catalog
changes how the whole local prototype starts and behaves.

## Alternatives Considered

### Keep the root README exhaustive

Keeping every API route, response shape, media-serving rule, and seed detail in
the root README preserves one-file discoverability, but it makes the first-run
path harder to scan and turns the project home page into an implementation
reference.

### Make the root README only a quick start

A very short root README is easy to scan, but it hides the catalog. That is a
poor fit for this prototype because `devassets/catalog.yaml` is the main local
configuration surface developers are expected to edit.

### Put catalog documentation only under `devassets/` or `tools/seed/`

This would make ownership tidy for maintainers, but it would force new readers
to discover service or folder internals before they understand how to customize
the local prototype.

### Create README files for every service

Creating README files for all services would be mechanically consistent, but it
adds documentation surfaces before there is useful service-specific material to
preserve. Service READMEs should be added when they own real reference content.

## Consequences

The root README is optimized for onboarding. A new reader can find the startup
command, the app URL, and catalog configuration without scanning API or seed
implementation details.

Deep implementation details are still preserved, but they move closer to their
owner. This reduces root README churn as API routes, media serving, or service
development commands change.

Catalog documentation has a deliberate primary home in the root README. The
cost is that `devassets/README.md` must stay supplemental so the same schema
rules do not drift in two places.

Future documentation changes should keep the root README high-level. If a new
section starts accumulating route contracts, large examples, or service
commands, that is a signal to move the detail into a service-owned README or an
ADR.

## Validation

The implemented change validated this organization by:

- checking README links and anchors
- confirming the documented commands match package scripts and compose service
  names
- confirming the root README section order
- confirming the startup command and catalog configuration are findable from
  the root README without reading service internals
