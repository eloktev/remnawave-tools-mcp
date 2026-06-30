import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { CallToolResult, Tool } from "@modelcontextprotocol/sdk/types.js";
import { log } from "./logger.js";
import { CATALOG } from "./catalog.js";

export interface UpstreamOperationDescription {
  domain: string;
  operation: string;
  description?: string;
  schema?: unknown;
  raw?: unknown;
}

export class UpstreamClient {
  private client?: Client;
  private tools?: Tool[];

  async connect(): Promise<void> {
    if (this.client) return;
    const command = process.env.REMNAWAVE_UPSTREAM_COMMAND ?? "npx";
    const args = parseArgs(process.env.REMNAWAVE_UPSTREAM_ARGS ?? "-y remnawave-mcp@0.2.1");
    assertSupportedVersion();
    const env = buildUpstreamEnv({
      REMNAWAVE_BASE_URL: requireEnv("REMNAWAVE_BASE_URL"),
      REMNAWAVE_API_TOKEN: requireEnv("REMNAWAVE_API_TOKEN"),
      REMNAWAVE_VERSION: requireEnv("REMNAWAVE_VERSION"),
    });
    const transport = new StdioClientTransport({ command, args, env });
    const client = new Client({ name: "remnawave-tools-mcp", version: "0.1.0" });
    await withTimeout(client.connect(transport), discoveryTimeout(), "upstream connect timed out");
    this.client = client;
    log("info", "connected upstream remnawave MCP");
  }

  async listTools(): Promise<Tool[]> {
    await this.connect();
    if (!this.client) throw new Error("upstream client is not connected");
    if (!this.tools) {
      const result = await withTimeout(this.client.listTools(), discoveryTimeout(), "upstream tools/list timed out");
      this.tools = result.tools ?? [];
    }
    return this.tools;
  }

  async assertReady(): Promise<void> {
    const tools = await this.listTools();
    if (!tools.some((tool) => tool.name === "remnawave_api")) {
      throw new Error("upstream remnawave_api tool was not discovered");
    }
    await this.assertCatalogSupported();
  }

  async call(domain: string, operation: string, payload: Record<string, unknown>, responseMode: string, confirmToken?: string): Promise<CallToolResult> {
    await this.connect();
    if (!this.client) throw new Error("upstream client is not connected");
    const args: Record<string, unknown> = { domain, operation, payload, responseMode };
    if (confirmToken) args.confirmToken = confirmToken;
    return await withTimeout(
      this.client.callTool({ name: "remnawave_api", arguments: args }) as Promise<CallToolResult>,
      discoveryTimeout(),
      `upstream call timed out for ${domain}.${operation}`,
    );
  }

  async describe(domain: string, operation: string): Promise<UpstreamOperationDescription> {
    const summary = await this.discoverOperation(domain, operation);
    return {
      domain,
      operation,
      description: summary?.summary,
      schema: summary,
      raw: summary,
    };
  }

  async close(): Promise<void> {
    if (!this.client) return;
    await this.client.close();
    this.client = undefined;
    this.tools = undefined;
  }

  private async assertCatalogSupported(): Promise<void> {
    for (const [domain, expectedOperations] of Object.entries(CATALOG)) {
      const discovered = await this.discoverDomain(domain);
      const supported = new Set(discovered.map((operation) => operation.name));
      const missing = expectedOperations.filter((operation) => !supported.has(operation));
      if (missing.length > 0) {
        throw new Error(`upstream Remnawave MCP is missing expected operations for ${domain}: ${missing.join(", ")}`);
      }
    }
  }

  private async discoverDomain(domain: string): Promise<Array<{ name: string; summary?: string; [key: string]: unknown }>> {
    await this.connect();
    if (!this.client) throw new Error("upstream client is not connected");
    const result = await withTimeout(
      this.client.callTool({ name: "remnawave_api", arguments: { domain } }) as Promise<CallToolResult>,
      discoveryTimeout(),
      `upstream discovery timed out for ${domain}`,
    );
    const text = result.content.find((item) => item.type === "text")?.text;
    if (!text) throw new Error(`upstream discovery returned no text for ${domain}`);
    const parsed = JSON.parse(text) as { operations?: Array<{ name: string; summary?: string; [key: string]: unknown }> };
    return parsed.operations ?? [];
  }

  private async discoverOperation(domain: string, operation: string): Promise<{ name: string; summary?: string; [key: string]: unknown } | undefined> {
    return (await this.discoverDomain(domain)).find((candidate) => candidate.name === operation);
  }
}

export function buildUpstreamEnv(required: Record<string, string>): Record<string, string> {
  const allowlist = [
    "PATH",
    "HOME",
    "TMPDIR",
    "TEMP",
    "TMP",
    "SystemRoot",
    "ComSpec",
    "NODE_EXTRA_CA_CERTS",
    "SSL_CERT_FILE",
    "SSL_CERT_DIR",
  ];
  const env: Record<string, string> = {};
  for (const key of allowlist) {
    const value = process.env[key];
    if (value) env[key] = value;
  }
  return { ...env, ...required };
}

function parseArgs(value: string): string[] {
  const matches = value.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) ?? [];
  return matches.map((part) => part.replace(/^["']|["']$/g, ""));
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`required environment variable ${name} is not set`);
  return value;
}

function assertSupportedVersion(): void {
  const version = requireEnv("REMNAWAVE_VERSION");
  if (!/^2\.7\.[0-4]$/.test(version)) {
    throw new Error("REMNAWAVE_VERSION must be one of 2.7.0 through 2.7.4");
  }
}

function discoveryTimeout(): number {
  return Number.parseInt(process.env.REMNAWAVE_TOOLS_DISCOVERY_TIMEOUT_MS ?? "30000", 10);
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timeout: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeout = setTimeout(() => reject(new Error(message)), timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}
