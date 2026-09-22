# Kernel Contract: Specification

## Purpose

Encapsulates reusable domain predicates that decide whether an entity matches a rule or whether an action is allowed.

## Responsibility

A specification expresses a named business condition that can be evaluated in memory or translated for persistence queries. It is not a generic query language and not a substitute for the policy evaluator.

## Inputs

- Candidate entity or value object.
- Optional evaluation context: actor, tenant, time, locale.
- Composed specifications for and/or/not combinations.

## Outputs

- Boolean match result.
- Optional explanation or rule name for audit and errors.
- Translated query criteria when a persistence adapter supports it.

## Pseudocode

```txt
interface Specification<T> {
  isSatisfiedBy(candidate, context?): boolean
  and(other): Specification<T>
  or(other): Specification<T>
  not(): Specification<T>
  toCriteria?(): QueryCriteria
}
```

## Rules

- Specifications describe domain truth, not infrastructure filters alone.
- Authorization decisions still go through the policy evaluator; specifications may supply facts to policies.
- Prefer small, named specifications over one opaque mega-filter.
- Persistence translation must preserve the same semantics as in-memory evaluation.
- Specifications must not import framework, HTTP, or database types in domain code.
- Expensive or external checks do not belong inside a specification.

## Common Adapters

- In-memory domain specification.
- SQL criteria translator.
- Search filter translator.
- Policy fact builder.

## Failure Modes

- Specification and SQL translator disagree on semantics.
- Authorization hidden inside a query specification.
- Over-composed specifications that no one can review.
- Framework types leaking into domain specifications.
- External I/O performed while evaluating a candidate.

## Verification Checklist

- [ ] Is the rule named and owned by one module?
- [ ] Does domain evaluation stay framework-free?
- [ ] Is persistence translation equivalent to in-memory evaluation?
- [ ] Are authorization outcomes still enforced by the policy evaluator?
- [ ] Are compositions readable in review?
