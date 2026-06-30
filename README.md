# Remnawave Tools MCP

Flat, safety-gated stdio MCP wrapper for `remnawave-mcp@0.2.1`.

The upstream Remnawave MCP exposes a generic `remnawave_api` tool. This wrapper exposes one MCP tool per Remnawave domain operation, for example:

- `remnawave_system_get_health`
- `remnawave_nodes_list`
- `remnawave_users_get`
- `remnawave_subscription_settings_get`

It also exposes:

- `remnawave_discover`
- `remnawave_describe`

## Safety

Credentials are read only from environment variables:

- `REMNAWAVE_BASE_URL`
- `REMNAWAVE_API_TOKEN`
- `REMNAWAVE_VERSION`

Mutating operations are locally blocked unless both are true:

- `REMNAWAVE_TOOLS_ALLOW_MUTATIONS=true`
- the MCP call sets `mutationApproved=true`

By default, mutating calls return `LOCAL_MUTATION_BLOCKED` and are not forwarded upstream.

Sensitive read results are redacted before returning through this wrapper for user, subscription, connection-key, short-UUID, and device-oriented operations.

## Install

```bash
npm install
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
npm install
npm test
npm run build
```

Unit tests use a fake upstream MCP server and do not require a real Remnawave token.

## Notes

- The operation catalog targets Remnawave `2.7.0` through `2.7.4` and fails closed if upstream discovery does not match.
- `responseMode=raw` is only allowed for safe system reads.
- This wrapper intentionally shells out to `remnawave-mcp@0.2.1` instead of reimplementing the Remnawave HTTP API.
