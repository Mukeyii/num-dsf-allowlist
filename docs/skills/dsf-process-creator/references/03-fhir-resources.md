# FHIR conformance resources

The plugin ships FHIR R4 conformance resources that describe what its messages
look like and who may exchange them. They are public artifacts — never put
contact data or private keys in them.

## Where the files live

All FHIR resources go under `src/main/resources/fhir/<ResourceType>/`:

```
src/main/resources/fhir/
├── ActivityDefinition/hello-dsf.xml
├── StructureDefinition/task-start-hello-dsf.xml
├── StructureDefinition/task-hello-recipient.xml
├── CodeSystem/example.xml
├── ValueSet/example.xml
└── Task/task-start-hello-dsf.xml          (seed/example Task)
```

Each file is listed, per process, in the plugin definition. The map key is the
BPMN process id:

```java
@Override
public Map<String, List<String>> getFhirResourcesByProcessId() {
    return Map.of("example_helloDsfProcess", List.of(
        "fhir/ActivityDefinition/hello-dsf.xml",
        "fhir/StructureDefinition/task-start-hello-dsf.xml",
        "fhir/StructureDefinition/task-hello-recipient.xml",
        "fhir/CodeSystem/example.xml",
        "fhir/ValueSet/example.xml",
        "fhir/Task/task-start-hello-dsf.xml"));
}
```

Allowed metadata types: `ActivityDefinition`, `CodeSystem`, `Library`,
`Measure`, `NamingSystem`, `Questionnaire`, `StructureDefinition`, `Task`,
`ValueSet`.

## Placeholders

The BPE substitutes these tokens when it deploys the resources, so the source
stays version-agnostic:

| Placeholder | Replaced with |
|---|---|
| `#{version}` | the resource version, e.g. `1.0` (first two segments of the plugin version) |
| `#{date}` | the resource release date (`getResourceReleaseDate()`) |
| `#{organization}` | the local organization's DSF identifier |
| `#{property.name}` | the value of the `PROPERTY_NAME` environment variable |

`#{version}` is the token you see most: it suffixes every canonical URL
(`…|#{version}`) and fills `version` elements. It is the *resource* version, not
the 4-part plugin version.

## Read-access tag

Every resource carries a read-access tag in `meta` that controls which
allow-listed organizations may read it. `ALL` means every allow-listed org:

```xml
<meta>
  <tag>
    <system value="http://dsf.dev/fhir/CodeSystem/read-access-tag" />
    <code value="ALL" />
  </tag>
</meta>
```

Read access is orthogonal to process authorization — it controls *reading the
conformance resource*, not *who may run the process*. See `04-authorization.md`.
At runtime, `api.getReadAccessHelper()` reads and sets these tags.

## ActivityDefinition — one per process

Profile `http://dsf.dev/fhir/StructureDefinition/activity-definition`. It
represents the process itself and carries its authorization.

- `url` = the **process URL** `http://example.org/bpe/Process/helloDsfProcess`.
  This is the base of every `instantiatesCanonical`.
- `version` = `#{version}`; `name` = `HelloDsfProcess`.
- `kind` = `Task` (the process is driven by Tasks).
- `status` = `unknown` and `date` = `#{date}` — the BPE manages `status`,
  `date`, and `version` on deploy, so source uses `unknown`/placeholders.
- `experimental` = `false`.
- Carries the **process-authorization extension**
  (`http://dsf.dev/fhir/StructureDefinition/extension-process-authorization`),
  which ties a `message-name`, a `task-profile`, and a set of `requester`/
  `recipient` codings. Detail and concrete snippets in `04-authorization.md`.

## Task StructureDefinition — one per message

Profile `http://dsf.dev/fhir/StructureDefinition/structure-definition`. It
constrains the `Task` for one message. There is one per message: the inbound
start (`task-start-hello-dsf`) and the outbound (`task-hello-recipient`).

Fixed framing for every messaging Task profile:

