export type OperationSafety = "read" | "sensitive-read" | "mutation";

export interface OperationInfo {
  domain: string;
  operation: string;
  toolName: string;
  safety: OperationSafety;
}

export const CATALOG: Record<string, string[]> = {
  system: [
    "generate_x25519_keypairs",
    "get_bandwidth_stats",
    "get_health",
    "get_metadata",
    "get_node_statistics",
    "get_nodes_metrics",
    "get_recap",
    "get_stats",
  ],
  users: [
    "bulk_all_extend_expiration_date",
    "bulk_all_reset_traffic",
    "bulk_all_update",
    "bulk_delete",
    "bulk_delete_by_status",
    "bulk_extend_expiration_date",
    "bulk_reset_traffic",
    "bulk_revoke_subscription",
    "bulk_update",
    "bulk_update_squads",
    "create",
    "delete",
    "disable",
    "enable",
    "get",
    "get_accessible_nodes",
    "get_by_email",
    "get_by_id",
    "get_by_short_uuid",
    "get_by_tag",
    "get_by_telegram_id",
    "get_by_username",
    "get_subscription_request_history",
    "list",
    "list_tags",
    "reset_traffic",
    "resolve",
    "revoke_subscription",
    "update",
  ],
  hosts: [
    "bulk_delete",
    "bulk_disable",
    "bulk_enable",
    "bulk_set_inbound",
    "bulk_set_port",
    "create",
    "delete",
    "get",
    "list",
    "list_tags",
    "reorder",
    "update",
  ],
  nodes: [
    "bulk_actions",
    "bulk_update",
    "create",
    "delete",
    "disable",
    "enable",
    "get",
    "list",
    "list_tags",
    "profile_modification",
    "reorder",
    "reset_traffic",
    "restart",
    "restart_all",
    "update",
  ],
  metadata: ["get_node", "get_user", "upsert_node", "upsert_user"],
  templates: ["create", "delete", "get", "list", "reorder", "update"],
  snippets: ["create", "delete", "list", "update"],
  public_subscriptions: ["get", "get_by_client_type", "get_info"],
  subscriptions: [
    "get_by_short_uuid",
    "get_by_username",
    "get_by_uuid",
    "get_connection_keys_by_uuid",
    "get_raw_by_short_uuid",
    "get_subpage_config_by_short_uuid",
    "list",
  ],
  subscription_request_history: ["get_stats", "list"],
  profiles: [
    "create",
    "delete",
    "get",
    "get_computed",
    "list",
    "list_all_inbounds",
    "list_inbounds",
    "reorder",
    "update",
  ],
  bandwidth_stats: [
    "get_node_user_usage_legacy",
    "get_node_users_usage",
    "get_user_usage",
    "get_user_usage_legacy",
    "list_nodes_usage",
  ],
  keygen: ["generate_node_secret"],
  external_squads: ["add_users", "create", "delete", "get", "list", "remove_users", "reorder", "update"],
  hwid: ["create_device", "delete_all_devices", "delete_device", "get_stats", "get_top_users", "get_user_devices", "list_users"],
  infra_billing: [
    "create_history_record",
    "create_node",
    "create_provider",
    "delete_history_record",
    "delete_node",
    "delete_provider",
    "get_provider",
    "list_history",
    "list_nodes",
    "list_providers",
    "update_node",
    "update_provider",
  ],
  internal_squads: ["add_users", "create", "delete", "get", "get_accessible_nodes", "list", "remove_users", "reorder", "update"],
  subscription_page_configs: ["clone", "create", "delete", "get", "list", "reorder", "update"],
  subscription_settings: ["get", "update"],
};

export const DOMAINS = Object.keys(CATALOG).sort();

export function allOperations(): OperationInfo[] {
  return DOMAINS.flatMap((domain) =>
    [...CATALOG[domain]].sort().map((operation) => ({
      domain,
      operation,
      toolName: toolNameFor(domain, operation),
      safety: classifyOperation(domain, operation),
    })),
  );
}

export function toolNameFor(domain: string, operation: string): string {
  return `remnawave_${domain}_${operation}`;
}

export function parseToolName(toolName: string): { domain: string; operation: string } | null {
  if (!toolName.startsWith("remnawave_")) return null;
  const rest = toolName.slice("remnawave_".length);
  const domain = DOMAINS.sort((a, b) => b.length - a.length).find((candidate) => rest.startsWith(`${candidate}_`));
  if (!domain) return null;
  const operation = rest.slice(domain.length + 1);
  if (!CATALOG[domain].includes(operation)) return null;
  return { domain, operation };
}

export function classifyOperation(domain: string, operation: string): OperationSafety {
  const mutationTokens = new Set([
    "create",
    "update",
    "delete",
    "disable",
    "enable",
    "reorder",
    "reset_traffic",
    "restart",
    "restart_all",
    "add_users",
    "remove_users",
    "revoke_subscription",
    "profile_modification",
    "clone",
  ]);
  const mutationPrefixes = ["bulk_", "generate_", "upsert_"];

  if (mutationTokens.has(operation) || mutationPrefixes.some((prefix) => operation.startsWith(prefix))) {
    return "mutation";
  }
  if (operation.startsWith("create_") || operation.startsWith("update_") || operation.startsWith("delete_")) {
    return "mutation";
  }

  const sensitiveReadHints = [
    domain === "users" && operation !== "list_tags",
    domain === "subscriptions",
    domain === "public_subscriptions",
    domain === "hwid" && (operation.includes("user") || operation.includes("device")),
    operation.includes("short_uuid"),
    operation.includes("connection_keys"),
    operation.includes("subpage_config"),
  ];
  if (sensitiveReadHints.some(Boolean)) return "sensitive-read";

  const readExact = new Set(["get", "list", "resolve", "get_computed"]);
  if (
    readExact.has(operation) ||
    operation.startsWith("get_") ||
    operation.startsWith("list_") ||
    operation.endsWith("_stats") ||
    operation.endsWith("_metrics") ||
    operation.endsWith("_usage")
  ) {
    return "read";
  }

  return "mutation";
}
