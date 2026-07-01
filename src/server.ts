import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { allOperations, CATALOG, classifyOperation, parseToolName, toolNameFor } from "./catalog.js";
import { log, redactValue } from "./logger.js";
import {
  dangerousMutationConfirmed,
  normalizeOperationInput,
  operationInputSchema,
  operatorTarget,
  operatorTools,
  operatorToolSpec,
  type OperatorToolName,
} from "./schemas.js";
import { UpstreamClient } from "./upstreamClient.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

export async function runServer(upstream = new UpstreamClient()): Promise<void> {
  await upstream.assertReady();

  const server = new McpServer({
    name: "remnawave-tools-mcp",
    version: "0.1.0",
  });

  server.tool(
    "remnawave_discover",
    "List all Remnawave flat tools with domain, operation, and local safety class.",
    {},
    async () => jsonResult({
      domains: Object.fromEntries(Object.entries(CATALOG).map(([domain, operations]) => [domain, [...operations].sort()])),
      tools: allOperations(),
      operatorTools: [...operatorTools],
    }),
  );

  server.tool(
    "remnawave_describe",
    "Return upstream remnawave_api schema/details for a domain and operation.",
    {
      domain: z.string(),
      operation: z.string(),
    },
    async ({ domain, operation }) => {
      if (!CATALOG[domain]?.includes(operation)) {
        return jsonResult({ error: { code: "UNKNOWN_OPERATION", kind: "validation", message: "Unknown Remnawave domain/operation.", retryable: false } });
      }
      return jsonResult({
        toolName: toolNameFor(domain, operation),
        safety: classifyOperation(domain, operation),
        upstream: await upstream.describe(domain, operation),
      });
    },
  );

  for (const operation of allOperations()) {
    server.tool(
      operation.toolName,
      `Remnawave ${operation.domain}.${operation.operation} (${operation.safety}).`,
      operationInputSchema(operation.domain, operation.operation),
      async (args) => {
        const { payload, responseMode, confirmToken, mutationApproved, confirmPhrase } = normalizeOperationInput(args);
        const parsed = parseToolName(operation.toolName);
        if (!parsed) {
          return jsonResult({ error: { code: "TOOL_PARSE_FAILED", kind: "internal", message: "Failed to parse generated tool name.", retryable: false } });
        }
        if (operation.safety === "mutation" && !mutationAllowed(mutationApproved)) {
          return jsonResult({
            error: {
              code: "LOCAL_MUTATION_BLOCKED",
              kind: "safety",
              message: "This Remnawave operation is mutating and local mutation execution is disabled.",
              retryable: false,
            },
          });
        }
        if (operation.safety === "mutation" && !dangerousMutationConfirmed(parsed.domain, parsed.operation, confirmPhrase)) {
          return jsonResult({
            error: {
              code: "DANGEROUS_MUTATION_CONFIRMATION_REQUIRED",
              kind: "safety",
              message: `This operation requires confirmPhrase=\"confirm ${parsed.domain}.${parsed.operation}\".`,
              retryable: false,
            },
          });
        }
        if (responseMode === "raw" && !rawAllowed(parsed.domain, parsed.operation)) {
          return jsonResult({
            error: {
              code: "RAW_RESPONSE_NOT_ALLOWED",
              kind: "validation",
              message: "Raw response mode is not allowed for this Remnawave operation.",
              retryable: false,
            },
          });
        }
        const result = await upstream.call(parsed.domain, parsed.operation, payload, responseMode, confirmToken);
        return operation.safety === "sensitive-read" ? redactToolResult(result) : result;
      },
    );
  }

  for (const name of operatorTools) {
    const spec = operatorToolSpec(name);
    const safety = classifyOperation(spec.domain, spec.operation);
    server.tool(name, spec.description, spec.inputSchema, async (args) => {
      const { responseMode, confirmToken, mutationApproved, confirmPhrase } = normalizeOperationInput(args);
      const target = operatorTarget(name as OperatorToolName, args);
      if (safety === "mutation" && !mutationAllowed(mutationApproved)) {
        return jsonResult({
          error: {
            code: "LOCAL_MUTATION_BLOCKED",
            kind: "safety",
            message: "This Remnawave operation is mutating and local mutation execution is disabled.",
            retryable: false,
          },
        });
      }
      if (safety === "mutation" && !dangerousMutationConfirmed(target.domain, target.operation, confirmPhrase)) {
        return jsonResult({
          error: {
            code: "DANGEROUS_MUTATION_CONFIRMATION_REQUIRED",
            kind: "safety",
            message: `This operation requires confirmPhrase=\"confirm ${target.domain}.${target.operation}\".`,
            retryable: false,
          },
        });
      }
      if (responseMode === "raw" && !rawAllowed(target.domain, target.operation)) {
        return jsonResult({
          error: {
            code: "RAW_RESPONSE_NOT_ALLOWED",
            kind: "validation",
            message: "Raw response mode is not allowed for this Remnawave operation.",
            retryable: false,
          },
        });
      }
      const result = await upstream.call(target.domain, target.operation, target.payload, responseMode, confirmToken);
      return safety === "sensitive-read" ? redactToolResult(result) : result;
    });
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
  log("info", "remnawave-tools MCP server started", { tools: allOperations().length + operatorTools.length + 2 });
}

function mutationAllowed(mutationApproved?: boolean): boolean {
  return process.env.REMNAWAVE_TOOLS_ALLOW_MUTATIONS === "true" && mutationApproved === true;
}

export function rawAllowed(domain: string, operation: string): boolean {
  return domain === "system" && ["get_stats", "get_health", "get_metadata"].includes(operation);
}

export function redactToolResult(result: CallToolResult): CallToolResult {
  return {
    ...result,
    content: result.content.map((item) => {
      if (item.type !== "text") return item;
      try {
        return { ...item, text: JSON.stringify(redactValue(JSON.parse(item.text))) };
      } catch {
        return { ...item, text: String(redactValue({ value: item.text })) };
      }
    }),
  };
}

export function jsonResult(value: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(value),
      },
    ],
  };
}
