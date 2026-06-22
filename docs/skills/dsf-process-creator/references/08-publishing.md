# Publishing

A released plugin can be listed in two places: the curated **hub.dsf.dev**
directory and this allow-list portal's **Marketplace**. They are independent —
do both for maximum reach.

## hub.dsf.dev (manual listing)

hub.dsf.dev is a manually curated directory. There is no API and no manifest
file. Submit a listing by email to **dsf-gecko@hs-heilbronn.de** with:

- process name;
- a short description;
- the GitHub repository URL;
- the license;
- DSF version compatibility (the API version the plugin was built against, e.g.
  `2.1.0`);
- maintainer contact.

The hub editors review the submission and add it to https://hub.dsf.dev.

## Allow-list portal Marketplace (`dsf-marketplace.json`)

This portal's Marketplace v2 ingests an **optional** `dsf-marketplace.json` file
placed at the **repository root on the default branch**. The portal re-reads it
on a daily sync (`parseManifest`); no submission step is required — committing
the file is the submission.

### Strict schema

The manifest is parsed with a `.strict()` schema: **any unknown key rejects the
entire file**. Only these five keys are allowed, and every field is optional:

| Key | Type & constraints |
|---|---|
| `processIdentifiers` | array of strings, each 1–255 chars, max 20 entries |
| `dsfVersionMin` | string matching `^\d+\.\d+(\.\d+)?$` |
| `requiredRoles` | array of strings, each matching `^[A-Z][A-Z0-9_]{1,15}$`, max 15 entries |
| `messageNames` | array of strings, each 1–255 chars, max 30 entries |
| `artifactUrl` | URL string, must start with `https://github.com/`, max 500 chars |

The file must be valid JSON with no comments. Template:
`templates/dsf-marketplace.json`.

```json
{
  "processIdentifiers": ["example_helloDsfProcess"],
  "dsfVersionMin": "2.1.0",
  "requiredRoles": ["DIC"],
  "messageNames": ["startHelloDsf", "helloRecipient"],
  "artifactUrl": "https://github.com/OWNER/example-process/releases/latest"
}
```

`processIdentifiers` are the BPMN process ids the plugin contributes;
`messageNames` are the routing message names (the BPMN start/throw message
names); `artifactUrl` points at the release download (the `releases/latest`
page is stable across versions).

## Publish checklist

1. Plugin is tagged and a GitHub Release exists with the
   `example-process-<version>.jar` and its `.jar.sha256`.
2. The jar is deployed to GitHub Packages.
3. The wiki pages (Home / Description / Configuration / Starting / Results) are
   published.
4. `dsf-marketplace.json` is committed to the **repo root on the default
   branch** with only the five allowed keys, and validates as JSON.
5. `artifactUrl` resolves (`https://github.com/<owner>/<repo>/releases/latest`).
6. The hub.dsf.dev submission email is sent to dsf-gecko@hs-heilbronn.de.
