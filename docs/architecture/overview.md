# Architecture Overview

## Purpose

This document explains the foundation architecture at a high level.

It should help readers understand how the repository's architecture choices fit together before they study individual standards, contracts, modules, or examples.

## Architecture Model

```txt
Contract-First Modular Monolith
+ Feature Slice
+ Hexagonal Architecture
+ DDD Tactical Patterns
+ Event-Driven Integration
+ Optional Event Sourcing
```

## System View

```txt
Clients
  -> API Interfaces
    -> Application Kernel
      -> Modules
        -> Infrastructure Adapters
```

## Key Rule

A module must never access another module's private internals.

This rule is more important than the folder layout. A project can look modular while still being tightly coupled if modules import each other's entities, repositories, database tables, or infrastructure adapters.

## When to Use

Use this architecture when:

- the product needs strong boundaries without distributed-system overhead;
- teams want a framework-neutral foundation before choosing adapters;
- API, event, and module contracts should be reviewed before implementation;
- future microservice extraction is possible but not yet proven;
- security, observability, idempotency, and testing rules must be part of the baseline.

## When Not to Use

Do not use this architecture as-is when:

- the goal is a small throwaway prototype;
- each capability already requires independent deployment and scaling;
- the organization cannot enforce module boundaries with review and tests;
- the team wants a framework tutorial instead of an architecture standard;
- the product needs a packaged UI component library rather than backend architecture guidance.

## Communication Methods

Allowed communication:

- public contracts;
- capability ports;
- command/query contracts;
- integration events;
- read-model projections;
- policy engine decisions;
- saga/process manager coordination.

Forbidden communication:

- direct repository calls across modules;
- direct entity imports across modules;
- direct queries to another module's private tables;
- direct use of another module's infrastructure adapter.

## Why This Architecture Works

It keeps the system deployable as one application while preserving modular boundaries strong enough to support future extraction.

## Trade-offs

- It reduces runtime and operational complexity compared with microservices, but it requires stronger internal discipline.
- It gives teams a shared architecture language, but every document must stay concrete enough to avoid becoming slogans.
- It supports future extraction, but extraction is a later option, not the default delivery model.
- It avoids framework lock-in in the core, but framework adapters still need careful mapping.
- It makes contracts reviewable early, but contract changes require versioning and compatibility rules.

## Common Mistakes

- Treating modular monolith as folders only.
- Letting controllers call repositories directly.
- Using events for everything.
- Using event sourcing for simple CRUD.
- Treating RBAC as hardcoded role checks.
- Adding Kafka before defining event contracts.
- Adding GraphQL before modeling API ownership.

## Verification Checklist

- [ ] Does each module declare ownership?
- [ ] Are public contracts separated from private internals?
- [ ] Are events versioned?
- [ ] Are API errors standardized?
- [ ] Are security controls documented?
- [ ] Are infrastructure technologies hidden behind ports/adapters?
- [ ] Are microservices described as future extraction rather than the default?
- [ ] Can the architecture be explained without naming a specific framework?
