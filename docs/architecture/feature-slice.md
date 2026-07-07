# Feature Slice

## Purpose

Feature slice organizes code around use cases instead of purely technical layers.

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
