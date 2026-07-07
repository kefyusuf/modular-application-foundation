# CI/CD Standard

## Purpose

Define a language-neutral CI/CD pipeline for validating architecture, security, contracts, and deployability.

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

## Verification Checklist

- [ ] Does CI fail on architecture violations?
- [ ] Does CI fail on breaking contract changes?
- [ ] Does CI run security checks?
- [ ] Does CI produce reviewable artifacts?
