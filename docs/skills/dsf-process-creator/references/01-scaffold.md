# 01 · Scaffold the Maven project

A DSF process plugin is a plain Maven JAR module. This step produces the project
layout, the `pom.xml`, the `plugin.properties`, the SPI service file, the
`ProcessPluginDefinition`, and the Spring `@Configuration` — everything the BPE
needs to discover and wire the plugin, before any BPMN or FHIR exists.

The matching template tree lives under `templates/`. Each file below maps to a
real file there.

## Project layout

```
example-process/
├── pom.xml
└── src/
    ├── main/
    │   ├── java/org/example/process/
    │   │   ├── ExampleProcessPluginDefinition.java
    │   │   ├── ConstantsExample.java
    │   │   ├── message/SendHelloMessage.java
    │   │   ├── service/HelloDsfService.java
    │   │   └── spring/config/ExampleConfig.java
    │   └── resources/
    │       ├── META-INF/services/dev.dsf.bpe.v2.ProcessPluginDefinition
    │       ├── plugin.properties
    │       ├── bpe/hello-dsf.bpmn
    │       └── fhir/
    │           ├── ActivityDefinition/hello-dsf.xml
    │           ├── StructureDefinition/task-start-hello-dsf.xml
    │           ├── StructureDefinition/task-hello-recipient.xml
    │           ├── Task/task-start-hello-dsf.xml
    │           ├── CodeSystem/example.xml
    │           └── ValueSet/example.xml
    └── test/java/org/example/process/
        ├── ExampleProcessPluginDefinitionTest.java
        └── service/HelloDsfServiceTest.java
```

- BPMN models live under `src/main/resources/bpe/`.
- FHIR conformance resources live under `src/main/resources/fhir/<ResourceType>/`.
- The build output is an **ordinary JAR**, not a shaded/fat JAR. The DSF API is
  supplied by the BPE at runtime and must not be bundled.

## pom.xml essentials

`templates/pom.xml` is buildable as-is. The load-bearing parts:

| Element | Value | Why |
|---|---|---|
| `packaging` | `jar` | A process plugin is a plain JAR. Never shade. |
| `dsf.version` property | `2.1.0` | Latest API v2 on Maven Central (2.0.0–2.1.0 are published). |
| `dev.dsf:dsf-bpe-process-api-v2` scope | **`provided`** | The BPE supplies the API at runtime. Compile/default scope or a shade plugin breaks deployment. |
| `maven.compiler.release` | `17` | Documented baseline. The framework and reference plugin compile to 21/25; both work. 17 is the safe floor. Require Maven ≥ 3.8. |
| `project.build.sourceEncoding` | `UTF-8` | Reproducible builds. |
| `project.build.outputTimestamp` | a fixed ISO instant, e.g. `2025-01-01T00:00:00Z` | Reproducible builds **and** the source of `release-date` in `plugin.properties`. |
| Resource filtering | `plugin.properties` **only** | Maven substitutes `${project.*}` into that one file. Filtering everything would corrupt binary/FHIR resources. |

### Build plugins

- **`maven-jar-plugin` 3.3.0** with
  `<finalName>example-process-${project.version}</finalName>` — the BPE derives
  the plugin name from the jar file name (jar minus `-<version>.jar`), so the
  final name must match the artifactId.
- **`dsf-maven-plugin`** (same `${dsf.version}`), two goals:
  - `generate-config-doc` — generates the configuration-option markdown from the
    `@ProcessDocumentation`-annotated `@Value` fields. Point it at the config
    package with `<configDocPackages>org.example.process.spring.config</configDocPackages>`.
  - `generate-dev-setup-cert-files` — generates the dev TLS certs and allow-list
    bundle used by the local Docker-Compose integration cluster.

### Test dependencies (scope `test`)

| Dependency | Version | Purpose |
|---|---|---|
| `dev.dsf:dsf-fhir-validation` | `${dsf.version}` | Validate FHIR resources against the DSF profiles. |
| `org.camunda.bpm:camunda-engine` | `7.23.0` | Exercise the BPMN model / process keys. |
| `org.camunda.bpm.model:camunda-bpmn-model` | `7.23.0` | Inspect the BPMN model in tests. |
| `junit:junit` | `4.13.2` | Test runner (JUnit 4). |
| `org.mockito:mockito-core` | `4.5.1` | Mock `ProcessPluginApi`/`Variables` in service tests. |
| `dev.dsf:dsf-bpe-process-api-v2` (`test-jar`) | `${dsf.version}` | Test helpers shipped in the API's test classifier. |

There is no published plugin parent/BOM. `dev.dsf:dsf-pom` / `dsf-maven-pom`
are the framework's own internal parents, not for plugins. Pin versions locally
(an aggregator may centralise them in a `<dependencyManagement>` block).

### distributionManagement

Publishing the jar to a repo's package registry uses GitHub Packages:

```xml
<distributionManagement>
  <repository>
    <id>github</id>
    <url>https://maven.pkg.github.com/OWNER/example-process</url>
  </repository>
</distributionManagement>
```

Replace `OWNER` with the GitHub org/user that owns the repo. CI authenticates
with `GITHUB_TOKEN`.

## plugin.properties

`src/main/resources/plugin.properties` — the only resource-filtered file. Maven
substitutes `${project.*}`; the `AbstractProcessPluginDefinition` base class
reads these at load time:

