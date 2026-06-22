# GitHub repository, CI, release & wiki

This covers everything between a working plugin and a downloadable, installable
release: versioning, the git-flow branch model, the CI workflow, building the
jar and its checksum, cutting a GitHub Release, deploying to GitHub Packages,
and the wiki.

## Versioning

A plugin version is **4-part** `MAJOR.MINOR.PATCH.BUILD`, matching
`(\d+\.\d+)\.\d+\.\d+`. The canonical example is `1.0.0.0` (use
`1.0.0.0-SNAPSHOT` while developing; the BPE strips `-SNAPSHOT` at load).

The **resource version** is the first two segments only — `1.0` for `1.0.0.0`.
It is what substitutes `#{version}` in BPMN and FHIR resources and forms the
`|version` suffix on every canonical URL (for example
`http://example.org/bpe/Process/helloDsfProcess|1.0`). Bumping `PATCH` or
`BUILD` does **not** change the resource version; bumping `MAJOR` or `MINOR`
does.

Set `project.build.outputTimestamp` and `project.build.sourceEncoding=UTF-8` in
`pom.xml` for reproducible builds — the timestamp is also the source of the
plugin's `release-date`.

## Git-flow branches

| Branch | Role |
|---|---|
| `main` | Released code; every release is tagged here |
| `develop` | Integration branch for the next release |
| `feature/*` | One branch per feature, merged into `develop` |
| `release/*` | Stabilization before a release, merged into `main` and `develop` |
| `hotfix/*` | Urgent fixes off `main`, merged back into `main` and `develop` |

Tags are `vMAJOR.MINOR.PATCH.BUILD`, e.g. `v1.0.0.0`. The CI release job is
triggered by pushing a `v*` tag.

## CI workflow

The GitHub Actions workflow (template: `templates/github/ci.yml`, copy to
`.github/workflows/ci.yml`) has two responsibilities:

1. **On push / pull request** — set up JDK 17 (temurin) with a Maven cache and
   run `mvn -B verify` (compile + all fast test layers).
2. **On a `v*` tag** — build the jar, compute its SHA-256, create a GitHub
   Release with the jar and checksum as assets, then deploy to GitHub Packages.

Default the top-level `permissions:` block to `contents: read` and grant
`contents: write` (to create the release) and `packages: write` (to publish)
only on the tag-gated release job. Pin third-party actions to a full commit SHA
(not just a floating major tag) so a moved tag cannot change what runs.

## Building the jar and its checksum

The build output is a plain JAR named `example-process-<version>.jar`
(`<finalName>example-process-${project.version}</finalName>` — not a shaded
fat-jar). Each release ships the jar **and** a sibling `.sha256` file:

```bash
mvn -B -DskipTests package
sha256sum target/example-process-1.0.0.0.jar > target/example-process-1.0.0.0.jar.sha256
```

The `.sha256` lets operators verify the downloaded artifact before deploying it
to a BPE.

## GitHub Release

Create one Release per version tag, attaching both assets:

- `example-process-<version>.jar`
- `example-process-<version>.jar.sha256`

Release notes summarize the changes and state the **DSF API version** the plugin
was compiled against (the `dsf.version` property, e.g. `2.1.0`). In CI this is
done with `softprops/action-gh-release` or `gh release create`.

## GitHub Packages

`pom.xml` declares `distributionManagement` with id `github` pointing at
`https://maven.pkg.github.com/<owner>/<repo>`. The release job runs:

```bash
mvn -B deploy
```

authenticated with the workflow's `GITHUB_TOKEN` (mapped to the `github` server
id via `settings.xml` or the `setup-java` server configuration). This publishes
the jar to the repository's package registry so other Maven builds can depend on
it.

## Wiki

The wiki is a separate git repository served from `<repo>.wiki.git`, with one
page per concern (mirroring the `dsf-process-ping-pong` and
`mii-process-report` wikis). Templates live in `templates/wiki/`:

| Page | Contents |
|---|---|
| `Home` | Overview, version/compatibility table, links to the other pages |
| `Description` | What each process does — the BPMN flow and message flow |
| `Configuration` | Env-var configuration table (paste from `dsf-maven-plugin generate-config-doc`) |
| `Starting` | How to trigger the process: the start Task, required inputs, authorization |
| `Results` | What the process produces and where to observe it |

To publish, clone `<repo>.wiki.git`, copy in the rendered pages, and push.
