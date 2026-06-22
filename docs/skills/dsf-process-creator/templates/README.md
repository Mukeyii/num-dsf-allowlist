# example-process

A minimal DSF (Data Sharing Framework) process plugin built against the
**API v2** (`dev.dsf:dsf-bpe-process-api-v2`). It implements one process,
`example_helloDsfProcess`, that catches an inbound FHIR `Task`, runs a service
task, and sends an outbound `Task` to another allow-listed organization.

Use it as a starting point: copy the tree, rename the canonical strings as a set,
and replace the `hello-input` logic with your own.

## Build

```
mvn package
```

This compiles against the `provided`-scoped DSF API, filters
`plugin.properties`, runs the tests, and produces the plugin jar at:

```
target/example-process-1.0.0.0-SNAPSHOT.jar
```

The jar is an ordinary JAR — the DSF API is supplied by the BPE at runtime and
is not bundled.

## Deploy to a BPE

Copy the built jar into the BPE's `process` directory:

```
cp target/example-process-1.0.0.0-SNAPSHOT.jar <bpe>/process/
```

On startup the BPE discovers the plugin via its SPI service file, reads
`ExampleProcessPluginDefinition`, and deploys the declared BPMN model and FHIR
resources.

## Documentation

- `doc/description.md` — what the process does and its message flow.
- `doc/configuration.md` — configuration options (auto-generated).
- `doc/license.md` — license.

## References

- DSF process development (API v2): https://dsf.dev/process-development/api-v2
- Project wiki: Home / Description / Configuration / Starting / Results.
