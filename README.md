# Remnawave Tools MCP

Flat, safety-gated stdio MCP wrapper for `remnawave-mcp@0.2.1`.

The upstream Remnawave MCP exposes a generic `remnawave_api` tool. This wrapper
keeps that upstream behavior but exposes one MCP tool per Remnawave domain
operation.

Examples:

- `remnawave_system_get_health`
- `remnawave_nodes_list`
- `remnawave_nodes_get`
- `remnawave_nodes_update`
- `remnawave_users_get`
- `remnawave_users_update`
- `remnawave_internal_squads_add_users`
- `remnawave_external_squads_add_users`
- `remnawave_subscription_settings_get`

Meta tools:

- `remnawave_discover`
- `remnawave_describe`

## Tool Map

The wrapper preserves every low-level Remnawave operation discovered from
`remnawave-mcp@0.2.1`. The current catalog has 152 low-level tools plus meta and
operator helpers.

| Domain | Examples | Safety |
| --- | --- | --- |
| `system` | health, metadata, stats, node metrics | read, mutation for key generation |
| `nodes` | list/get/create/update/disable/enable/restart/reset traffic | read + gated mutation |
| `users` | list/get/lookup/create/update/disable/enable/delete/bulk actions | sensitive read + gated mutation |
| `internal_squads` | list/get/create/update/add users/remove users | read + gated mutation |
| `external_squads` | list/get/create/update/add users/remove users | read + gated mutation |
| `hosts`, `profiles`, `templates`, `snippets` | config object management | read + gated mutation |
| `subscriptions`, `public_subscriptions` | subscription lookups and raw/subpage reads | sensitive read |
| `hwid`, `infra_billing`, `bandwidth_stats` | devices, billing metadata, usage stats | read/sensitive read + gated mutation |

Priority operations for `nodes`, `users`, `internal_squads`, and
`external_squads` expose typed top-level fields in addition to the generic
`payload` escape hatch. Callers can pass fields like `uuid`, `username`,
`address`, `userUuids`, `activeInternalSquads`, or `activeExternalSquads`
directly.

## Operator Tools

These convenience tools sit on top of the low-level operations:

- `remnawave_node_get_config`
- `remnawave_node_update_config`
- `remnawave_squad_add_users`
- `remnawave_user_suspend`
- `remnawave_user_set_squads`

They forward to the same upstream `remnawave_api` calls and use the same safety
rules. The low-level tools remain available for complete API coverage.

## Safety

Credentials are read only from environment variables:

- `REMNAWAVE_BASE_URL`
- `REMNAWAVE_API_TOKEN`
- `REMNAWAVE_VERSION`

Mutating operations are locally blocked unless both are true:

- `REMNAWAVE_TOOLS_ALLOW_MUTATIONS=true`
- the MCP call sets `mutationApproved=true`

By default, mutating calls return `LOCAL_MUTATION_BLOCKED` and are not forwarded
upstream.

Hard-to-reverse operations such as deletes, bulk mutations, and `restart_all`
also require an operation-specific confirmation phrase:

```json
{ "confirmPhrase": "confirm users.delete" }
```

Sensitive read results are redacted before returning through this wrapper for
user, subscription, connection-key, short-UUID, and device-oriented operations.

## Examples

Read a node:

```json
{
  "tool": "remnawave_nodes_get",
  "arguments": { "uuid": "node-uuid" }
}
```

Update a node, assuming local mutation execution is enabled:

```json
{
  "tool": "remnawave_node_update_config",
  "arguments": {
    "uuid": "node-uuid",
    "name": "edge-a",
    "address": "203.0.113.10",
    "mutationApproved": true
  }
}
```

Add users to an external squad:

```json
{
  "tool": "remnawave_squad_add_users",
  "arguments": {
    "squadType": "external",
    "squadUuid": "squad-uuid",
    "userUuids": ["user-uuid"],
    "mutationApproved": true
  }
}
```

Advanced callers can still use the generic escape hatch:

```json
{
  "tool": "remnawave_users_update",
  "arguments": {
    "uuid": "user-uuid",
    "data": { "description": "managed by automation" },
    "payload": { "tag": "ops" },
    "mutationApproved": true
  }
}
```

## Install

```bash
npm ci --include=dev
npm run build
```

Then point your MCP runtime at:

```bash
node /path/to/remnawave-tools-mcp/dist/index.js
```

Example environment:

```bash
REMNAWAVE_BASE_URL=https://remnawave.example.com
REMNAWAVE_API_TOKEN=your-token
REMNAWAVE_VERSION=2.7.4
REMNAWAVE_TOOLS_ALLOW_MUTATIONS=false
```

## Development

```bash
npm ci --include=dev
npm test
npm run build
```

Unit tests use a fake upstream MCP server and do not require a real Remnawave
token.

## Notes

- The operation catalog targets Remnawave `2.7.0` through `2.7.4` and fails closed if upstream discovery does not match.
- `responseMode=raw` is only allowed for safe system reads.
- This wrapper intentionally shells out to `remnawave-mcp@0.2.1` instead of reimplementing the Remnawave HTTP API.
