# Index

A design corpus your agent can read.

Index is a searchable catalog of design resources for designers, developers, and coding agents. Find a library, template, or reference through the interface, or query the same records through the public API.

[Browse Index](https://index.chele.bi) · [Catalog JSON](https://index.chele.bi/api/resources.json) · [MIT license](LICENSE)

## What is inside

- Component libraries, design systems, UI kits, and templates.
- Typography, icons, color tools, motion, textures, and other design assets.
- Inspiration galleries, design studios, designer portfolios, artists, and site references.
- Design tools for coding agents, with installation and integration details where available.
- Essays and learning resources with source links and concise summaries.

Resources connect to a shared vocabulary of components and app surfaces. You can search for a specific component, such as a command palette, or a surface, such as onboarding or checkout.

## Browse and compare

Use the grid for visual previews or the list for a compact overview. Filter by category, license, pricing, framework, distribution, or agent readiness. Sort by quality tier, name, or component count.

Resource pages combine source links with component coverage, pricing, license details, and evidence. Some pages also offer a structured prompt that you can copy into a coding agent. Unknown fields remain explicit instead of implying support.

The interface has a sidebar, a grid view with infinite loading, a pannable canvas view, hover previews, a keyboard search palette, and light and dark themes.

The Studios section lists design studios and agencies by discipline, and the Portfolios section lists personal designer sites. Both sections show the highest quality tier first. To add a studio, file its record in the `studios` category. To add a portfolio, file it in the `portfolios` category. A new subcategory in either category shows as a new group with no code change.

## Public data

The website and API use the same catalog. The endpoints are static, readable without an account or API key, and available directly over HTTPS.

| Endpoint | Contents |
| --- | --- |
| [resources.json](https://index.chele.bi/api/resources.json) | Complete resource records |
| [search.json](https://index.chele.bi/api/search.json) | Compact search index |
| [indexes.json](https://index.chele.bi/api/indexes.json) | Component and surface mappings, plus facet counts |
| [taxonomy.json](https://index.chele.bi/api/taxonomy.json) | Categories, kinds, facets, components, surfaces, and styles |
| [stats.json](https://index.chele.bi/api/stats.json) | Current catalog counts and build date |
| [showcase.json](https://index.chele.bi/api/showcase.json) | Site references and screenshot metadata |
| [showcase-indexes.json](https://index.chele.bi/api/showcase-indexes.json) | Typeface and color indexes across site references |
| [items.json](https://index.chele.bi/api/items.json) | Single shadcn registry items with their component, surface, and install command |
| [r/&lt;id&gt;.json](https://index.chele.bi/api/r/shadcn-ui.json) | One record with its registry items and install commands |
| [components/&lt;component&gt;.json](https://index.chele.bi/api/components/date-picker.json) | One component: its checklist, states, ARIA pattern, and best implementations |
| [skill/SKILL.md](https://index.chele.bi/api/skill/SKILL.md) | An agent skill that tells an agent when and how to search Index |
| [llms.txt](https://index.chele.bi/llms.txt) | Catalog context for language models |
| [sitemap.xml](https://index.chele.bi/sitemap.xml) | Public page URLs |

Use [catalog statistics](https://index.chele.bi/api/stats.json) for current counts.

A record links another page of the same product with `sameAs`, and a part of a larger collection with `partOf`. `registryUrl` holds only shadcn registry URLs. `machineUrls` lists other machine endpoints by kind: an MCP server, an API, an llms.txt file, a sitemap, a feed, or a catalog. In `taxonomy.json`, a facet value can list the values it `accepts`, so a Next.js filter also matches React libraries. Each record also carries `signals` from npm and GitHub: stars, weekly downloads, the last release, the last push, and the archive and deprecation state.

`npm run enrich` refreshes those signals. It reads npm, GitHub, each registry file, `llms.txt` and `sitemap.xml` on each site, and each resource page. It caches every response in `.cache/enrich/` for seven days and sends conditional requests after that. It writes `data/features/fixed.json` and one file in `data/items/` for each registry. It uses your `gh` login for the GitHub API, and Playwright renders pages that need JavaScript when it is installed.

## Visual features

`taxonomy/styles.json` holds a closed vocabulary for the look of a screen: 30 styles with definitions, cues, aliases, and example screens, plus density, imagery, and the sections a screen can show. Page types use the surfaces.

Each site screenshot, template preview, and studio, portfolio, or artist preview carries `visual` tags: a page type, the visible sections, one to three styles, a density, and imagery. Each showcase site and each studio, portfolio, or artist record also carries facts from its computed CSS: the color mode, background, text and accent colors, heading and body fonts, and button radius. `showcase-indexes.json` lists screenshots by style and by page type, and sites by color mode. The search engine reads style words in a query, such as "brutalist portfolio", and ranks records with that look first.

`node scripts/visual.mjs batches` lists the images for tagging in `.cache/visual/batches/`. Three agents tag each batch without seeing each other's work, following `scripts/lib/visual-spec.txt`, and `node scripts/visual.mjs check <pass> <batch>` validates each output. `node scripts/visual.mjs merge` keeps a tag when two of the three passes agree and writes `data/features/visual.json`. `node scripts/visual.mjs css` reads the computed CSS of each site with Playwright and writes `data/features/visual-css.json`.

## Search evaluation

`npm run eval` scores a search system against the agent queries in `eval/queries.json` and the graded labels in `eval/qrels.json`. It prints nDCG@10, Recall@50, Success@3, the share of the top five results that break a stated filter, duplicates in the top eight, and abstention on queries with no answer. Use `--system lexical` to score the search engine in `app/lib/engine.ts`, and `--system dense-<model>` to score embeddings alone. `--system hybrid-<model>` gives the engine query vectors, and the engine fuses its word ranking with the vector ranking by reciprocal rank. The models are `qwen3`, `gemma`, and `gemma2`. `--system unified-gemma2` also gives each record the vectors of its preview image, its templates, and its registry items, and ranks the record by the best of them. `--kinds` chooses those parts. `--dense-weight` changes the weight of the vectors, and `--min-similarity` changes the vector score below which a weak keyword match returns no result. Use `--split dev` or `--split test` to score half of the queries. Tune on `dev` and report `test`. Add `--pool 20` to write the unjudged results to `eval/pool.json` for labeling. Twins that share `sameAs` count as one result.

`node scripts/eval-screens.mjs` scores screen search against `eval/screens.json` and `eval/screen-qrels.json`. It compares the Phase 3 tags alone, the image vectors alone, and both together.

`node scripts/embed.mjs <model>` embeds the catalog and the eval queries into `.cache/embed/` first. For `gemma2`, it embeds every document in `scripts/lib/content.mjs`: each record, its preview image, its templates with their previews, its registry items, and each site screen, with text and image in one vector space. It keeps finished vectors and saves every minute, so a stopped run continues where it stopped. `--kinds` limits the run to some document kinds, `--part 0/2` and `--part 1/2` split it between two processes, `EMBED_DIR` sets the output folder, and `EMBED_DEVICE=cuda` uses an NVIDIA GPU. Add `--queries` to embed only the queries.

## Search server for agents

`server/` holds the search service that agents use: an MCP server at `https://index-mcp.chele.bi/mcp` and a JSON endpoint at `https://index-mcp.chele.bi/search`. Both need no key. The MCP server answers 2026-07-28 clients and older clients from one endpoint, and offers three read-only tools: `search`, `fetch`, and `component_guide`. `/search` takes `q`, the facet filters as comma lists (`framework`, `styling`, `license`, `pricing`, `platform`), `category`, `component`, `surface`, `type`, and `limit`, and returns the same JSON as the search tool.

The server runs the engine from `app/lib/engine.ts` on the catalog of its own commit, so it ranks exactly as `npm run eval -- --system unified-gemma2` scores. It uses EmbeddingGemma 2 at full precision for every document and query. It keeps the document vectors in its data folder, keyed by the text and image of each document, so a restart embeds only new or changed documents. It reads new images from `MEDIA_ORIGIN`, by default `https://index-media.chele.bi`. A result names the template or registry item that matched in `matched`. Set `type` to `screens` to search the site screenshots by look and page type. Until the vectors are ready, it answers with keyword search. Each caller IP gets 30 searches a minute. Requests from Anthropic's connector range share one bucket of 600 a minute. When more than four query embeddings wait, a search falls back to keywords. Each search writes one JSON log line with the query, the filters, the result IDs, and the time, but not the IP.

Run it locally with `npm ci --prefix server`, `npm run data`, and `node server/index.mjs`. It listens on port 8787 and keeps the model and vectors in `.cache/server/`. Set `INDEX_DATA` to move that folder, `PORT` to change the port, `MAX_INFLIGHT` to change the embedding queue limit, and `INDEX_DENSE=off` to serve keyword search only. Coolify on Igris builds `server/Dockerfile` from `main` and keeps `/data` in a volume.

## Built as a static site

Index uses Next.js, React, TypeScript, and Tailwind CSS. Vercel serves the static HTML and JSON, with no application database or account system. The catalog data and taxonomy live in this repository. Preview media stays outside Git and is served from a read-only Igris origin through Cloudflare. Preview URLs carry the `MEDIA_VERSION` value from `app/lib/media.ts`. Browsers keep each preview for 30 days, so raise the value when you replace an existing preview file.

Each page has a 1200 by 630 share image for social previews. `npm run share:images` renders the images into `public/og/share` and writes `data/share-manifest.json`. The script needs Playwright. Run `npm install --no-save playwright` and `npx playwright install chromium` one time. Upload the new images to the media origin before you push the manifest. A page without its own image uses the site image.

## License and sources

The [MIT license](LICENSE) covers the original code and documentation. Third-party fonts, images, and source material retain their own terms. A resource's license field describes that resource, not every item in the catalog.

See the [third-party notices](THIRD_PARTY.md) for font licenses and source attribution details.
