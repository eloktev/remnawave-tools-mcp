import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { CATALOG } from "../src/catalog.js";

const server = new McpServer({ name: "fake-remnawave-upstream", version: "0.0.0" });

server.tool(
  "remnawave_api",
  "Fake upstream Remnawave API tool.",
  {
    domain: z.string(),
    operation: z.string().optional(),
    payload: z.record(z.unknown()).optional(),
    responseMode: z.string().optional(),
    confirmToken: z.string().optional(),
  },
  async (args) => ({
    content: [{ type: "text", text: JSON.stringify(fakeResponse(args)) }],
  }),
);

await server.connect(new StdioServerTransport());

function fakeResponse(args: { domain: string; operation?: string; payload?: Record<string, unknown>; responseMode?: string; confirmToken?: string }) {
  if (!args.operation) {
    return {
      domain: args.domain,
      operations: (CATALOG[args.domain] ?? []).map((name) => ({
        name,
        disposition: "supported",
        write: ["create", "update", "delete", "restart"].some((token) => name.includes(token)),
        payloadRequired: false,
        summary: `Fake ${args.domain}.${name}`,
      })),
    };
  }
  return { ok: true, args };
}
