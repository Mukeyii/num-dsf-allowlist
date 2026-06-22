/*
 * ExampleConfig — the plugin's Spring @Configuration, returned by
 * ExampleProcessPluginDefinition.getSpringConfigurations().
 *
 * Registers the BPMN activity classes as prototype-scoped beans (required so the
 * BPE does not reuse one instance across concurrent process instances) via
 * ActivityPrototypeBeanCreator. The @Value field demonstrates env-var config that
 * the dsf-maven-plugin generate-config-doc goal turns into configuration docs.
 */
package org.example.process.spring.config;

import org.example.process.message.SendHelloMessage;
import org.example.process.service.HelloDsfService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import dev.dsf.bpe.v2.documentation.ProcessDocumentation;
import dev.dsf.bpe.v2.spring.ActivityPrototypeBeanCreator;

@Configuration
public class ExampleConfig
{
	// Env var ORG_EXAMPLE_PROCESS_SPECIAL; default false. @ProcessDocumentation
	// makes generate-config-doc emit this option into doc/configuration.md.
	@ProcessDocumentation(description = "Enable special handling in the hello-dsf process.", //
			example = "true", //
			processNames = "example_helloDsfProcess")
	@Value("${org.example.process.special:false}")
	private boolean special;

	// Registers each activity class as a prototype bean (constructor-autowired,
	// bean name = lower-camel of the simple class name). Must be static.
	@Bean
	public static ActivityPrototypeBeanCreator activityPrototypeBeanCreator()
	{
		return new ActivityPrototypeBeanCreator(HelloDsfService.class, SendHelloMessage.class);
	}
}
