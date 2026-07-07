# CI Guidance

## Purpose

Describe the expected CI contract for implementation projects that consume this foundation.

The CI vendor is replaceable. The gate sequence and evidence are the important parts.

## Baseline Rules

- CI must fail on formatting, lint, static analysis, architecture boundary violations, test failures, broken contracts, and secret leaks.
- Architecture fitness functions should run before slower integration or E2E checks.
- Contract validation must include OpenAPI, AsyncAPI, JSON Schema, GraphQL, and protobuf where those contracts are present.
- Security checks must include secrets, dependencies, SAST where practical, and container image scans when containers exist.
- Documentation checks must catch broken local links and placeholder-only files.
- Release promotion must require explicit approval outside the normal branch validation path.

## Recommended Pipeline

```txt
1. dependency install
2. format and lint
3. static analysis
4. architecture fitness functions
5. unit tests
6. contract validation
7. integration tests
8. security and dependency scans
9. container build and image scan, if containers exist
10. migration dry-run, if migrations exist
11. documentation link and placeholder checks
12. build artifact publication
13. staging smoke test
14. production approval
```

## Vendor Mapping

| Vendor | Fit |
|---|---|
| GitHub Actions | repository-native workflows and pull request checks |
| GitLab CI | integrated pipeline, registry, and environment promotion |
| Jenkins | customizable enterprise pipeline orchestration |
| Bitbucket Pipelines | repository-hosted validation for Bitbucket projects |

## Required Evidence

Each CI run should expose:

- command or job name;
- pass/fail result;
- artifact path when an artifact is produced;
- contract diff or validation summary;
- architecture rule failures with file paths;
- security scan summary without printing secrets;
- deployment target and approval state when promotion runs.

## Common Mistakes

- Running unit tests but skipping architecture and contract checks.
- Building containers without scanning images.
- Treating documentation checks as release-only work.
- Publishing artifacts without enough metadata to reproduce the build.
- Allowing CI to pass when a required job was skipped.

## Verification Checklist

- [ ] Does CI fail on architecture boundary violations?
- [ ] Does CI fail on breaking contract changes?
- [ ] Does CI check secrets and dependencies?
- [ ] Does CI validate docs links and placeholders?
- [ ] Does CI make skipped required jobs visible?
- [ ] Is production promotion separate from branch validation?
