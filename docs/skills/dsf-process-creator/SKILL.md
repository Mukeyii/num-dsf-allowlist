---
name: dsf-process-creator
description: Use when working on a DSF (Data Sharing Framework) process plugin — a BPMN + FHIR + Java plugin that runs on a DSF Business Process Engine (BPE) and exchanges FHIR Task resources between allow-listed organizations. Triggers include a Maven module depending on dsf-bpe-process-api, a ProcessPluginDefinition or a META-INF/services/dev.dsf.bpe.v2 SPI file, FHIR ActivityDefinition/Task conformance resources, a dsf-marketplace.json, or a request to list a process on hub.dsf.dev. Not for operating a BPE or managing the allow-list itself.
---

# Creating a DSF Process Plugin (API v2)

## Overview

A **DSF process plugin** is a single JAR, deployed on an organization's DSF
**Business Process Engine (BPE)**, that bundles three things: a **BPMN 2.0**
process model (the orchestration), **FHIR R4** conformance resources (what
messages look like and who may send/receive them), and **Java** activity classes
(the logic). Organizations exchange FHIR `Task` resources to drive each other's
processes across the allow-listed network.

This skill takes you from empty directory to a published, releasable plugin:
**scaffold → model → FHIR → implement → test → repo → release → wiki → publish.**

## When to use

- Building a new DSF process (feasibility, data-transfer, reporting, ping/pong-style messaging).
- Adding a process to an existing plugin, or migrating a v1 plugin to v2.
- Setting up the GitHub repo, CI, releases, wiki, or hub.dsf.dev listing for a DSF process.

Not for: deploying/operating a BPE (see dsf.dev/operations), or managing the
allow-list itself (that is this portal).

## ⚠️ Decide v1 vs v2 FIRST

DSF ships **two** plugin APIs in parallel. Picking the wrong one means every
import, base class, and SPI file is wrong.

| Use **API v2** (this skill) when | Use API v1 when |
|---|---|
| New plugins; you want injected `ProcessPluginApi`, interface-based activities, the v2 error model | Maintaining an existing v1 plugin (e.g. `dsf-process-ping-pong`, which still uses the v1 SPI even on its 2.x line) |

v2 markers: artifact `dev.dsf:dsf-bpe-process-api-v2`, package `dev.dsf.bpe.v2.*`,
SPI file `META-INF/services/dev.dsf.bpe.v2.ProcessPluginDefinition`, activities
`implement` interfaces (`ServiceTask`, `MessageEndEvent`) rather than extending
`AbstractServiceDelegate`/`AbstractTaskMessageSend`. **If in doubt, use v2.**
Migration notes: `references/05-java-activities.md`.

## Quick reference — pin these strings

The templates use one consistent example throughout. When you adapt them,
change these together (a mismatch silently breaks routing):

| Thing | Example value | Appears in |
|---|---|---|
| artifactId / plugin name | `example-process` | pom, `plugin.properties`, jar |
| version (4-part) | `1.0.0.0` → resourceVersion `1.0` | pom, tags, `#{version}` |
| Java package | `org.example.process` | all `.java`, SPI file |
| BPMN process id (= key, = FHIR map key) | `example_helloDsfProcess` | BPMN, `getFhirResourcesByProcessId()` |
| Process URL | `http://example.org/bpe/Process/helloDsfProcess` | ActivityDefinition.url, `instantiatesCanonical` |
| start message name | `startHelloDsf` | BPMN start event, Task `message-name` input, auth |
| outbound message name | `helloRecipient` | BPMN end event, recipient profile |
| Task profile | `http://example.org/fhir/StructureDefinition/task-…` | StructureDefinition, BPMN `profile` field |
| CodeSystem / ValueSet | `http://example.org/fhir/{CodeSystem,ValueSet}/example` | FHIR, Java constants |
| org identifier system | `http://dsf.dev/sid/organization-identifier` | auth, targets |

Versioning: plugin version is **4-part** `MAJOR.MINOR.PATCH.BUILD`; the
**resource version** is the first two segments and is what substitutes
`#{version}` in BPMN/FHIR and suffixes every canonical URL (`…|1.0`).

## Workflow

Each step links to a reference file (detail + rationale) and a template under
`templates/`. Do them in order — later steps assume earlier files exist.

1. **Scaffold** the Maven project, `plugin.properties`, SPI file, the
   `ProcessPluginDefinition`, and the Spring `@Configuration`.
   → `references/01-scaffold.md` · `templates/pom.xml`, `templates/java/*`
2. **Model the BPMN**: message-start → service-task → message-end, with
   `camunda:class` and the `#{version}` tag.
   → `references/02-bpmn.md` · `templates/bpe/hello-dsf.bpmn`
3. **Author the FHIR**: ActivityDefinition, Task StructureDefinition(s),
   CodeSystem, ValueSet, a seed Task; add read-access tags and `#{…}` placeholders.
   → `references/03-fhir-resources.md` · `templates/fhir/*`
4. **Wire authorization** in the ActivityDefinition (requester/recipient, org or
   role or practitioner scoping).
   → `references/04-authorization.md`
5. **Implement the Java** activities as prototype-scoped Spring beans
   (`ServiceTask`, `MessageEndEvent`), reading inputs and setting `Target`s.
   → `references/05-java-activities.md` · `templates/java/*`
6. **Test**: plugin-definition, FHIR profile validation, Mockito service tests,
   optional Docker-Compose integration; run the DSF Linter.
   → `references/06-testing-local-dev.md` · `templates/test/*`
7. **GitHub repo**: init, git-flow branches, CI workflow, README,
   `doc/{description,configuration,license}.md`, `dsf-marketplace.json`.
   → `references/07-github-release-wiki.md` · `templates/github/*`, `templates/dsf-marketplace.json`
8. **Release**: tag, build jar + `.sha256`, GitHub Release, deploy to GitHub Packages.
   → `references/07-github-release-wiki.md` (release section)
9. **Wiki + publish**: Home/Description/Configuration/Starting/Results wiki pages;
   email hub.dsf.dev; ship `dsf-marketplace.json` so this portal's Marketplace lists it.
   → `references/08-publishing.md` · `templates/wiki/*`

## Common mistakes

- **Using the v1 SPI/base classes in a v2 plugin** (or vice-versa). One API only — see the decision table above.
- **Forgetting prototype scope.** Every BPMN activity class must be a prototype-scoped Spring bean, or the BPE reuses one instance across concurrent process instances. Use `ActivityPrototypeBeanCreator`.
- **`dsf-bpe-process-api-v2` not `provided`.** It is supplied by the BPE; bundling it (default/compile scope, or a shade plugin) breaks deployment. Build a plain JAR.
- **Mismatched routing strings.** The BPMN message `name`, the Task `message-name` input, the Task profile, and the `process-authorization` `message-name` must all agree. Change them as a set.
- **Wrong canonical version suffix.** `instantiatesCanonical`/`profile` use `…|#{version}` where `#{version}` is the **resource** version (`1.0`), not the 4-part plugin version.
- **Extra keys in `dsf-marketplace.json`.** The portal parses it with a strict schema; any unknown key rejects the whole file. Only `processIdentifiers`, `dsfVersionMin`, `requiredRoles`, `messageNames`, `artifactUrl`.
- **Leaking contact data or private keys.** Never commit certificates/keys; FHIR resources are public conformance artifacts.

## Templates

`templates/` is a complete, internally-consistent example plugin. Copy it,
rename the canonical strings (Quick reference table) as a set, and replace the
`hello-input` business logic with yours.
