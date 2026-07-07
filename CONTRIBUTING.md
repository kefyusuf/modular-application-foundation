# Contributing Guide

## Contribution Philosophy

This repository accepts contributions that improve clarity, correctness, teachability, and architecture discipline.

Contributions should not make the repository framework-specific at the core level.

## Good Contributions

- Better explanations.
- Realistic examples.
- More precise trade-offs.
- Architecture test ideas.
- Security hardening guidance.
- Contract examples.
- Framework adapter guides that preserve the core architecture.

## Weak Contributions

- Empty TODO-only documents.
- Framework-specific assumptions in core docs.
- Pattern worship without trade-offs.
- Examples that violate module boundaries.
- Security claims without controls.
- Unversioned event or API examples.

## Pull Request Checklist

Before submitting:

- [ ] I followed `REPO_STANDARD.md`.
- [ ] I did not introduce framework lock-in to the core.
- [ ] I included trade-offs and common mistakes where relevant.
- [ ] I preserved module boundaries.
- [ ] I updated references if standards changed.
- [ ] I avoided empty placeholder files.
- [ ] I documented contract/security/architecture impact.
