# BPMN model

The BPMN file is the orchestration: it decides which Java class runs, in which
order, and what outbound `Task` a message event sends. It is standard
**Camunda BPMN 2.0**, authored in the **Camunda Modeler** and executed by the
DSF BPE's embedded **Camunda engine 7.23.0**.

The file lives at `src/main/resources/bpe/hello-dsf.bpmn` and is declared in the
plugin definition:

```java
@Override
public List<String> getProcessModels() {
    return List.of("bpe/hello-dsf.bpmn");
}
```

## The process element

```xml
<bpmn:process id="example_helloDsfProcess" isExecutable="true"
              camunda:versionTag="#{version}">
```

- **`id`** is the *process key*. The convention is `<orgprefix>_<processName>` —
  here `example_helloDsfProcess`. This exact string is also the key in
  `getFhirResourcesByProcessId()`, so the BPE knows which FHIR resources belong
  to this process.
- **`isExecutable="true"`** — the BPE only deploys executable processes.
- **`camunda:versionTag="#{version}"`** — the BPE replaces `#{version}` at deploy
  time with the plugin's *resource version* (the first two segments of the 4-part
  plugin version, e.g. `1.0`). The version tag lets the engine run several
  versions of the same process side by side.

## Message start event — the inbound entry point

A process is started when another organization (or a seed `Task`) POSTs a FHIR
`Task` to the BPE. The message start event is where that `Task` enters the
process.

```xml
<bpmn:startEvent id="StartEvent_Hello" name="start">
  <bpmn:outgoing>Flow_StartToService</bpmn:outgoing>
  <bpmn:messageEventDefinition id="MessageEventDefinition_Start"
                               messageRef="Message_StartHelloDsf" />
</bpmn:startEvent>

<!-- declared at definitions scope (sibling of bpmn:process) -->
<bpmn:message id="Message_StartHelloDsf" name="startHelloDsf" />
```

The routing key is the **message `name`** (`startHelloDsf`), *not* the element
id. When an inbound `Task` arrives, the BPE reads its `message-name` input and
matches it against the `name` of a message referenced by a start (or
intermediate catch) event. So three strings must agree:

| Where | Value |
|---|---|
| BPMN `<bpmn:message name="…">` | `startHelloDsf` |
| inbound `Task` `message-name` input | `startHelloDsf` |
| `process-authorization` extension `message-name` | `startHelloDsf` |

(See `04-authorization.md` for the third one.)

## Service task — the Java logic

```xml
<bpmn:serviceTask id="HelloDsfService" name="Hello DSF"
                  camunda:class="org.example.process.service.HelloDsfService">
  <bpmn:incoming>Flow_StartToService</bpmn:incoming>
  <bpmn:outgoing>Flow_ServiceToEnd</bpmn:outgoing>
</bpmn:serviceTask>
```

- **`camunda:class`** is the fully-qualified class name of the activity bean.
  In API v2 the class `implements ServiceTask` and overrides
  `execute(ProcessPluginApi api, Variables variables)`.
- The class must be registered as a **prototype-scoped** Spring bean (otherwise
  the BPE reuses one instance across concurrent process instances). See
  `05-java-activities.md`.

The element `id` (`HelloDsfService`) is by convention the simple class name; the
engine resolves the bean by FQCN from `camunda:class`, so the id is for the
diagram only.

## Message end event — the outbound `Task`

A message end (or message throw) event sends a FHIR `Task` to another
organization. The three `camunda:field`s on the message event definition are
exactly what the default v2 `MessageEndEvent.execute(...)` reads to build that
outbound `Task`. `camunda:class` sits directly on the `messageEventDefinition`,
but the `camunda:field`s **must** be wrapped in a `<bpmn:extensionElements>`
element inside it — Camunda rejects bare `camunda:field` children:

