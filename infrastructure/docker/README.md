# Docker Guidance

## Purpose

Use Docker for repeatable local environments, integration dependencies, and packaging examples without making containers the architecture.

Docker should help teams run infrastructure adapters consistently. It must not force domain, application, or module design decisions.

## Baseline Rules

- Docker is optional for architecture and useful for local parity.
- Containers must not be required to understand the module boundary model.
- Application images should be reproducible and minimal enough for review.
- Dependency containers should represent adapter contracts, not hidden production assumptions.
- Secrets must be injected through the runtime environment, not committed into images or Compose files.
- Health checks should reflect readiness, not only process startup.
- Container image scanning is required when images are built for release.

## Local Dependency Set

Common local dependencies:

```txt
postgres
redis
queue or broker
object storage emulator
mail capture service
observability collector
```

These dependencies support integration testing and manual exploration. They do not define module ownership or public contracts.

## Image Guidance

Application images should:

- install only runtime dependencies;
- run as a non-root user where practical;
- expose a health endpoint or command;
- keep build and runtime layers separate;
- avoid embedding secrets, tokens, or local agent state;
- include enough metadata for traceability.

## Compose Guidance

Use Compose for local dependency orchestration when it improves developer workflow.

Compose files should:

- name dependencies by capability, not provider lock-in;
- define health checks for stateful services;
- keep volumes explicit;
- avoid production credentials;
- avoid encoding business rules;
- stay replaceable by another local runtime.

## Kubernetes Boundary

Kubernetes may be introduced when deployment scale, scheduling, ingress, secrets, and operational needs justify it.

Do not introduce Kubernetes only to prove the architecture. The architecture should remain valid without Kubernetes.

## Common Mistakes

- Treating a Compose topology as a production architecture diagram.
- Letting container startup order replace readiness checks.
- Baking `.env` values or secrets into images.
- Mounting source directories into production-like images.
- Using root containers by default without reason.
- Skipping image scans because containers are only examples.

## Verification Checklist

- [ ] Does Docker remain optional for understanding the architecture?
- [ ] Are secrets excluded from images and Compose files?
- [ ] Do dependency containers map to adapter capabilities?
- [ ] Are health checks meaningful?
- [ ] Are images scanned before release?
- [ ] Can the application design be explained without container topology?
