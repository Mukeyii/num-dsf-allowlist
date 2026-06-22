# 05 · Implement the Java activities (v2)

In API v2, BPMN activities are Java classes that **implement an interface** from
`dev.dsf.bpe.v2.activity.*`. There is no abstract base to extend and no `api`
field — the `ProcessPluginApi` is passed as a method parameter on each call.
Every activity class must be a prototype-scoped Spring bean (see
`references/01-scaffold.md`).

All activity interfaces extend a marker `Activity`, which carries a pluggable
`getErrorHandler()`.

## ServiceTask

A `serviceTask` in the BPMN (`camunda:class="…HelloDsfService"`) maps to a class
implementing `dev.dsf.bpe.v2.activity.ServiceTask`:

```java
public interface ServiceTask extends Activity {
  void execute(ProcessPluginApi api, Variables variables) throws ErrorBoundaryEvent, Exception;
  default ServiceTaskErrorHandler getErrorHandler() { return new DefaultServiceTaskErrorHandler(); }
}
```

`execute` receives the injected `api` and the process `variables`. Typical body:

- **Read an input** from the starting Task:
  ```java
  String value = api.getTaskHelper()
      .getFirstInputParameterStringValue(variables.getStartTask(),
          CODESYSTEM_EXAMPLE, "hello-input");
  ```
- **Read the recipient** the inbound Task addressed:
  ```java
  String recipient = variables.getStartTask()
      .getRestriction().getRecipientFirstRep().getIdentifier().getValue();
  ```
- **Set the next hop** (the org the message-end event will send to) as a
  `Target` on the variables:
  ```java
  Target target = variables.createTarget(
      "recipient.example.org", "recipient.example.org_Endpoint",
      "https://recipient.example.org/fhir");
  variables.setTarget(target);
  ```

`templates/.../service/HelloDsfService.java` shows this end to end with comments
on why each step exists.

## MessageEndEvent / MessageSendTask / MessageIntermediateThrowEvent

These three send a FHIR `Task` to another organization. They share the base
`MessageActivity`:

```java
public interface MessageActivity extends Activity {
  default void execute(ProcessPluginApi api, Variables variables, SendTaskValues sendTaskValues) throws Exception {
    getTaskSender(api, variables, sendTaskValues).send();
  }
  default BusinessKeyStrategy getBusinessKeyStrategy() { return BusinessKeyStrategies.SAME; }
  default List<Task.ParameterComponent> getAdditionalInputParameters(
      ProcessPluginApi api, Variables variables, SendTaskValues sendTaskValues, Target target) {
    return List.of();
  }
}
```

- **Zero-code default send.** The simplest send is empty:
  `public class SendHelloMessage implements MessageEndEvent {}`. The default
  `execute` builds and sends the outbound Task from the BPMN `camunda:field`s
  (`instantiatesCanonical`, `profile`, `messageName`) and the current `Target`.
- **Adding inputs.** Override `getAdditionalInputParameters(...)` to attach Task
  inputs, building each via
  `api.getTaskHelper().createInput(value, system, code, api.getProcessPluginDefinition().getResourceVersion())`.
  `templates/.../message/SendHelloMessage.java` attaches one `hello-input`.
- **`BusinessKeyStrategies.SAME`** (the default) keeps the same business key as
  the running instance, so request and response correlate.

## Receiving

There is no "receive" class — receiving is the message start (or intermediate
catch) event in the recipient's BPMN. The plugin reads the inbound Task via
`variables.getStartTask()` / `variables.getLatestTask()`.

## Variables (`dev.dsf.bpe.v2.variables.Variables`)

- Typed get/set: `getString`/`getBoolean`/`getInteger`/… plus `*Local`
  variants, `getVariable`/`setJsonVariable`.
- FHIR-aware: `get/setFhirResource[List]`.
- Task access: `getStartTask`/`getLatestTask`/`getTasks`/`getCurrentTasks`/
  `updateTask`/`getStartTaskUpdater`.
- Targets: `createTarget(orgId, endpointId, endpointAddress[, correlationKey])`,
  `set/getTarget`, `createTargets`, `set/getTargets`.
- Business key: `getBusinessKey`, `setAlternativeBusinessKey`.

## ProcessPluginApi surface

Accessors include `getProcessPluginDefinition`, `getEndpointProvider`,
`getFhirContext`, `getDsfClientProvider`, `getFhirClientProvider`,
`getMailService`, `getObjectMapper`, `getOrganizationProvider`,
`getProcessAuthorizationHelper`, `getQuestionnaireResponseHelper`,
`getReadAccessHelper`, `getTaskHelper`, `getCryptoService`,
`getTargetProvider`, `getDataLogger`, `getValidationServiceProvider`.
Supporting interfaces live in `dev.dsf.bpe.v2.service.*`; clients in
`dev.dsf.bpe.v2.client.{dsf,fhir,oidc}`.

## Error handling

`execute(...)` may throw `dev.dsf.bpe.v2.error.ErrorBoundaryEvent` to trigger a
BPMN error boundary event. Each activity has a pluggable `getErrorHandler()`
(`Default*ErrorHandler` implementations in `dev.dsf.bpe.v2.error.impl`). Other
extension hooks: `dev.dsf.bpe.v2.fhir.FhirResourceModifier`,
`ProcessPluginDeploymentListener`, `ExecutionListener`, `UserTaskListener`.

## v1 → v2 migration

If you are porting a v1 plugin, the activity layer changes shape. The structural
mapping:

| v1 | v2 |
|---|---|
| extend `AbstractServiceDelegate`, override `doExecute(DelegateExecution, Variables)` | implement `ServiceTask`, override `execute(ProcessPluginApi, Variables)` |
| extend `AbstractTaskMessageSend` | implement `MessageEndEvent` / `MessageSendTask` / `MessageIntermediateThrowEvent` (often zero-code) |
| throw `org.camunda.bpm.engine.delegate.BpmnError` | throw `dev.dsf.bpe.v2.error.ErrorBoundaryEvent` (plus pluggable `getErrorHandler()`) |
| `api` as a `protected final` field | `api` as a method parameter, injected per call |
| SPI `META-INF/services/dev.dsf.bpe.v1.ProcessPluginDefinition`, packages `dev.dsf.bpe.v1.*` | SPI `…dev.dsf.bpe.v2.ProcessPluginDefinition`, packages `dev.dsf.bpe.v2.*` |

Practical notes when migrating:

- Replace every `dev.dsf.bpe.v1.*` import with its `dev.dsf.bpe.v2.*` equivalent;
  rename the SPI file to the v2 interface FQN.
- A `doExecute` body moves almost verbatim into `execute`, but `this.api`
  becomes the `api` parameter and `getExecution()`-style access is replaced by
  the `variables` parameter and `ProcessPluginApi` accessors.
- A v1 `AbstractTaskMessageSend` subclass that only configured the send usually
  collapses to a zero-code `MessageEndEvent`, or an
  `getAdditionalInputParameters` override for its extra Task inputs.
- The plugin can mix neither API — one plugin is wholly v1 or wholly v2.
