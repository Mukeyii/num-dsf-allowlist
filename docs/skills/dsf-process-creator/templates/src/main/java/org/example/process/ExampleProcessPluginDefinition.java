/*
 * ExampleProcessPluginDefinition — the v2 SPI entry point for this plugin.
 *
 * The BPE discovers this class via
 * META-INF/services/dev.dsf.bpe.v2.ProcessPluginDefinition and reads it to learn
 * what the plugin contains. By extending AbstractProcessPluginDefinition, name,
 * version, release date, title, publisher and publisher-email come from
 * plugin.properties (filtered by Maven). This class only declares the three
 * "what is in this plugin" methods: the BPMN models, the FHIR resources per
 * process id, and the Spring @Configuration classes.
 */
package org.example.process;

import java.util.List;
import java.util.Map;

import org.example.process.spring.config.ExampleConfig;

import dev.dsf.bpe.v2.AbstractProcessPluginDefinition;

public class ExampleProcessPluginDefinition extends AbstractProcessPluginDefinition
{
	@Override
	public List<String> getProcessModels()
	{
		return List.of("bpe/hello-dsf.bpmn");
	}

	@Override
	public Map<String, List<String>> getFhirResourcesByProcessId()
	{
		// Key = BPMN process id. Value = the FHIR conformance resources this
		// process deploys (paths relative to the jar root).
		return Map.of(ConstantsExample.PROCESS_NAME_FULL,
				List.of("fhir/ActivityDefinition/hello-dsf.xml",
						"fhir/StructureDefinition/task-start-hello-dsf.xml",
						"fhir/StructureDefinition/task-hello-recipient.xml",
						"fhir/Task/task-start-hello-dsf.xml",
						"fhir/CodeSystem/example.xml",
						"fhir/ValueSet/example.xml"));
	}

	@Override
	public List<Class<?>> getSpringConfigurations()
	{
		return List.of(ExampleConfig.class);
	}
}
