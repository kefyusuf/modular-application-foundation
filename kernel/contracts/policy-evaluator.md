# Kernel Contract: Policy Evaluator

## Purpose

Centralizes authorization decisions.

## Responsibility

The policy evaluator answers whether an actor can perform an action on a resource within a scope and context.

## Inputs

- Actor.
- Action.
- Resource.
- Scope.
- Context.

## Outputs

- Authorization decision.
- Deny reason.
- Audit metadata.

## Pseudocode

```txt
interface PolicyEvaluator {
  can(actor, action, resource, context): AuthorizationDecision
}

interface AuthorizationDecision {
  allowed(): boolean
  reason(): string optional
  matchedPolicy(): PolicyName optional
}
```

## Rules

- Deny by default.
- Evaluate action, resource, actor, scope, and context.
- Never rely only on route-level checks.
- Object-level authorization belongs in application behavior.
- Decisions should be auditable for sensitive actions.

## Common Adapters

- RBAC policy adapter.
- ABAC policy adapter.
- External policy engine adapter.
- Cached permission adapter.

## Failure Modes

- Missing actor.
- Missing resource scope.
- Stale permission cache.
- Policy engine unavailable.
- Ambiguous allow/deny result.

## Verification Checklist

- [ ] Is deny the default?
- [ ] Are role strings hidden behind policy evaluation?
- [ ] Is object-level authorization checked?
- [ ] Are sensitive denials auditable?
- [ ] Does cache invalidation happen after permission changes?
