# ADR-0002: Use OpenAPI, AsyncAPI, and CloudEvents-style Event Envelopes

## Status

Accepted

## Context

The foundation needs machine-readable contracts for HTTP APIs and message-driven interactions.

## Decision

Use OpenAPI for REST contracts, AsyncAPI for message-driven contracts, and CloudEvents-style envelopes for integration event metadata.

## Consequences

### Positive

- Contracts become reviewable.
- Code generation and contract testing become possible.
- Events become easier to route, trace, and document.

### Negative

- Requires schema governance.
- Breaking changes must be managed explicitly.

## Alternatives Considered

- Markdown-only API docs: rejected because not machine-readable.
- Custom event envelope only: rejected because standard metadata is useful.

## Review Date

2026-10-01