```properties
release-date=${project.build.outputTimestamp}
version=${project.version}
name=${project.artifactId}
title=${project.description}
publisher=${project.organization.name}
publisher-email=info@example.org
```

`release-date` parses as ISO-8601; `version` has `-SNAPSHOT` stripped.

## The SPI service file

`src/main/resources/META-INF/services/dev.dsf.bpe.v2.ProcessPluginDefinition` is
a Java ServiceLoader file. **The filename is the v2 interface FQN** — using the
v1 name (`…v1.ProcessPluginDefinition`) silently makes a v2 plugin invisible to
a v2 BPE. Its single line is the implementing class:

```
org.example.process.ExampleProcessPluginDefinition
```

## ProcessPluginDefinition (v2 contract)

Interface `dev.dsf.bpe.v2.ProcessPluginDefinition`; base class
`dev.dsf.bpe.v2.AbstractProcessPluginDefinition`.

```java
public interface ProcessPluginDefinition {
    String getName();                                        // == artifactId
    String getVersion();                                     // matches (\d+\.\d+)\.\d+\.\d+
    default String getResourceVersion();                     // first two segments, e.g. "1.0"
    LocalDate getReleaseDate();
    default LocalDate getResourceReleaseDate();
    default String getTitle();
    default String getPublisher();
    default String getPublisherEmail();
    enum License { Apache2, MIT, Other }
    default License getLicense();
    List<String> getProcessModels();                         // e.g. List.of("bpe/hello-dsf.bpmn")
    Map<String, List<String>> getFhirResourcesByProcessId(); // processId -> fhir/*.xml
    List<Class<?>> getSpringConfigurations();                // @Configuration classes
    default String getDescriptionFile();                     // "doc/description.md"
    default String getConfigurationFile();                   // "doc/configuration.md"
    default String getLicenseFile();                         // "doc/license.md"
}
```

- **Version regex.** `RESOURCE_VERSION_PATTERN_STRING = "(?<resourceVersion>\\d+\\.\\d+)"`;
  the full plugin version is `(resourceVersion)\.\d+\.\d+`. So `1.0.0.0` →
  resource version `1.0`. The resource version substitutes `#{version}` in
  BPMN/FHIR and suffixes every canonical URL (`…|1.0`).
- **`AbstractProcessPluginDefinition`** auto-implements
  `getName`/`getVersion`/`getReleaseDate`/`getTitle`/`getPublisher`/`getPublisherEmail`
  by reading `plugin.properties` (stripping `-SNAPSHOT`, parsing `release-date`
  as ISO-8601). Implementers override only the three "what is in this plugin"
  methods — `getProcessModels`, `getFhirResourcesByProcessId`,
  `getSpringConfigurations` — plus optionally the license/doc-file methods.
- **Allowed FHIR metadata types** in `getFhirResourcesByProcessId`:
  ActivityDefinition, CodeSystem, Library, Measure, NamingSystem, Questionnaire,
  StructureDefinition, Task, ValueSet. The map key is the BPMN process id
  (`example_helloDsfProcess`).

`templates/.../ExampleProcessPluginDefinition.java` extends the base class and
overrides exactly those three methods.

## Spring configuration

`getSpringConfigurations()` returns the `@Configuration` classes. Inside one,
anything from `ProcessPluginApi` (and the API itself) can be `@Autowired`.

**Prototype-bean rule (critical).** Every class used as a BPMN activity —
`ServiceTask`, `MessageEndEvent`, `MessageSendTask`,
`MessageIntermediateThrowEvent`, `ExecutionListener`, `UserTaskListener` — MUST
be a **prototype-scoped** Spring bean. Otherwise the BPE reuses one instance
across concurrent process instances. Two ways:

1. A `@Bean @Scope(ConfigurableBeanFactory.SCOPE_PROTOTYPE)` factory method
   (needed when the bean takes constructor args).
2. The helper `dev.dsf.bpe.v2.spring.ActivityPrototypeBeanCreator`, registered
   as a `static @Bean`. Pass it the activity classes; it auto-registers each as
   a prototype bean (bean name = lower-camel of the simple class name,
   constructor-autowired). `templates/.../ExampleConfig.java` uses this form.

**Env-var configuration.** Inject config with
`@Value("${org.example.process.special:false}")` — the property
`org.example.process.special` maps to env var `ORG_EXAMPLE_PROCESS_SPECIAL`.
Annotate the field with `dev.dsf.bpe.v2.documentation.ProcessDocumentation`
(`description`, `example`, `processNames`) so `generate-config-doc` picks it up.

```java
@Configuration
public class ExampleConfig {
  @Bean
  public static ActivityPrototypeBeanCreator activityPrototypeBeanCreator() {
    return new ActivityPrototypeBeanCreator(HelloDsfService.class, SendHelloMessage.class);
  }
}
```

## Verify

Once the Java files exist (and before the BPMN/FHIR resources are authored), the
project should compile:

```
mvn -q -DskipTests package
```

This confirms the `provided`-scoped API resolves, the Java compiles against
`dev.dsf.bpe.v2.*`, `plugin.properties` filters cleanly, and the jar is produced
as `target/example-process-1.0.0.0-SNAPSHOT.jar`. FHIR/BPMN validation happens
later in the test phase (`references/06-testing-local-dev.md`).
