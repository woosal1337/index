import CopyCode from "./CopyCode";
import { AgentIcon } from "./icons";
import { Btn } from "./primitives";
import { SEARCH_ORIGIN } from "../lib/agent";

export default function AgentStrip() {
  return (
    <aside className="agent-strip" aria-label="Index for coding agents">
      <AgentIcon />
      <p className="agent-strip-text">
        <strong>Your coding agent can search Index.</strong> Add the MCP server to Claude Code, Cursor, or any MCP client.
        No key needed.
      </p>
      <CopyCode code={`${SEARCH_ORIGIN}/mcp`} what="mcp-url-home" />
      <Btn href="/agents" sm>
        Setup guide
      </Btn>
    </aside>
  );
}