```xml
<bpmn:endEvent id="endHelloRecipient" name="hello recipient">
  <bpmn:incoming>Flow_ServiceToEnd</bpmn:incoming>
  <bpmn:messageEventDefinition id="MessageEventDefinition_End"
       messageRef="Message_HelloRecipient"
       camunda:class="org.example.process.message.SendHelloMessage">
    <bpmn:extensionElements>
      <camunda:field name="instantiatesCanonical">
        <camunda:string>http://example.org/bpe/Process/helloDsfProcess|#{version}</camunda:string>
      </camunda:field>
      <camunda:field name="profile">
        <camunda:string>http://example.org/fhir/StructureDefinition/task-hello-recipient|#{version}</camunda:string>
      </camunda:field>
      <camunda:field name="messageName">
        <camunda:string>helloRecipient</camunda:string>
      </camunda:field>
    </bpmn:extensionElements>
  </bpmn:messageEventDefinition>
</bpmn:endEvent>

<!-- declared at definitions scope (sibling of bpmn:process) -->
<bpmn:message id="Message_HelloRecipient" name="helloRecipient" />

The three fields define the outbound `Task`:

| `camunda:field` | Becomes | Value in the template |
|---|---|---|
| `instantiatesCanonical` | `Task.instantiatesCanonical` — selects the recipient's process | `http://example.org/bpe/Process/helloDsfProcess\|#{version}` |
| `profile` | `Task.meta.profile` — the Task profile the recipient validates against | `http://example.org/fhir/StructureDefinition/task-hello-recipient\|#{version}` |
| `messageName` | the `message-name` input — the recipient's routing key | `helloRecipient` |

`#{version}` is substituted at deploy time, so the canonical suffix
(`|1.0`) always matches the resource version — never the 4-part plugin version.

The simplest send is **zero-code**:
`public class SendHelloMessage implements MessageEndEvent {}`. The default
`execute(...)` builds and sends the `Task` from these fields plus the current
`Target`. To add `Task` inputs, override `getAdditionalInputParameters(...)`.

## How a BPMN message maps to an inbound FHIR Task

An incoming `Task` drives the process through three pieces of data:

1. **`Task.instantiatesCanonical = <processURL>|<version>`** selects the process
   (and its `ActivityDefinition`). Here:
   `http://example.org/bpe/Process/helloDsfProcess|1.0`.
2. **`message-name` input** (CodeSystem
   `http://dsf.dev/fhir/CodeSystem/bpmn-message`, code `message-name`) matches
   the BPMN message `name` (`startHelloDsf`) to pick the start/catch event.
3. **`business-key`** (and optional **`correlation-key`**) inputs (same
   CodeSystem) correlate a reply to the originating process instance — the BPE
   uses them to route an inbound `Task` to the waiting instance rather than
   starting a new one.

The Task profile (`03-fhir-resources.md`) pins these inputs as slices; the
authorization extension (`04-authorization.md`) ties the `message-name` and
`task-profile` to who may send.

## How the template maps to Java and FHIR

| BPMN element | Java class | FHIR resource |
|---|---|---|
| `<bpmn:process id="example_helloDsfProcess">` | — | `ActivityDefinition` url `http://example.org/bpe/Process/helloDsfProcess` |
| message start `name="startHelloDsf"` | (catch — read via `variables.getStartTask()`) | `task-start-hello-dsf` StructureDefinition |
| service task `camunda:class=…HelloDsfService` | `org.example.process.service.HelloDsfService` | — |
| message end `camunda:class=…SendHelloMessage` | `org.example.process.message.SendHelloMessage` | `task-hello-recipient` StructureDefinition |

## Diagram interchange

The `.bpmn` file also carries a `<bpmndi:BPMNDiagram>` section with shapes and
edges so it opens with a layout in the Camunda Modeler. The template includes a
minimal `BPMNDI` block; the engine ignores it at runtime but the Modeler needs
it. When you edit the process, edit it in the Modeler so the diagram and the
semantic model stay in sync.
