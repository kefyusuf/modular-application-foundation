# Modular Monolith

## Purpose

A modular monolith is a single deployable application with strong internal module boundaries.

The goal is to keep operational simplicity while preventing the codebase from becoming one large shared model.

## When to Use

Use this when:

- the domain is still evolving;
- one team owns the product;
- operational simplicity matters;
- microservice boundaries are not yet proven;
- transaction consistency is important;
- you want future extraction without early distribution.

## When Not to Use

Avoid this as the final shape when:

- teams require independent deploy cadence;
- modules have radically different scaling needs;
- regulatory boundaries require isolation;
- data ownership must be physically separated;
- release blast radius must be isolated per module.

## Design Rules

- One deployable application.
- Multiple isolated modules.
- Each module owns its model and persistence.
- Cross-module communication uses contracts/events/ports.
- Infrastructure is adapter-based.
- Extraction readiness is a benefit, not the first goal.

## Trade-offs

- Deployment is simpler than microservices, but module boundaries must be enforced inside one process.
- Local transactions are easier, but cross-module writes still need clear ownership rules.
- Refactoring is faster before extraction, but careless shared code can create hidden coupling.
- Teams can delay infrastructure complexity, but they must still design public contracts early.
- Observability is simpler at runtime, but module-level logs, traces, and metrics still matter.

## Common Mistakes

- Treating modules as folders while sharing the same entities everywhere.
- Letting controllers or jobs call another module's repositories directly.
- Using a shared database schema as the real integration layer.
- Adding a message broker before defining stable integration events.
- Extracting a module because it is large, not because its boundary is stable.
- Claiming microservice readiness without owned data, contracts, and observability.

## Microservice Extraction Rule

A module can be extracted only if:

- it already has stable public contracts;
- it does not depend on private internals;
- it owns its data lifecycle;
- it has integration events;
- it has observable boundaries;
- it can be deployed independently without breaking consistency.

## Verification Checklist

- [ ] Can the system run as one app?
- [ ] Can modules be reasoned about independently?
- [ ] Are module dependencies explicit?
- [ ] Are integration points contract-first?
- [ ] Does each module own its private model and persistence rules?
- [ ] Is microservice extraction treated as optional future work?
