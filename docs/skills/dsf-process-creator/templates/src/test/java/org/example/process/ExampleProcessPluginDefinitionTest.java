/*
 * ExampleProcessPluginDefinitionTest — asserts the plugin's declared contents.
 *
 * Checks the BPMN models, the FHIR-resources-by-process-id map and the Spring
 * configurations. The version/name/release-date come from plugin.properties via
 * AbstractProcessPluginDefinition, which depends on the filtered resource being
 * on the test classpath; getResourceVersion() ("1.0.0.0" -> "1.0") is asserted
 * only when that resource is present.
 */
package org.example.process;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;

import java.util.List;
import java.util.Map;

import org.example.process.spring.config.ExampleConfig;
import org.junit.Test;

import dev.dsf.bpe.v2.ProcessPluginDefinition;

public class ExampleProcessPluginDefinitionTest
{
	private final ProcessPluginDefinition definition = new ExampleProcessPluginDefinition();

	@Test
	public void processModels()
	{
		assertEquals(List.of("bpe/hello-dsf.bpmn"), definition.getProcessModels());
	}

	@Test
	public void fhirResourcesByProcessId()
	{
		Map<String, List<String>> resources = definition.getFhirResourcesByProcessId();

		assertEquals(1, resources.size());
		assertTrue(resources.containsKey("example_helloDsfProcess"));

		List<String> files = resources.get("example_helloDsfProcess");
		assertEquals(6, files.size());
		assertTrue(files.contains("fhir/ActivityDefinition/hello-dsf.xml"));
		assertTrue(files.contains("fhir/StructureDefinition/task-start-hello-dsf.xml"));
		assertTrue(files.contains("fhir/StructureDefinition/task-hello-recipient.xml"));
		assertTrue(files.contains("fhir/Task/task-start-hello-dsf.xml"));
		assertTrue(files.contains("fhir/CodeSystem/example.xml"));
		assertTrue(files.contains("fhir/ValueSet/example.xml"));
	}

	@Test
	public void springConfigurations()
	{
		assertEquals(List.of(ExampleConfig.class), definition.getSpringConfigurations());
	}

	@Test
	public void resourceVersionDerivedFromPluginVersion()
	{
		// Requires the filtered plugin.properties (version=1.0.0.0) on the
		// classpath. The resource version is the first two segments.
		assertEquals("1.0.0.0", definition.getVersion());
		assertEquals("1.0", definition.getResourceVersion());
	}
}
