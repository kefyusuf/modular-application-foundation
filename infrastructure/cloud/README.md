# Cloud Guidance

## Purpose

Define cloud deployment guidance that keeps provider services behind adapter contracts.

Cloud platforms provide managed infrastructure. They should not dictate domain boundaries, public contracts, event naming, authorization rules, or persistence ownership.

## Baseline Rules

- Cloud services must be accessed through ports and adapters.
- Provider SDKs must not leak into domain code.
- Managed databases, queues, caches, storage, and observability services must preserve module ownership rules.
- Secrets must be managed through a secret manager or runtime injection mechanism.
- IAM permissions should follow least privilege.
- Region, availability, backup, restore, and disaster recovery choices must be explicit.
- Kubernetes, serverless, and managed container platforms are deployment options, not architectural requirements.

## Capability Mapping

| Capability | Cloud Option Examples | Boundary |
|---|---|---|
| relational database | managed PostgreSQL-compatible service | module-owned schema and migrations |
| cache and lock | managed Redis-compatible service | cache, rate limit, lock, session adapter |
| queue and event bus | managed queue, pub/sub, or event bus | outbox/inbox and event contracts still apply |
| object storage | S3-compatible or provider-native object storage | file storage port |
| secrets | provider secret manager | runtime injection only |
| observability | logs, metrics, traces, managed collectors | OpenTelemetry-compatible context where practical |
| gateway | load balancer, API gateway, ingress | edge transport concerns only |

## Deployment Options

Valid deployment choices include:

```txt
single VM or app service
managed container service
serverless functions
Kubernetes
hybrid deployment
```

Choose based on operational needs. Do not choose Kubernetes by default for an educational or early product foundation.

## Environment Guidance

Each environment should define:

- provider and region;
- network boundary;
- database and migration strategy;
- queue and retry strategy;
- object storage bucket or container policy;
- secret source;
- observability destination;
- backup and restore expectation;
- promotion approval path.

## Portability Guidance

Portability does not mean avoiding all managed services. It means:

- provider details stay in adapters;
- public contracts remain stable;
- module manifests describe capabilities, not provider SDK classes;
- tests can use fakes, emulators, or contract-compatible local services;
- failure modes are documented per adapter.

## Common Mistakes

- Designing the domain around a provider SDK.
- Treating serverless function boundaries as domain module boundaries.
- Giving broad IAM permissions to application runtime identities.
- Skipping backup and restore proof because managed services are used.
- Making cloud topology the only architecture documentation.
- Assuming managed queues remove the need for idempotent consumers.

## Verification Checklist

- [ ] Are provider SDKs isolated in infrastructure adapters?
- [ ] Are secrets injected at runtime and excluded from commits?
- [ ] Are IAM permissions least-privilege?
- [ ] Are backup and restore expectations documented?
- [ ] Are queue consumers idempotent despite managed infrastructure?
- [ ] Can the architecture be explained without provider-specific diagrams?
