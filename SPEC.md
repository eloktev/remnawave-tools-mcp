# Remnawave Flat Tools MCP: Technical Specification

## Goal

Build a local stdio MCP server for the `sysadmin` OpenClaw agent that exposes Remnawave operations as separate, discoverable MCP tools while preserving strict safety gates.

The server must not store or print Remnawave tokens, subscription secrets, REALITY private keys, node secret keys, user short UUIDs, or full subscription URLs.

## Deployment Context

- Runtime host: any host that can run Node.js and reach a Remnawave panel.
- Config directory: operator-defined.
- Existing working upstream MCP: `remnawave-mcp@0.2.1`.
- Existing panel version gate: Remnawave `2.7.0` through `2.7.4`.
- Existing MCP id to replace or supplement: `remnawave`.
- Visibility: scope this MCP to trusted operators only. It can read sensitive Remnawave metadata, even with response redaction.
- Credentials must come only from environment variables. Do not hard-code token values.

## Architecture

Implement a wrapper MCP server named `remnawave-tools-mcp`.

Preferred approach:

1. Start `remnawave-mcp@0.2.1` as a child stdio MCP process.
2. Initialize it through MCP JSON-RPC.
3. Discover supported domains and operations via the upstream single tool `remnawave_api`.
4. Describe operations at startup or lazily on first use.
5. Expose one flat MCP tool per supported operation.
6. Forward calls to upstream `remnawave_api` using `{ domain, operation, payload, responseMode, confirmToken }`.
7. Preserve upstream compact error envelopes and confirmation/preview tokens.
8. Add an extra local safety layer for mutations.

Do not reimplement Remnawave HTTP endpoints directly unless the wrapper approach proves impossible.

## Environment

Required:

- `REMNAWAVE_BASE_URL`
- `REMNAWAVE_API_TOKEN`
- `REMNAWAVE_VERSION`

Optional:

- `LOG_LEVEL`, default `warn`
- `REMNAWAVE_UPSTREAM_COMMAND`, default `npx`
- `REMNAWAVE_UPSTREAM_ARGS`, default `-y remnawave-mcp@0.2.1`
- `REMNAWAVE_TOOLS_ALLOW_MUTATIONS`, default `false`
- `REMNAWAVE_TOOLS_DISCOVERY_TIMEOUT_MS`, default `30000`

No environment variable values may be written to logs or MCP responses.

## MCP Tool Naming

Expose tools with this deterministic name:

`remnawave_<domain>_<operation>`

Examples:

- `remnawave_system_get_health`
- `remnawave_nodes_list`
- `remnawave_users_get`
- `remnawave_profiles_get_computed`
- `remnawave_subscription_settings_update`

Also expose two meta tools:

- `remnawave_discover`: list domains, operations, safety class, and tool names.
- `remnawave_describe`: return upstream operation schema/description for a specific domain and operation.

## Input Contract

Every flat operation tool accepts:

```json
{
  "payload": {},
  "responseMode": "normalized",
  "confirmToken": "optional-token-from-upstream",
  "mutationApproved": false
}
```

Rules:

- `payload` defaults to `{}`.
- `responseMode` defaults to `normalized`.
- `responseMode=raw` is passed upstream only when the upstream operation allows it.
- `confirmToken` is passed through unchanged.
- `mutationApproved` is only a local safety flag; it is not forwarded upstream.

## Safety Model

Classify operations before execution.

Read-only operations execute directly:

- `get`
- `list`
- `resolve`
- `get_*`
- `list_*`
- `*_stats`
- `*_metrics`
- `*_usage`
- `get_computed`
- `get_connection_keys_by_uuid`
- `get_raw_by_short_uuid`
- `get_subpage_config_by_short_uuid`
- public/protected subscription reads

Sensitive reads still execute directly but must be redacted in logs and never echoed into documentation:

- user details
- subscription contents
- connection keys
- short UUID based lookups
- HWID/user device details

Mutating or operational operations are not executed unless both conditions are true:

1. `REMNAWAVE_TOOLS_ALLOW_MUTATIONS=true`
2. caller sets `mutationApproved=true`

Mutating or operational operations include:

- `create`
- `update`
- `delete`
- `disable`
- `enable`
- `reorder`
- `reset_traffic`
- `restart`
- `restart_all`
- `bulk_*`
- `add_users`
- `remove_users`
- `revoke_subscription`
- `profile_modification`
- `clone`
- `generate_*`
- `upsert_*`

If mutation is blocked locally, return a structured MCP result with:

```json
{
  "error": {
    "code": "LOCAL_MUTATION_BLOCKED",
    "kind": "safety",
    "message": "This Remnawave operation is mutating and local mutation execution is disabled.",
    "retryable": false
  }
}
```

This local safety layer is in addition to upstream confirmation/preview gates.

## Required Supported Operations

The wrapper must expose all operations currently discoverable from `remnawave-mcp@0.2.1` against Remnawave `2.7.4`.

### system

- `generate_x25519_keypairs`
- `get_bandwidth_stats`
- `get_health`
- `get_metadata`
- `get_node_statistics`
- `get_nodes_metrics`
- `get_recap`
- `get_stats`

### users

- `bulk_all_extend_expiration_date`
- `bulk_all_reset_traffic`
- `bulk_all_update`
- `bulk_delete`
- `bulk_delete_by_status`
- `bulk_extend_expiration_date`
- `bulk_reset_traffic`
- `bulk_revoke_subscription`
- `bulk_update`
- `bulk_update_squads`
- `create`
- `delete`
- `disable`
- `enable`
- `get`
- `get_accessible_nodes`
- `get_by_email`
- `get_by_id`
- `get_by_short_uuid`
- `get_by_tag`
- `get_by_telegram_id`
- `get_by_username`
- `get_subscription_request_history`
- `list`
- `list_tags`
- `reset_traffic`
- `resolve`
- `revoke_subscription`
- `update`

