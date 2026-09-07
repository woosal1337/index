# Index

A design corpus your agent can read.

Index is a searchable catalog of design resources for designers, developers, and coding agents. Find a library, template, or reference through the interface, or query the same records through the public API.

[Browse Index](https://index.chele.bi) · [Explore the catalog API](https://index.chele.bi/agents/) · [MIT license](LICENSE)

## What is inside

- Component libraries, design systems, UI kits, and templates.
- Typography, icons, color tools, motion, textures, and other design assets.
- Inspiration galleries, studio portfolios, artists, and site references.
- Design tools for coding agents, with installation and integration details where available.
- Essays and learning resources with source links and concise summaries.

Resources connect to a shared vocabulary of components and app surfaces. You can search for a specific component, such as a command palette, or a surface, such as onboarding or checkout.

## Browse and compare

Use the grid for visual previews or the list for a compact overview. Filter by category, license, pricing, framework, distribution, or agent readiness. Sort by quality tier, name, or component count.

Resource pages combine source links with component coverage, pricing, license details, and evidence. Some pages also offer a structured prompt that you can copy into a coding agent. Unknown fields remain explicit instead of implying support.

The desktop-style interface includes movable windows, hover previews, a keyboard search palette, and light and dark themes.

## Public data

The website and API use the same catalog. The endpoints are static, readable without an account or API key, and available directly over HTTPS.

| Endpoint | Contents |
| --- | --- |
| [resources.json](https://index.chele.bi/api/resources.json) | Complete resource records |
| [search.json](https://index.chele.bi/api/search.json) | Compact search index |
| [indexes.json](https://index.chele.bi/api/indexes.json) | Component and surface mappings, plus facet counts |
| [taxonomy.json](https://index.chele.bi/api/taxonomy.json) | Categories, kinds, facets, components, and surfaces |
| [stats.json](https://index.chele.bi/api/stats.json) | Current catalog counts and build date |
| [showcase.json](https://index.chele.bi/api/showcase.json) | Site references and screenshot metadata |
| [showcase-indexes.json](https://index.chele.bi/api/showcase-indexes.json) | Typeface and color indexes across site references |
| [llms.txt](https://index.chele.bi/llms.txt) | Catalog context for language models |
| [sitemap.xml](https://index.chele.bi/sitemap.xml) | Public page URLs |

The [API page](https://index.chele.bi/agents/) includes query examples and the resource record shape. Use [catalog statistics](https://index.chele.bi/api/stats.json) for current counts.

## Built as a static site

Index uses Next.js, React, TypeScript, and Tailwind CSS. The build produces static HTML and JSON, with no application database or account system. The catalog data and taxonomy live in this repository. Optional preview media stays outside Git.

## License and sources

The [MIT license](LICENSE) covers the original code and documentation. Third-party fonts, images, and source material retain their own terms. A resource's license field describes that resource, not every item in the catalog.

See the [third-party notices](THIRD_PARTY.md) for font licenses and source attribution details.
