# Architecture Fitness Functions Pseudocode

## Purpose

Show how architecture rules can be represented as language-neutral checks.

This example is not a runnable test suite. Implementation projects should adapt the rules to their parser, package manager, module layout, and CI tooling.

## Input Model

```txt
SourceFile:
  path
  module
  layer
  imports[]
  exported_symbols[]

ModuleManifest:
  module
  requires[]
  public_paths[]
  produced_events[]
  consumed_events[]
  permissions[]

Import:
  source_path
  target_path
  target_module
  target_layer
  target_is_public
```

## Rule Runner

```txt
function run_architecture_fitness_checks(source_files, manifests):
  import_graph = build_import_graph(source_files)
  event_catalog = collect_public_events(source_files, manifests)

  failures = []
  failures += check_private_module_imports(import_graph, manifests)
  failures += check_domain_runtime_dependencies(source_files)
  failures += check_interface_infrastructure_shortcuts(import_graph)
  failures += check_unversioned_events(event_catalog)
  failures += check_manifest_dependency_drift(import_graph, manifests)
  failures += check_public_contract_leaks(source_files)

  return failures
```

## Private Module Import Rule

```txt
function check_private_module_imports(import_graph, manifests):
  failures = []

  for each edge in import_graph:
    if edge.source_module == edge.target_module:
      continue

    if edge.target_is_public == false:
      failures.add(
        rule: "forbidden_private_module_import",
        source: edge.source_path,
        target: edge.target_path,
        message: "Cross-module imports must target public contracts only."
      )

    if edge.target_module not in manifests[edge.source_module].requires:
      failures.add(
        rule: "undeclared_module_dependency",
        source: edge.source_path,
        target: edge.target_module,
        message: "Cross-module dependency must be declared in module.manifest.yml."
      )

  return failures
```

## Domain Runtime Dependency Rule

```txt
framework_or_runtime_packages = [
  "http",
  "express",
  "laravel",
  "eloquent",
  "entityframework",
  "gorm",
  "sql",
  "redis",
  "kafka",
  "s3",
  "otel"
]

function check_domain_runtime_dependencies(source_files):
  failures = []

  for each file in source_files where file.layer == "domain":
    for each imported_package in file.imports:
      if imported_package matches framework_or_runtime_packages:
        failures.add(
          rule: "domain_runtime_dependency",
          source: file.path,
          target: imported_package,
          message: "Domain code must not depend on framework or infrastructure packages."
        )

  return failures
```

## Interface Shortcut Rule

```txt
function check_interface_infrastructure_shortcuts(import_graph):
  failures = []

  for each edge in import_graph:
    if edge.source_layer == "interfaces" and edge.target_layer == "infrastructure":
      failures.add(
        rule: "interface_infrastructure_shortcut",
        source: edge.source_path,
        target: edge.target_path,
        message: "Interface adapters must call application use cases, not infrastructure directly."
      )

    if edge.source_layer == "interfaces" and edge.target_name contains "Repository":
      failures.add(
        rule: "controller_repository_shortcut",
        source: edge.source_path,
        target: edge.target_path,
        message: "Controllers must not call repositories directly."
      )

  return failures
```

## Event Version Rule

```txt
event_name_pattern = "{context}.{resource}.{past_tense_fact}.v{number}"

function check_unversioned_events(event_catalog):
  failures = []

  for each event in event_catalog:
    if event.visibility != "public":
      continue

    if event.name does not match event_name_pattern:
      failures.add(
        rule: "unversioned_or_invalid_event_name",
        event: event.name,
        message: "Public integration events must be versioned and named as facts."
      )

  return failures
```

## Public Contract Leak Rule

```txt
function check_public_contract_leaks(source_files):
  failures = []

  for each file in source_files where file.path includes "/public/":
    for each symbol in file.exported_symbols:
      if symbol.type in ["DomainEntity", "AggregateRoot", "OrmModel", "DatabaseRecord"]:
        failures.add(
          rule: "private_model_exposed_as_public_contract",
          source: file.path,
          symbol: symbol.name,
          message: "Public contracts must expose stable DTOs or schemas, not private models."
        )

  return failures
```

## Expected Failure Output

```txt
FAIL forbidden_private_module_import
source: modules/order/application/CreateOrderHandler
target: modules/identity/infrastructure/UserRepository
message: Cross-module imports must target public contracts only.

FAIL unversioned_or_invalid_event_name
event: identity.user.registered
message: Public integration events must be versioned and named as facts.
```

## Verification

- [ ] Does the pseudocode reject private cross-module imports?
- [ ] Does the pseudocode reject undeclared module dependencies?
- [ ] Does the pseudocode reject domain runtime dependencies?
- [ ] Does the pseudocode reject interface-to-infrastructure shortcuts?
- [ ] Does the pseudocode reject unversioned public events?
- [ ] Does the pseudocode keep rules independent from a specific framework?
