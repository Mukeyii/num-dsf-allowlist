# Results

`example_helloDsfProcess` produces an outbound FHIR `Task` sent to the
recipient (next-hop) organization. It writes no persistent records of its own
beyond the BPE's process history and the FHIR Tasks exchanged.

## What the process produces

When the process reaches its message end event it sends a `Task` to the target
organization:

| Field | Value |
|---|---|
| `Task.instantiatesCanonical` | `http://example.org/bpe/Process/helloDsfProcess|1.0` |
| `Task.meta.profile` | `http://example.org/fhir/StructureDefinition/task-hello-recipient|1.0` |
| `message-name` input | `helloRecipient` |
| `business-key` input | the process instance's business key (for correlation) |

The recipient organization's BPE receives this Task and matches it to its own
`helloRecipient` catch event.

## Where to observe it

- **Sender's FHIR server** — the outbound `Task` is created on the sending
  organization's DSF FHIR server; query `Task?identifier=...` or filter by the
  business key.
- **Recipient's FHIR server** — the same Task is delivered to the recipient and
  visible there once accepted.
- **BPE process history** — the Camunda history on the sending BPE shows the
  completed `example_helloDsfProcess` instance, its variables, and the activity
  path (`startHelloDsf` → `HelloDsfService` → `helloRecipient`).
- **Process logs** — the BPE logs record the start, the service task execution,
  and the outbound send.

## Failure cases

If the recipient is not allow-listed, not authorized, or unreachable, the send
fails and the process instance records the error (visible in BPE history and
logs). The pluggable per-activity error handler determines whether the failure
is retried or terminates the instance.