### hosts

- `bulk_delete`
- `bulk_disable`
- `bulk_enable`
- `bulk_set_inbound`
- `bulk_set_port`
- `create`
- `delete`
- `get`
- `list`
- `list_tags`
- `reorder`
- `update`

### nodes

- `bulk_actions`
- `bulk_update`
- `create`
- `delete`
- `disable`
- `enable`
- `get`
- `list`
- `list_tags`
- `profile_modification`
- `reorder`
- `reset_traffic`
- `restart`
- `restart_all`
- `update`

### metadata

- `get_node`
- `get_user`
- `upsert_node`
- `upsert_user`

### templates

- `create`
- `delete`
- `get`
- `list`
- `reorder`
- `update`

### snippets

- `create`
- `delete`
- `list`
- `update`

### public_subscriptions

- `get`
- `get_by_client_type`
- `get_info`

### subscriptions

- `get_by_short_uuid`
- `get_by_username`
- `get_by_uuid`
- `get_connection_keys_by_uuid`
- `get_raw_by_short_uuid`
- `get_subpage_config_by_short_uuid`
- `list`

### subscription_request_history

- `get_stats`
- `list`

### profiles

- `create`
- `delete`
- `get`
- `get_computed`
- `list`
- `list_all_inbounds`
- `list_inbounds`
- `reorder`
- `update`

### bandwidth_stats

- `get_node_user_usage_legacy`
- `get_node_users_usage`
- `get_user_usage`
- `get_user_usage_legacy`
- `list_nodes_usage`

### keygen

- `generate_node_secret`

### external_squads

- `add_users`
- `create`
- `delete`
- `get`
- `list`
- `remove_users`
- `reorder`
- `update`

### hwid

- `create_device`
- `delete_all_devices`
- `delete_device`
- `get_stats`
- `get_top_users`
- `get_user_devices`
- `list_users`

### infra_billing

- `create_history_record`
- `create_node`
- `create_provider`
- `delete_history_record`
- `delete_node`
- `delete_provider`
- `get_provider`
- `list_history`
- `list_nodes`
- `list_providers`
- `update_node`
- `update_provider`

### internal_squads

- `add_users`
- `create`
- `delete`
- `get`
- `get_accessible_nodes`
- `list`
- `remove_users`
- `reorder`
- `update`

### subscription_page_configs

- `clone`
- `create`
- `delete`
- `get`
- `list`
- `reorder`
- `update`

### subscription_settings

- `get`
- `update`

## Implementation Requirements

- TypeScript preferred.
- Node.js >= 20.11.
- Use `@modelcontextprotocol/sdk`.
- Use stdio transport.
- Keep stdout reserved for MCP protocol only.
- Log diagnostics to stderr only.
- Provide `package.json`, `tsconfig.json`, source files, and README.
- Provide an executable bin, for example `bin/remnawave-tools-mcp`.
- Do not require global npm installs.
- The server should fail closed if upstream discovery fails or Remnawave version gate fails.
- Tool list should be stable and deterministic.
- Descriptions should include domain, operation, safety class, and upstream operation summary when available.
- Input schemas may be generic at first, but `remnawave_describe` must expose upstream schema details.

## Test Requirements

Automated tests:

- Unit test operation classification.
- Unit test tool-name generation and reverse parsing.
- Unit test local mutation blocking.
- Unit test child MCP JSON-RPC message handling with a fake upstream process.

Live smoke tests against the real panel, read-only only:

- `remnawave_discover`
- `remnawave_system_get_health`
- `remnawave_system_get_stats`
- `remnawave_nodes_list`
- `remnawave_profiles_list`
- `remnawave_hosts_list`
- `remnawave_users_list` with the smallest safe pagination payload supported by upstream
- `remnawave_subscription_settings_get`

Safety smoke tests:

- Calling `remnawave_nodes_restart` without `REMNAWAVE_TOOLS_ALLOW_MUTATIONS=true` must return `LOCAL_MUTATION_BLOCKED`.
- Calling `remnawave_users_delete` without local mutation approval must return `LOCAL_MUTATION_BLOCKED`.

Do not run live mutating tests.

## Example MCP Integration

After tests pass, configure your MCP runtime to use the local wrapper server:

```json
{
  "enabled": true,
  "command": "node",
  "args": ["/opt/remnawave-tools-mcp/dist/index.js"],
  "env": {
    "REMNAWAVE_BASE_URL": "https://remnawave.example.com",
    "REMNAWAVE_API_TOKEN": "${REMNAWAVE_API_TOKEN}",
    "REMNAWAVE_VERSION": "2.7.4",
    "LOG_LEVEL": "warn",
    "REMNAWAVE_TOOLS_ALLOW_MUTATIONS": "false"
  }
}
```

Keep the Remnawave namespace denied for agents or users that should not inspect the panel.

## Acceptance Criteria

- `npm test` passes.
- `npm run build` passes.
- `openclaw config validate` passes after integration.
- `openclaw mcp probe remnawave` reports many flat tools, not only one upstream tool.
- Live read-only smoke tests pass.
- Mutating operation smoke tests prove local safety blocks are active.
- No secret values appear in logs, README, SPEC, test snapshots, or final chat output.
