# Authorization model

Process authorization answers two questions per message: **who may request**
(send a `Task` that starts/advances the process) and **who may be the
recipient** (run it). It is declared as an extension on the `ActivityDefinition`
and enforced by the BPE on every inbound `Task`.

## The process-authorization extension

The extension URL is
`http://dsf.dev/fhir/StructureDefinition/extension-process-authorization`. One
extension instance authorizes **one message** of the process; add one per
message-name you want to authorize. Its sub-extensions:

| Sub-extension | Type | Meaning |
|---|---|---|
| `message-name` | `valueString` | the message this rule governs (e.g. `startHelloDsf`) — must match the BPMN message `name` and the Task `message-name` input |
| `task-profile` | `valueCanonical` | the Task profile that must be used, with version suffix (`…/task-start-hello-dsf\|#{version}`) |
| `requester` | `valueCoding` (1..*) | who may send/request |
| `recipient` | `valueCoding` (1..*) | who may receive/run |

```xml
<extension url="http://dsf.dev/fhir/StructureDefinition/extension-process-authorization">
  <extension url="message-name">
    <valueString value="startHelloDsf" />
  </extension>
  <extension url="task-profile">
    <valueCanonical value="http://example.org/fhir/StructureDefinition/task-start-hello-dsf|#{version}" />
  </extension>
  <extension url="requester"> … </extension>
  <extension url="recipient"> … </extension>
</extension>
```

## The process-authorization CodeSystem

The `requester`/`recipient` `valueCoding`s draw from CodeSystem
`http://dsf.dev/fhir/CodeSystem/process-authorization`
(`dev.dsf.bpe.v2.constants.CodeSystems.ProcessAuthorization.Codes`). The codes
combine a **scope** (`LOCAL`/`REMOTE`) with a **breadth**
(`ORGANIZATION`/`ROLE`/`ALL`), optionally `_PRACTITIONER`:

| Code | Scope | Who |
|---|---|---|
| `LOCAL_ORGANIZATION` | LOCAL | a specific own/local organization |
| `LOCAL_ORGANIZATION_PRACTITIONER` | LOCAL | a practitioner (human, web UI) at a local org |
| `REMOTE_ORGANIZATION` | REMOTE | a specific remote allow-listed organization |
| `LOCAL_ROLE` | LOCAL | local orgs holding a role |
| `LOCAL_ROLE_PRACTITIONER` | LOCAL | a practitioner in a local role |
| `REMOTE_ROLE` | REMOTE | remote orgs holding a role |
| `LOCAL_ALL` | LOCAL | any local org |
| `LOCAL_ALL_PRACTITIONER` | LOCAL | any local practitioner |
| `REMOTE_ALL` | REMOTE | any remote allow-listed org |

- **LOCAL** = the same organization/instance that runs this BPE (a process that
  starts itself, or a local human).
- **REMOTE** = a different allow-listed organization across the network.

`ALL` codes need no further refinement. `ORGANIZATION` and `ROLE` codes carry a
nested extension that names *which* org or role.

## Scoping the coding

### Organization-scoped

Nested extension
`http://dsf.dev/fhir/StructureDefinition/extension-process-authorization-organization`,
`valueIdentifier`, system `http://dsf.dev/sid/organization-identifier`:

```xml
<extension url="recipient">
  <valueCoding>
    <system value="http://dsf.dev/fhir/CodeSystem/process-authorization" />
    <code value="LOCAL_ORGANIZATION" />
    <extension url="http://dsf.dev/fhir/StructureDefinition/extension-process-authorization-organization">
      <valueIdentifier>
        <system value="http://dsf.dev/sid/organization-identifier" />
        <value value="recipient.example.org" />
      </valueIdentifier>
    </extension>
  </valueCoding>
</extension>
```

Reads: *the local organization `recipient.example.org` may run this process.*

### Role-scoped

For `*_ROLE` codes, the nested extension carries an organization-role coding
(the consortium role the org must hold) instead of an org identifier.

### Practitioner-scoped

For `*_PRACTITIONER` codes, nested extension
`http://dsf.dev/fhir/StructureDefinition/extension-process-authorization-practitioner`,
`valueCoding` from CodeSystem
`http://dsf.dev/fhir/CodeSystem/practitioner-role` (e.g. `DSF_ADMIN`). Used when
a human triggers the process through the DSF web UI rather than an org-to-org
`Task`.

```xml
<extension url="requester">
  <valueCoding>
    <system value="http://dsf.dev/fhir/CodeSystem/process-authorization" />
    <code value="LOCAL_ORGANIZATION_PRACTITIONER" />
    <extension url="http://dsf.dev/fhir/StructureDefinition/extension-process-authorization-organization">
      <valueIdentifier>
        <system value="http://dsf.dev/sid/organization-identifier" />
        <value value="requester.example.org" />
      </valueIdentifier>
    </extension>
    <extension url="http://dsf.dev/fhir/StructureDefinition/extension-process-authorization-practitioner">
      <valueCoding>
        <system value="http://dsf.dev/fhir/CodeSystem/practitioner-role" />
        <code value="DSF_ADMIN" />
      </valueCoding>
    </extension>
  </valueCoding>
</extension>
```

Reads: *a `DSF_ADMIN` practitioner at local org `requester.example.org` may start it.*

### Open requester

```xml
<extension url="requester">
  <valueCoding>
    <system value="http://dsf.dev/fhir/CodeSystem/process-authorization" />
    <code value="REMOTE_ALL" />
  </valueCoding>
</extension>
```

Reads: *any remote allow-listed organization may request this process.* No
nested extension is needed for `*_ALL`.

## Read-access tags are orthogonal

Process authorization (who may *run* the process) is independent of read-access
tags (who may *read* a conformance resource). A resource can be readable by
`ALL` while its process accepts requests only from a single org. Read-access
tags live in `meta.tag`, system
`http://dsf.dev/fhir/CodeSystem/read-access-tag`; see `03-fhir-resources.md`.

## Runtime helpers

- `api.getProcessAuthorizationHelper()` — build and read process-authorization
  codings/extensions programmatically.
- `api.getReadAccessHelper()` — read and set read-access tags.

Use these from Java rather than hand-assembling extensions when you need to
construct authorization at runtime; the XML above is what the static
`ActivityDefinition` resource declares at deploy time.
