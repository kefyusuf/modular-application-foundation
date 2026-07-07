# Kernel Contract: Policy Evaluator

## Purpose

Centralizes authorization decisions.

## Pseudocode

```txt
interface PolicyEvaluator {
  can(actor, action, resource, context): AuthorizationDecision
}
```

## Rules

- Deny by default.
- Evaluate action, resource, actor, scope, and context.
- Never rely only on route-level checks.
