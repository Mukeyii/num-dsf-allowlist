# Starting

The process is started by posting a FHIR `Task` to the recipient
organization's DSF FHIR server. The BPE matches the Task to the
`startHelloDsf` message start event and creates a process instance.

## The start Task

`POST` a `Task` resource to the FHIR endpoint. The Task must conform to the
start Task profile
`http://example.org/fhir/StructureDefinition/task-start-hello-dsf` and set:

| Field | Value |
|---|---|
| `Task.instantiatesCanonical` | `http://example.org/bpe/Process/helloDsfProcess|1.0` |
| `Task.status` | `requested` |
| `Task.requester` | the requesting organization's identifier |
| `Task.restriction.recipient` | the recipient organization's identifier |

## Required inputs

The Task carries `Task.input` parameters (CodeSystem
`http://dsf.dev/fhir/CodeSystem/bpmn-message` for the routing inputs, and the
process CodeSystem `http://example.org/fhir/CodeSystem/example` for the payload):

| Input code | System | Cardinality | Value |
|---|---|---|---|
| `message-name` | bpmn-message | 1..1 | `startHelloDsf` |
| `business-key` | bpmn-message | 0..1 | client-generated process correlation key |
| `hello-input` | example | 1..1 | the string payload the service task reads |

The `business-key` correlates later messages to this process instance; if
omitted, the BPE assigns one.

## Authorization

The requester must be authorized as a `requester` for `startHelloDsf` on the
process's ActivityDefinition, and the recipient as a `recipient`. The DSF
network enforces this from the `process-authorization` extension and the
allow-list; an unauthorized requester is rejected before the process starts.

## Example

```http
POST /fhir/Task
Content-Type: application/fhir+xml

<Task xmlns="http://hl7.org/fhir">
  <meta>
    <profile value="http://example.org/fhir/StructureDefinition/task-start-hello-dsf|1.0"/>
  </meta>
  <instantiatesCanonical value="http://example.org/bpe/Process/helloDsfProcess|1.0"/>
  <status value="requested"/>
  <intent value="order"/>
  <requester>
    <identifier>
      <system value="http://dsf.dev/sid/organization-identifier"/>
      <value value="requester.example.org"/>
    </identifier>
  </requester>
  <restriction>
    <recipient>
      <identifier>
        <system value="http://dsf.dev/sid/organization-identifier"/>
        <value value="recipient.example.org"/>
      </identifier>
    </recipient>
  </restriction>
  <input>
    <type>
      <coding>
        <system value="http://dsf.dev/fhir/CodeSystem/bpmn-message"/>
        <code value="message-name"/>
      </coding>
    </type>
    <valueString value="startHelloDsf"/>
  </input>
  <input>
    <type>
      <coding>
        <system value="http://example.org/fhir/CodeSystem/example"/>
        <code value="hello-input"/>
      </coding>
    </type>
    <valueString value="world"/>
  </input>
</Task>
```
