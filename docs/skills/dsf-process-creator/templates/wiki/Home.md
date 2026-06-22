# example-process

A minimal DSF (Data Sharing Framework) process plugin. It demonstrates a single
process, `example_helloDsfProcess`, that catches an inbound `startHelloDsf`
message, runs a service task, and sends a `helloRecipient` message to another
organization.

This plugin is a single JAR deployed on an organization's DSF Business Process
Engine (BPE).

## Pages

- [Description](Description) — what the process does and its message flow
- [Configuration](Configuration) — environment-variable options
- [Starting](Starting) — how to trigger the process
- [Results](Results) — what the process produces

## Version & compatibility

| Plugin version | Resource version | DSF API version | Release |
|---|---|---|---|
| `1.0.0.0` | `1.0` | `2.1.0` | see [Releases](../../releases) |

The plugin version is 4-part `MAJOR.MINOR.PATCH.BUILD`. The resource version is
the first two segments (`1.0`) and is what suffixes the canonical URLs
(`…|1.0`). "DSF API version" is the `dev.dsf:dsf-bpe-process-api-v2` version the
jar was compiled against.

## Install

Download `example-process-<version>.jar` from the
[latest release](../../releases/latest), verify it against the published
`.jar.sha256`, and place it in the BPE's process plugin directory.

## License

Apache-2.0.
