# Feature Slice

## Purpose

Feature slice organizes code around use cases instead of purely technical layers.

It makes application behavior visible by grouping the command, query, validation, authorization, side effects, and tests for one use case.

## Example

```txt
application/features/register-user/
  command
  handler
  validator
  result
  policy
  tests
```

## Why

It keeps the business use case visible and prevents application logic from spreading across generic service folders.

## When to Use

Use feature slices for:

- commands;
- queries;
- workflows;
- API operations;
- business capabilities;
- admin actions.

## When Not to Use

Avoid a feature slice when:

- the behavior is a tiny pure domain method with no application workflow;
- the slice would only wrap one trivial framework call;
- the code is shared domain logic that belongs inside an aggregate, value object, or domain service;
- the feature boundary is unclear and should first be clarified in the module README or feature doc.

## Trade-offs

- Feature slices make use cases easy to find, but they can create too many folders if used mechanically.
- They keep validation and authorization close to the workflow, but shared policies still need clear reuse points.
- They reduce generic service sprawl, but cross-feature duplication should be watched.
- They are framework-friendly, but the slice must not depend directly on controllers, HTTP requests, jobs, or database adapters.

## Common Mistakes

- Creating thousands of tiny folders for trivial behavior.
- Putting infrastructure details in feature handlers.
- Returning domain entities directly from features.
- Skipping policy checks because the controller already checked auth.

## Verification Checklist

- [ ] Does each feature have one clear use case?
- [ ] Is validation close to the input model?
- [ ] Is authorization explicit?
- [ ] Are side effects routed through ports/events?
- [ ] Can the feature be tested without a real web request?
- [ ] Does the feature return an output contract instead of a domain entity?
