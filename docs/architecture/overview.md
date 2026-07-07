# Architecture Overview

## Purpose

This document explains the foundation architecture at a high level.

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
