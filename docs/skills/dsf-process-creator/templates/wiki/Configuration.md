# Configuration

The plugin is configured through environment variables read by the BPE at
startup. The table below can be regenerated from the source annotations with:

```bash
mvn dsf-maven-plugin:generate-config-doc
```

That goal reads the `@ProcessDocumentation` annotations on the plugin's
`@Value`-injected fields and emits this markdown.

## Options

| Environment variable | Type | Default | Required | Description |
|---|---|---|---|---|
| `ORG_EXAMPLE_PROCESS_SPECIAL` | boolean | `false` | no | Enables the example's optional special handling in the service task. Bound in code via `@Value("${org.example.process.special:false}")`. |

## Notes

- Environment-variable names are the uppercased, underscore-separated form of
  the Spring property path: property `org.example.process.special` →
  `ORG_EXAMPLE_PROCESS_SPECIAL`.
- Values default as shown; only set a variable to override its default.
- DSF resource placeholders of the form `#{property.name}` are substituted by
  the BPE from the matching environment variable (`PROPERTY_NAME`) at deploy
  time.
