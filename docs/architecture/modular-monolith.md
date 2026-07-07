# Modular Monolith

## Purpose

A modular monolith is a single deployable application with strong internal module boundaries.

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
