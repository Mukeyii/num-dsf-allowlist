/*
 * SendHelloMessage — the BPMN message-end event that sends the outbound Task.
 *
 * Implements the v2 MessageEndEvent interface. The default execute() (inherited)
 * builds and sends the Task from the BPMN camunda:fields (instantiatesCanonical,
 * profile, messageName) and the current Target — no code needed for the send.
 * This class only overrides getAdditionalInputParameters to attach one
 * hello-input Task input to the outbound message.
 */
package org.example.process.message;

import java.util.List;

import org.example.process.ConstantsExample;
import org.hl7.fhir.r4.model.Task;

import dev.dsf.bpe.v2.ProcessPluginApi;
import dev.dsf.bpe.v2.activity.MessageEndEvent;
import dev.dsf.bpe.v2.variables.SendTaskValues;
import dev.dsf.bpe.v2.variables.Target;
import dev.dsf.bpe.v2.variables.Variables;

public class SendHelloMessage implements MessageEndEvent
{
	@Override
	public List<Task.ParameterComponent> getAdditionalInputParameters(ProcessPluginApi api, Variables variables,
			SendTaskValues sendTaskValues, Target target)
	{
		// Attach a single hello-input parameter to the outbound Task. The version
		// suffix on the coding is the resource version (e.g. "1.0").
		Task.ParameterComponent helloInput = api.getTaskHelper().createInput("Hello from example.org",
				ConstantsExample.CODESYSTEM_EXAMPLE, ConstantsExample.CODESYSTEM_EXAMPLE_VALUE_HELLO_INPUT,
				api.getProcessPluginDefinition().getResourceVersion());

		return List.of(helloInput);
	}
}
