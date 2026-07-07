# Correct vs Wrong: Repository Pattern

## Wrong

```txt
reporting feature calls order.infrastructure.repositories.OrderRepository
admin list screen loads every Order aggregate
payment module imports order.infrastructure.repositories.OrderRepository
```

Why it is wrong:

- Repositories become generic query services.
- Other modules depend on private persistence details.
- Aggregate loading is used for reporting and list screens.
- Future module extraction becomes harder.

## Correct: Aggregate Repository

```txt
order application uses OrderRepository to load and save Order aggregate
repository.save(order, expectedVersion)
```

Use repositories for aggregate persistence and invariant protection.

## Correct: Query Projection

```txt
reporting reads order_summary_projection
admin list screen uses OrderListQuery
```

Use read models, projections, or query services for reporting, dashboards, and list screens.

## Correct: Public Contract

```txt
payment asks OrderPaymentReader public contract
payment does not import order private repository
```

Cross-module reads must go through public contracts, events, projections, or capability ports.

## Verification

- [ ] Is the repository owned by one module?
- [ ] Is it used for aggregate persistence, not reporting?
- [ ] Are list screens served by query services or projections?
- [ ] Are expected versions checked for concurrent writes?
- [ ] Are other modules blocked from importing private repositories?
