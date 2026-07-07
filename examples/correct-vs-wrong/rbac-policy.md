# Correct vs Wrong: RBAC Policy

## Wrong

```txt
if actor.role == "admin" {
  approveRefund(order)
}
```

Why it is wrong:

- Role names leak into business logic.
- Object-level authorization is skipped.
- Scoped roles are hard to support.
- Policy changes require code changes across features.

## Correct: Policy Evaluation

```txt
decision = policy.can(
  actor,
  "order.refund.approve",
  order,
  {
    tenant_id: order.tenant_id,
    amount: order.refund_amount,
    channel: "admin-panel"
  }
)

if decision.denied {
  return forbidden(decision.reason)
}
```

The feature asks the policy evaluator. The access module owns roles, permissions, assignments, and scoped evaluation.

## Correct: Permission Naming

```txt
order.refund.approve
audit.log.read
settings.feature_flag.manage
```

Permissions should describe module, resource, and action.

## Correct: Panel Access

```txt
admin.panel.access
vendor.panel.access
customer.panel.access
```

Panel access is a permission, not proof that every action inside the panel is allowed.

## Verification

- [ ] Are role names hidden behind policy evaluation?
- [ ] Is object-level authorization performed?
- [ ] Are permissions named by module, resource, and action?
- [ ] Are scoped roles supported?
- [ ] Are authorization failures audit logged where sensitive?
