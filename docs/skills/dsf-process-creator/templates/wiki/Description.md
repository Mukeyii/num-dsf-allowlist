# Description

`example_helloDsfProcess` is a single process that exercises the full
request→service→response pattern of DSF messaging: it is started by an inbound
FHIR `Task`, runs one service task, and sends an outbound `Task` to a recipient
organization.

## Message flow

```
requester org                         this org (recipient of the start)        next-hop org
     │                                        │                                     │
     │  Task (message-name: startHelloDsf)    │                                     │
     ├───────────────────────────────────────▶                                     │
     │                                 ┌───────┴────────┐                           │
     │                                 │ message start  │  startHelloDsf            │
     │                                 │   event        │                           │
     │                                 ├────────────────┤                           │
     │                                 │ service task   │  HelloDsfService          │
     │                                 │ (reads input,  │                           │
     │                                 │  sets target)  │                           │
     │                                 ├────────────────┤                           │
     │                                 │ message end    │  helloRecipient           │
     │                                 │   event        ├──── Task ──────────────────▶
     │                                 └────────────────┘                           │
```

## Steps

1. **Start (`startHelloDsf`).** An incoming FHIR `Task` whose
   `instantiatesCanonical` is `http://example.org/bpe/Process/helloDsfProcess|1.0`
   and whose `message-name` input is `startHelloDsf` matches the process's
   message start event and creates a process instance. The Task must conform to
   the start Task profile and carry a `hello-input` input parameter.

2. **Service task (`HelloDsfService`).** Reads the `hello-input` value from the
   start Task, determines the recipient organization, and sets the next-hop
   `Target` (organization identifier, endpoint identifier, endpoint address).

3. **Send (`helloRecipient`).** The message end event builds and sends a FHIR
   `Task` to the target organization. That Task carries `message-name`
   `helloRecipient` and the outbound Task profile, instructing the recipient's
   BPE to continue.

## Authorization

Who may send `startHelloDsf` and who may receive it is declared on the process's
ActivityDefinition via the DSF `process-authorization` extension (requester and
recipient codings, scoped by organization, role, or practitioner). See the
plugin's ActivityDefinition for the exact requester/recipient configuration.