- `baseDefinition` = `http://dsf.dev/fhir/StructureDefinition/task`
- `derivation` = `constraint`
- `fhirVersion` = `4.0.1`
- `kind` = `resource`, `abstract` = `false`, `type` = `Task`

Per-profile content (start profile shown):

- `url` = `http://example.org/fhir/StructureDefinition/task-start-hello-dsf`,
  `name` = `TaskStartHelloDsf`, `version` = `#{version}`.
- `Task.instantiatesCanonical` is fixed (`fixedCanonical`) to
  `http://example.org/bpe/Process/helloDsfProcess|#{version}` — so a Task
  validating against this profile always targets the right process+version.
- `Task.input` is **sliced** on `input.type.coding` (the DSF way), one slice per
  expected input:

  | Slice | Cardinality | Constraint |
  |---|---|---|
  | `message-name` | 1..1 | `value[x]` fixedString `startHelloDsf` |
  | `business-key` | 0..1 | correlation |
  | `correlation-key` | 0..0 | not used by the start message |
  | `hello-input` | 1..1 | `value[x]` string, bound to the ValueSet |

The slicing discriminator is `value` on `input.type.coding`. The `message-name`,
`business-key`, and `correlation-key` slices use CodeSystem
`http://dsf.dev/fhir/CodeSystem/bpmn-message`; the `hello-input` slice uses the
plugin's own CodeSystem `http://example.org/fhir/CodeSystem/example`.

The outbound profile (`task-hello-recipient`) is the same shape with
`url`/`name` for the recipient, `message-name` fixed to `helloRecipient`, and
the same `instantiatesCanonical` (the message goes *into* the same process).

## CodeSystem

Profile `http://dsf.dev/fhir/StructureDefinition/code-system`. Defines the codes
this plugin invents for its inputs.

- `url` = `http://example.org/fhir/CodeSystem/example`, `version` = `#{version}`,
  `date` = `#{date}`.
- `status` = `active`, `caseSensitive` = `true`, `content` = `complete`.
- One `concept`: `hello-input`, with `display` and `definition`.

(DSF rewrites `status` on deploy; sources commonly use `active` or `unknown` —
the template uses `active` with a `#{date}`.)

## ValueSet

Profile `http://dsf.dev/fhir/StructureDefinition/value-set`. Binds the input
slice to the allowed codes.

- `url` = `http://example.org/fhir/ValueSet/example`, `version` = `#{version}`.
- `immutable` = `true`.
- `compose.include.system` = the CodeSystem url
  `http://example.org/fhir/CodeSystem/example` with `version` `#{version}`,
  listing the concept `hello-input`.

## Seed Task

A concrete `Task` instance (`fhir/Task/task-start-hello-dsf.xml`) used to start
the process in dev/testing. It is an *instance*, not a profile: it validates
against `task-start-hello-dsf`, has `status=requested`, `intent=order`,
`requester`/`restriction.recipient` as organization identifiers, and the
`message-name`/`hello-input` inputs filled in. See the template for the full
shape.

## Naming conventions

| Resource | Convention | Example |
|---|---|---|
| Process URL | `http://example.org/bpe/Process/<processName>` | `…/helloDsfProcess` |
| `instantiatesCanonical` | `<processURL>\|<resourceVersion>` | `…/helloDsfProcess\|1.0` |
| Task profile | `http://example.org/fhir/StructureDefinition/task-<message>` | `…/task-start-hello-dsf` |
| CodeSystem / ValueSet | `http://example.org/fhir/{CodeSystem,ValueSet}/<name>` | `…/CodeSystem/example` |
| StructureDefinition `name` | UpperCamel of the file | `TaskStartHelloDsf` |
| File name | kebab-case of the resource | `task-start-hello-dsf.xml` |

## Cross-references

- Authorization extension on the `ActivityDefinition`: `04-authorization.md`.
- How these resources are driven by the BPMN model: `02-bpmn.md`.
