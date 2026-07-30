# ADR 0002: Local Traefik Routing

## Status

Accepted.

## Context

The prototype has multiple HTTP services: the React webapp, the TypeScript API,
and the Go render service. Exposing each service on a different localhost port is
fine for a skeleton, but it makes the local demo URLs drift from the product
shape and creates avoidable port coordination as more services are added.

For local development, we want a single public HTTP port and predictable hostnames:

- Webapp: `http://videoai.localhost:8080`
- Other HTTP services: `http://<service>.videoai.localhost:8080`

PostgreSQL is not an HTTP service and should remain reachable through its normal
database port for local tooling.

## Decision

Add Traefik to `compose.yaml` as the local HTTP reverse proxy.

Traefik will listen on host port `8080` and route by hostname:

| Host | Target service |
| --- | --- |
| `videoai.localhost` | `webapp:5173` |
| `api.videoai.localhost` | `api:8080` |
| `render.videoai.localhost` | `render:8081` |

Use Traefik's file provider with a tracked `traefik/dynamic.yaml` route table
instead of discovering routes from Podman labels. This keeps the prototype
independent of a rootless Podman API socket and makes the local routing contract
visible in source control.

The app services expose their HTTP ports only inside the compose network.
Traefik is the only host-published HTTP entrypoint. PostgreSQL remains published
on `localhost:5432`.

## Consequences

Local demo URLs now match the intended service boundary:

```bash
curl http://api.videoai.localhost:8080/health
curl http://render.videoai.localhost:8080/health
```

Adding a new HTTP service requires adding a compose service and a route in
`traefik/dynamic.yaml`.

The file-provider approach is less automatic than label-based discovery, but it
is simpler and more reliable for this prototype. If the service graph grows
substantially, we can revisit Podman socket-backed discovery later.
