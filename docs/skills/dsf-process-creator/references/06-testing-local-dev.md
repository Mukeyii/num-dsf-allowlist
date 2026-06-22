# Testing & local development

A DSF process plugin is tested in layers, from fast in-JVM unit tests up to a
full multi-organization integration cluster. Each layer is independent; run the
fast ones on every change and the integration layer when wiring or routing
changes. The test sources for the canonical `example-process` plugin live under
`src/test/java/org/example/process/`.

## Test dependencies

All test dependencies are `<scope>test</scope>` in `pom.xml`:

| Dependency | Version | Purpose |
|---|---|---|
| `dev.dsf:dsf-fhir-validation` | `${dsf.version}` | Validate FHIR resources against DSF profiles |
| `dev.dsf:dsf-bpe-process-api-v2` (`test-jar`) | `${dsf.version}` | Test fixtures for the v2 API |
| `org.camunda.bpm:camunda-engine` | `7.23.0` | Load and inspect the BPMN model |
| `org.camunda.bpm.model:camunda-bpmn-model` | `7.23.0` | Read process keys, message names, `camunda:class` |
| `org.mockito:mockito-core` | `4.5.1` | Mock `ProcessPluginApi` / `Variables` |
| `junit:junit` | `4.13.2` | Test runner |

## Test layers

### 1. Plugin-definition test

`ExampleProcessPluginDefinitionTest` instantiates
`ExampleProcessPluginDefinition` and asserts the plugin's self-description is
internally consistent:

- `getProcessModels()` lists `bpe/hello-dsf.bpmn`.
- `getFhirResourcesByProcessId()` is keyed by the BPMN process id
  `example_helloDsfProcess` and lists every `fhir/*.xml` the process needs.
- `getSpringConfigurations()` returns the `@Configuration` classes.
- `getVersion()` parses as `(\d+\.\d+)\.\d+\.\d+` and `getResourceVersion()`
  yields the first two segments (`1.0` for version `1.0.0.0`).

This catches the most common scaffolding mistakes (a FHIR file that exists on
disk but is not declared, or a process-id/map-key mismatch) without loading the
BPE.

### 2. FHIR profile tests

`profile/ActivityDefinitionProfileTest` and `profile/TaskProfileTest` validate
each FHIR resource against the DSF StructureDefinitions using a validator built
from the test-scoped `dev.dsf:dsf-fhir-validation`. They confirm that the
ActivityDefinition, Task StructureDefinitions, CodeSystem, ValueSet, and seed
Task conform to the DSF base profiles (for example
`http://dsf.dev/fhir/StructureDefinition/activity-definition` and the `task`
base). Profile validation is where authorization-extension and slicing errors
surface.

> The template tree ships the plugin-definition and service tests only. Add
> these profile tests yourself, following the `*ProfileTest` classes in
> `mii-process-report` / `dsf-process-tutorial` as the pattern.

### 3. Service (Mockito) tests

`service/HelloDsfServiceTest` unit-tests a `ServiceTask` in isolation. Mock
`ProcessPluginApi` and `Variables`, stub the helpers the task calls (for example
`api.getTaskHelper()` and `variables.getStartTask()`), invoke
`execute(api, variables)`, and assert the side effects — the `Target` set via
`variables.setTarget(...)` and any process variables written. No BPE, no
database, no network.

### 4. BPMN model checks

Load `bpe/hello-dsf.bpmn` with `camunda-bpmn-model` (engine `7.23.0`) and assert
the model matches the rest of the plugin:

- the process `id` is `example_helloDsfProcess`;
- the message start event carries message name `startHelloDsf` and the message
  end event carries `helloRecipient`;
- each `serviceTask` `camunda:class` points at an existing, prototype-scoped
  activity class FQCN.

These checks fail fast when a routing string drifts out of sync between the BPMN
and the Java/FHIR side.

### 5. Integration — `DockerComposeTest`

> Not shipped in the template tree: the `dev-setup/` cluster, the
> `DockerComposeTest`, and the `maven-dependency-plugin` jar-copy step are
> omitted to keep the scaffold minimal. Adapt `mii-process-report`'s or
> `dsf-process-tutorial`'s `dev-setup/` when you need full end-to-end testing.
> The flow below describes that setup.

`DockerComposeTest` drives a multi-organization dev cluster defined by
`dev-setup/docker-compose.yml`:

- **3 DSF instances** (separate organizations) so requester→recipient messaging
  can be exercised end to end;
- **Keycloak** providing the OIDC realms;
- an **nginx** reverse proxy in front of the instances.

Setup, all run before the test:

1. Generate the dev TLS certificates and the allow-list `bundle.xml` with the
   `dsf-maven-plugin` goal `generate-dev-setup-cert-files`.
2. Build the plugin JAR (`mvn -q -DskipTests package`).
3. The `maven-dependency-plugin` copies the built jar into each
   organization's `bpe/process` directory so every instance loads the plugin.

The test then starts the cluster, posts the seed Task to trigger
`startHelloDsf`, and asserts the recipient organization receives the
`helloRecipient` Task.

## DSF Linter Tool

The DSF Linter Tool (documented separately on dsf.dev) statically validates
FHIR/BPMN consistency — process ids, message names, canonical version suffixes,
and authorization wiring — across the plugin's resources. Run it as a final
check before tagging a release; it catches cross-file mismatches that
per-resource profile validation does not.

## Commands

```bash
mvn -q test                  # run the shipped tests (plugin-definition + service)
mvn -q -DskipTests package   # build example-process-<version>.jar without tests
```

The integration layer (`DockerComposeTest`) requires a running Docker engine and
the generated dev-setup certificates; it is therefore typically excluded from
the default fast `mvn test` cycle and run on demand.
