# Description

`example-process` is a minimal DSF process plugin that demonstrates the full
message round-trip between two allow-listed organizations.

The process `example_helloDsfProcess` starts when an organization receives a
FHIR `Task` matching the `startHelloDsf` message and the
`task-start-hello-dsf` profile. The Task carries a single `hello-input` string
parameter.

Message flow:

1. **Start (message catch).** An inbound `Task` triggers the message start event
   `startHelloDsf`. The BPE selects this process from the Task's
   `instantiatesCanonical`.
2. **Service task.** `HelloDsfService` reads the `hello-input` value and the
   addressed recipient, then sets the `Target` for the next hop.
3. **End (message send).** `SendHelloMessage` sends an outbound `Task` to the
   recipient organization (`helloRecipient` message, `task-hello-recipient`
   profile), carrying its own `hello-input` parameter.

The plugin ships the conformance resources that describe these messages:
an ActivityDefinition (with the process-authorization extension), the two Task
StructureDefinitions, a CodeSystem and ValueSet for `hello-input`, and a seed
Task for local testing.
