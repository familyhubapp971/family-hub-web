# scripts

Helper commands, grouped by job. Run every one from the repo root.

| Folder or file  | What it holds                                                                          |
| --------------- | -------------------------------------------------------------------------------------- |
| `dev`           | Starts the app locally                                                                 |
| `docs/`         | Builds the PDFs. `node scripts/docs/render-docs.mjs` renders every business document   |
| `docs/doc-src`  | The HTML source of each business document; edit these, never the PDFs                  |
| `docs/demo-src` | The source of the "what's shipped" demo page (`node scripts/docs/render-demo-pdf.mjs`) |
| `jira/`         | Keeps Jira and the Confluence board page in step after a ticket closes                 |
