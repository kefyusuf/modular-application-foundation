# CI/CD Standard

## Purpose

Define a language-neutral CI/CD pipeline for validating architecture, security, contracts, and deployability.

## Baseline Rules

- CI must fail on broken formatting, lint, static analysis, tests, and architecture boundary violations.
- CI must fail on breaking contract changes unless the change is explicitly versioned.
- Security checks must include secrets, dependencies, SAST where practical, container images when containers exist, and license risk.
- Database changes must include migration checks or dry-runs where the stack supports them.
- Build artifacts must be reproducible enough for review and release.
- Release promotion must require explicit approval for production.
- CI output must produce reviewable artifacts, not only pass/fail status.

## Pipeline Stages

```txt
1. dependency install
2. lint
3. static analysis
4. architecture tests
5. unit tests
6. integration tests
7. contract tests
8. security scan
9. dependency scan
10. secret scan
11. build artifact/container
12. migration dry-run
13. smoke test
14. staging deploy
15. e2e test
16. production approval
```

## Contract Checks

- OpenAPI diff;
- AsyncAPI diff;
- protobuf compatibility;
- GraphQL schema compatibility;
- JSON Schema validation.

## Security Checks

- secret scanning;
- dependency vulnerability scanning;
- SAST;
- container image scanning;
- license checks;
- SBOM generation.

## Common Mistakes

- Running unit tests but skipping architecture and contract checks.
- Allowing generated artifacts or local agent state into commits.
- Treating dependency scanning as optional because the project is documentation-first.
- Running security checks only after release preparation.
- Building containers without scanning them.
- Letting migration checks happen manually and inconsistently.
- Producing CI logs that cannot identify the failing gate clearly.

## Verification Checklist

- [ ] Does CI fail on architecture violations?
- [ ] Does CI fail on breaking contract changes?
- [ ] Does CI run security checks?
- [ ] Does CI produce reviewable artifacts?
