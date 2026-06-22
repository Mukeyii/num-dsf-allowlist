/*
 * HelloDsfService — the BPMN service task (camunda:class) of the hello-dsf process.
 *
 * Implements the v2 ServiceTask interface: the BPE injects ProcessPluginApi and
 * Variables on each call. It reads the hello-input value from the starting Task,
 * logs it, then sets the Target for the following message-end event so the
 * outbound Task is sent to the recipient organization.
 */
package org.example.process.service;

import org.example.process.ConstantsExample;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import dev.dsf.bpe.v2.ProcessPluginApi;
import dev.dsf.bpe.v2.activity.ServiceTask;
import dev.dsf.bpe.v2.error.ErrorBoundaryEvent;
import dev.dsf.bpe.v2.variables.Target;
import dev.dsf.bpe.v2.variables.Variables;

public class HelloDsfService implements ServiceTask
{
	private static final Logger logger = LoggerFactory.getLogger(HelloDsfService.class);

	@Override
	public void execute(ProcessPluginApi api, Variables variables) throws ErrorBoundaryEvent, Exception
	{
		// Read the hello-input parameter carried by the inbound (start) Task.
		String helloInput = api.getTaskHelper().getFirstInputParameterStringValue(variables.getStartTask(),
				ConstantsExample.CODESYSTEM_EXAMPLE, ConstantsExample.CODESYSTEM_EXAMPLE_VALUE_HELLO_INPUT);

		// Read which organization the inbound Task was addressed to (the recipient).
		String recipient = variables.getStartTask().getRestriction().getRecipientFirstRep().getIdentifier().getValue();

		logger.info("hello-dsf received '{}' for recipient {}", helloInput, recipient);

		// Set the next hop. The following message-end event (SendHelloMessage)
		// reads this Target to know where to send the outbound Task.
		Target target = variables.createTarget("recipient.example.org", "recipient.example.org_Endpoint",
				"https://recipient.example.org/fhir");
		variables.setTarget(target);
	}
}
