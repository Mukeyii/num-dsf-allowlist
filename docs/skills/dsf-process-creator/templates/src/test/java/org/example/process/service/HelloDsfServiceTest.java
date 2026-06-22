/*
 * HelloDsfServiceTest — unit test for the hello-dsf service task.
 *
 * Mocks ProcessPluginApi, TaskHelper and Variables (Mockito). Stubs the start
 * Task and its hello-input value, then verifies the service reads the input and
 * sets a Target addressed to the recipient organization.
 */
package org.example.process.service;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import org.hl7.fhir.r4.model.Identifier;
import org.hl7.fhir.r4.model.Reference;
import org.hl7.fhir.r4.model.Task;
import org.hl7.fhir.r4.model.Task.TaskRestrictionComponent;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.mockito.Mock;
import org.mockito.junit.MockitoJUnitRunner;

import dev.dsf.bpe.v2.ProcessPluginApi;
import dev.dsf.bpe.v2.service.TaskHelper;
import dev.dsf.bpe.v2.variables.Target;
import dev.dsf.bpe.v2.variables.Variables;

@RunWith(MockitoJUnitRunner.class)
public class HelloDsfServiceTest
{
	@Mock
	private ProcessPluginApi api;
	@Mock
	private TaskHelper taskHelper;
	@Mock
	private Variables variables;
	@Mock
	private Target target;

	private final HelloDsfService service = new HelloDsfService();

	private Task startTask;

	@Before
	public void setUp()
	{
		// A start Task whose recipient identifier is the recipient org.
		startTask = new Task();
		TaskRestrictionComponent restriction = startTask.getRestriction();
		restriction.addRecipient(new Reference().setIdentifier(
				new Identifier().setSystem("http://dsf.dev/sid/organization-identifier").setValue("recipient.example.org")));

		when(api.getTaskHelper()).thenReturn(taskHelper);
		when(variables.getStartTask()).thenReturn(startTask);
		when(taskHelper.getFirstInputParameterStringValue(eq(startTask), any(), any())).thenReturn("hello");
		when(variables.createTarget(eq("recipient.example.org"), eq("recipient.example.org_Endpoint"),
				eq("https://recipient.example.org/fhir"))).thenReturn(target);
	}

	@Test
	public void setsTargetToRecipient() throws Exception
	{
		service.execute(api, variables);

		verify(variables).createTarget("recipient.example.org", "recipient.example.org_Endpoint",
				"https://recipient.example.org/fhir");
		verify(variables).setTarget(target);
	}
}
