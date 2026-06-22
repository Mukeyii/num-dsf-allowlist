/*
 * ConstantsExample — single home for the canonical strings this plugin reuses.
 *
 * Process id, URLs, message names, Task profiles, CodeSystem/ValueSet URLs and
 * the organization identifier system are pinned here so Java code, BPMN and FHIR
 * stay in sync. Changing any of these means changing it in the BPMN and FHIR too.
 */
package org.example.process;

public final class ConstantsExample
{
	private ConstantsExample()
	{
	}

	// BPMN process id (= process key, = getFhirResourcesByProcessId map key).
	public static final String PROCESS_NAME_FULL = "example_helloDsfProcess";

	// ActivityDefinition.url / instantiatesCanonical base.
	public static final String PROCESS_URL = "http://example.org/bpe/Process/helloDsfProcess";

	// Message names: inbound start event and outbound send event.
	public static final String MESSAGE_NAME_START_HELLO_DSF = "startHelloDsf";
	public static final String MESSAGE_NAME_HELLO_RECIPIENT = "helloRecipient";

	// Task profiles for the inbound and outbound messaging Tasks.
	public static final String PROFILE_TASK_START_HELLO_DSF = "http://example.org/fhir/StructureDefinition/task-start-hello-dsf";
	public static final String PROFILE_TASK_HELLO_RECIPIENT = "http://example.org/fhir/StructureDefinition/task-hello-recipient";

	// CodeSystem + concept code carried as the hello-input Task input.
	public static final String CODESYSTEM_EXAMPLE = "http://example.org/fhir/CodeSystem/example";
	public static final String CODESYSTEM_EXAMPLE_VALUE_HELLO_INPUT = "hello-input";

	// ValueSet bound to the hello-input input.
	public static final String VALUESET_EXAMPLE = "http://example.org/fhir/ValueSet/example";

	// DSF organization identifier system (used for targets and authorization).
	public static final String ORGANIZATION_IDENTIFIER_SYSTEM = "http://dsf.dev/sid/organization-identifier";
}
