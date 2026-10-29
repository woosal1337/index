import Link from "next/link";
import Shell from "../_components/Shell";
import CopyCode from "../_components/CopyCode";
import { AgentIcon } from "../_components/icons";
import { PageHead } from "../_components/primitives";
import { SEARCH_ORIGIN } from "../lib/agent";
import { getStats } from "../lib/data";
import { pageMetadata } from "../lib/site";

const MCP_URL = `${SEARCH_ORIGIN}/mcp`;

export const metadata = pageMetadata("/agents", "Agents",
  "Connect Claude Code, Cursor, claude.ai, or any MCP client to Index, or call its JSON search. No key and no account.");

const CLIENTS = [
  { name: "Claude Code", where: "Run in a terminal.", what: "claude-code", code: `claude mcp add --transport http index ${MCP_URL}` },
  { name: "Cursor", where: "Add to ~/.cursor/mcp.json, or to .cursor/mcp.json in a project.", what: "cursor", code: JSON.stringify({ mcpServers: { index: { url: MCP_URL } } }, null, 2) },
  { name: "Grok Build", where: "Run in a terminal.", what: "grok", code: `grok mcp add --transport http index ${MCP_URL}` },
];

const TOOLS = [
  {
    name: "search",
    text: (
      <>
        Finds resources for one need. Pass the project stack as hard filters: <code>framework</code>, <code>styling</code>,{" "}
        <code>license</code>, <code>pricing</code>, and <code>platform</code>. <code>category</code>, <code>component</code>, and{" "}
        <code>surface</code> narrow the search, and <code>type: &quot;screens&quot;</code> searches real website screenshots by page
        type and look. Each result has the install command, the license, the matching registry item, and why it matched.{" "}
        <code>match</code> is strong, weak, or none, and none means that nothing in Index fits.
      </>
    ),
  },
  {
    name: "fetch",
    text: "Reads one record in full: install steps, links, facets, registry items, similar resources, and, for studios and portfolios, the look taken from a screenshot of the site.",
  },
  {
    name: "component_guide",
    text: "Gives the build checklist, states, and ARIA pattern of one UI component, with the best implementations for the stack.",
  },
];

const PROMPTS = [
  "Find an accessible date range picker for this project, and check its license before you install it.",
  "Show me real pricing pages with a dark glow look.",
  "What does a good command palette need? Then pick an implementation that fits our stack.",
];

export default function AgentsPage() {
  const stats = getStats();
  const n = (v: number | undefined) => (v ?? 0).toLocaleString("en-US");

  return (
    <Shell>
      <PageHead
        icon={<AgentIcon />}
        title="Agents"
        meta={`MCP server · ${n(stats.resources)} resources · ${n(stats.items)} registry items · ${n(stats.showcaseShots)} screens`}
        intro="Coding agents can search Index while they build. Connect the MCP server, or call the same search as plain JSON. It needs no key and no account."
      />

      <section className="section">
        <div className="section-title">
          MCP server
          <span className="meta">Streamable HTTP</span>
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)] gap-5 px-1">
          <CopyCode code={MCP_URL} what="mcp-url" />
          {CLIENTS.map((c) => (
            <div key={c.name}>
              <div className="heading-16">{c.name}</div>
              <p className="label mb-2 mt-1">{c.where}</p>
              <CopyCode code={c.code} what={c.what} />
            </div>
          ))}
          <div className="prose">
            <p>
              <span className="font-medium text-fg">claude.ai and Claude Desktop. </span>
              Add a custom connector and paste the server URL.
            </p>
            <p>
              <span className="font-medium text-fg">Other clients. </span>
              Any client that connects to remote MCP servers takes the same URL. The server answers clients of the
              2026-07-28 specification and older ones from one endpoint.
            </p>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-title">
          Tools
          <span className="meta">read-only</span>
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)] gap-4 px-1">
          {TOOLS.map((t) => (
            <div key={t.name}>
              <code className="heading-16 mono">{t.name}</code>
              <div className="prose mt-1">
                <p>{t.text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="section-title">Ask your agent</div>
        <div className="grid grid-cols-[minmax(0,1fr)] gap-2 px-1">
          {PROMPTS.map((p) => (
            <CopyCode key={p} code={p} what="prompt" />
          ))}
        </div>
      </section>

      <section className="section">
        <div className="section-title">Without MCP</div>
        <div className="grid grid-cols-[minmax(0,1fr)] gap-4 px-1">
          <div>
            <p className="prose mb-2">
              <code>GET {SEARCH_ORIGIN}/search</code> returns the same JSON as the search tool. It takes <code>q</code>, the
              filters <code>framework</code>, <code>styling</code>, <code>license</code>, <code>pricing</code>, and{" "}
              <code>platform</code> as comma lists, and <code>category</code>, <code>component</code>, <code>surface</code>,{" "}
              <code>type</code>, and <code>limit</code>.
            </p>
            <CopyCode code={`curl "${SEARCH_ORIGIN}/search?q=date+range+picker&framework=react"`} what="curl" />
          </div>
          <div className="prose">
            <p>
              <a href="/api/skill/SKILL.md">SKILL.md</a> is an agent skill that tells an agent when and how to search
              Index. In Claude Code, save it as <code>~/.claude/skills/index/SKILL.md</code>.{" "}
              <a href="/llms.txt">llms.txt</a> describes the catalog for language models.
            </p>
            <p>
              Static files need no server: <a href="/api/resources.json">resources.json</a> holds every record,{" "}
              <code>/api/r/&lt;id&gt;.json</code> one record, <code>/api/components/&lt;component&gt;.json</code> one
              component with its best implementations, and <a href="/api/taxonomy.json">taxonomy.json</a> the
              vocabularies.
            </p>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-title">Limits</div>
        <ul className="prose grid list-disc gap-1.5 px-1 pl-5">
          <li>Each IP address gets 30 searches a minute, and 240 other calls.</li>
          <li>Claude&apos;s connector traffic shares one bucket of 600 searches a minute.</li>
          <li>Under heavy load, a search answers with keyword ranking instead of failing.</li>
          <li>Each search logs the query, the filters, the result IDs, and the time, but not the IP address.</li>
          <li>
            The server and the site run on the same catalog. Its code is in the{" "}
            <a href="https://github.com/woosal1337/index/tree/main/server" target="_blank" rel="noreferrer noopener">
              repository
            </a>
            , and <Link href="/">every record</Link> is browsable here.
          </li>
        </ul>
      </section>
    </Shell>
  );
}
