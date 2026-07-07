# Architecture Fitness Functions Standard

## Purpose

Define framework-neutral architecture checks that keep module boundaries, dependency direction, contracts, and event versioning enforceable.

Architecture fitness functions are tests for structure. They do not replace unit, integration, security, or contract tests. They catch architectural drift that would otherwise appear only during review or late refactoring.

## Baseline Rules

- Modules must not import another module's private internals.
- Domain code must not depend on framework, transport, persistence, queue, cache, storage, or observability packages.
- Application code must depend on domain and ports, not concrete infrastructure adapters.
- Interface adapters must call application use cases or query handlers, not repositories directly.
- Infrastructure adapters must implement ports and stay behind module boundaries.
- Public integration events must be versioned.
- Public DTOs and event payloads must not expose private domain entities.
- Cross-module access must go through public contracts, commands, queries, events, policies, or projections.
- Architecture rules must be executable in CI before a branch is considered ready.

## Fitness Function Catalog

| Rule | Detects | Failure Example |
|---|---|---|
| forbidden private module import | direct dependency on another module's internals | `order -> identity.infrastructure.UserRepository` |
| domain framework dependency | domain tied to runtime or transport | `domain -> Laravel Model`, `domain -> Express Request` |
| infrastructure shortcut | application/interface bypassing ports | `controller -> repository` |
| unversioned event | unstable event contract | `identity.user.registered` |
| domain entity exposure | private model leaked as public contract | `UserEntity` returned from controller |
| undeclared module dependency | manifest drift | dependency used but not declared |
| shared junk drawer | uncontrolled shared coupling | `shared/helpers` imported everywhere |

## Rule Inputs

Architecture checks can be built from these inputs:

```txt
source_files
import_graph
module_manifests
public_contract_paths
event_catalog
layer_path_rules
framework_package_list
```

The exact parser depends on the language. The rule names and expected outcomes should stay stable across languages.

## Module Boundary Rules

```txt
for each dependency in import_graph:
  if dependency.target.module != dependency.source.module:
    dependency.target must be public
    dependency must be declared in source module manifest
```

Allowed cross-module targets:

```txt
public/contracts
public/dto
public/events
public/commands
public/queries
public/permissions
```

Forbidden cross-module targets:

```txt
domain
application
infrastructure
interfaces
database
internal
```

## Layer Direction Rules

```txt
domain -> no framework, persistence, transport, queue, cache, storage, or observability imports
application -> domain, ports, public contracts
interfaces -> application use cases, commands, queries, response DTOs
infrastructure -> ports, external clients, persistence, queue, cache, storage
```

## Event Versioning Rules

Public integration events must follow:

```txt
{bounded_context}.{aggregate_or_resource}.{past_tense_fact}.v{number}
```

Valid:

```txt
identity.user.registered.v1
access.role.assigned.v1
audit.security_event.recorded.v1
```

Invalid:

```txt
UserRegistered
identity.user.registered
send_user_email.v1
```

## Manifest Consistency Rules

Each module manifest should be checked against real dependencies:

```txt
for each module:
  used_external_modules must be subset of manifest.requires
  exported_events must be listed in manifest.events.produces
  consumed_events must be listed in manifest.events.consumes
  exported_permissions must be listed in manifest.security.permissions
```

## CI Guidance

Architecture fitness functions should run before broad integration or E2E tests because they are fast and deterministic.

Recommended order:

```txt
format
static analysis
architecture fitness functions
unit tests
contract validation
integration tests
security tests
E2E tests
```

## Language Adaptation

| Language | Typical Input |
|---|---|
| PHP | Composer autoload namespaces and parsed `use` statements |
| Go | package imports and module paths |
| .NET | project references, namespaces, and assembly references |
| Node.js/TypeScript | `tsconfig` paths and import graph |
| Java | package imports and module boundaries |
| Python | package imports and dependency graph |

Do not copy a framework-specific test library into the standard. Map these rules to the toolchain of the implementation project.

## Common Mistakes

- Treating architecture tests as optional because code review already exists.
- Testing only package names and ignoring module manifests.
- Allowing a `shared` namespace to bypass every boundary.
- Blocking all cross-module imports instead of allowing explicit public contracts.
- Forgetting event version checks.
- Running architecture checks only locally and not in CI.
- Making rules so strict that legitimate adapter code cannot exist.

## Verification Checklist

- [ ] Can forbidden private module imports be detected?
- [ ] Can domain framework/runtime dependencies be detected?
- [ ] Can interface-to-infrastructure shortcuts be detected?
- [ ] Can unversioned public events be detected?
- [ ] Can manifest dependency drift be detected?
- [ ] Can rules be adapted to at least two implementation languages?
- [ ] Can the checks run in CI without requiring a full application runtime?
