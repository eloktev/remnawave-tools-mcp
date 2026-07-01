import { z } from "zod";
import { classifyOperation, type OperationSafety } from "./catalog.js";

export type ToolInputShape = Record<string, z.ZodTypeAny>;

const controlShape = {
  responseMode: z.enum(["normalized", "raw"]).optional().default("normalized"),
  confirmToken: z.string().optional(),
  mutationApproved: z.boolean().optional().default(false),
  confirmPhrase: z.string().optional(),
};

const payloadShape = {
  payload: z.record(z.unknown()).optional().default({}),
};

const dataShape = {
  data: z.record(z.unknown()).optional().default({}),
};

const identifierShape = {
  uuid: z.string().min(1).optional(),
  id: z.string().min(1).optional(),
};

const userLookupShape = {
  ...identifierShape,
  username: z.string().min(1).optional(),
  email: z.string().min(1).optional(),
  shortUuid: z.string().min(1).optional(),
  tag: z.string().min(1).optional(),
  telegramId: z.union([z.string(), z.number()]).optional(),
};

const paginationShape = {
  page: z.number().int().positive().optional(),
  limit: z.number().int().positive().max(1000).optional(),
  search: z.string().optional(),
};

const nodeFieldsShape = {
  name: z.string().min(1).optional(),
  address: z.string().min(1).optional(),
  port: z.number().int().positive().max(65535).optional(),
  isDisabled: z.boolean().optional(),
  countryCode: z.string().optional(),
  providerUuid: z.string().optional(),
  configProfileUuid: z.string().optional(),
  activeConfigProfileUuid: z.string().optional(),
};

const squadFieldsShape = {
  name: z.string().min(1).optional(),
  inbounds: z.array(z.string()).optional(),
  members: z.array(z.string()).optional(),
  userUuids: z.array(z.string()).optional(),
};

const userFieldsShape = {
  username: z.string().min(1).optional(),
  email: z.string().min(1).optional(),
  status: z.string().optional(),
  tag: z.string().optional(),
  telegramId: z.union([z.string(), z.number()]).optional(),
  description: z.string().optional(),
  expireAt: z.union([z.string(), z.number(), z.null()]).optional(),
  trafficLimitBytes: z.number().int().nonnegative().optional(),
  trafficLimitStrategy: z.string().optional(),
  activeInternalSquads: z.array(z.string()).optional(),
  activeExternalSquads: z.array(z.string()).optional(),
};

export const genericOperationInputSchema: ToolInputShape = {
  ...payloadShape,
  ...controlShape,
};

export function operationInputSchema(domain: string, operation: string): ToolInputShape {
  const safety = classifyOperation(domain, operation);
  const dangerous = isDangerousMutation(domain, operation);
  const base = dangerous ? { ...controlShape, confirmPhrase: z.string().optional() } : controlShape;

  if (domain === "nodes") {
    if (operation === "list" || operation === "list_tags") return { ...paginationShape, ...payloadShape, ...base };
    if (operation === "get") return { ...identifierShape, ...payloadShape, ...base };
    if (["create", "update"].includes(operation)) return { ...identifierShape, ...nodeFieldsShape, ...dataShape, ...payloadShape, ...base };
    if (["disable", "enable", "restart", "delete", "reset_traffic"].includes(operation)) return { ...identifierShape, ...payloadShape, ...base };
  }

  if (domain === "internal_squads" || domain === "external_squads") {
    if (operation === "list") return { ...paginationShape, ...payloadShape, ...base };
    if (operation === "get") return { ...identifierShape, ...payloadShape, ...base };
    if (["create", "update"].includes(operation)) return { ...identifierShape, ...squadFieldsShape, ...dataShape, ...payloadShape, ...base };
    if (["add_users", "remove_users"].includes(operation)) {
      return {
        ...identifierShape,
        squadUuid: z.string().min(1).optional(),
        userUuids: z.array(z.string().min(1)).min(1).optional(),
        users: z.array(z.string().min(1)).min(1).optional(),
        ...payloadShape,
        ...base,
      };
    }
    if (["delete", "reorder"].includes(operation)) return { ...identifierShape, ...payloadShape, ...base };
  }

  if (domain === "users") {
    if (operation === "list" || operation === "list_tags") return { ...paginationShape, ...payloadShape, ...base };
    if (operation === "get" || operation.startsWith("get_by_") || operation === "resolve") return { ...userLookupShape, ...payloadShape, ...base };
    if (["create", "update"].includes(operation)) return { ...userLookupShape, ...userFieldsShape, ...dataShape, ...payloadShape, ...base };
    if (["disable", "enable", "delete", "reset_traffic", "revoke_subscription"].includes(operation)) return { ...userLookupShape, ...payloadShape, ...base };
  }

  return safety === "mutation" ? { ...genericOperationInputSchema, confirmPhrase: z.string().optional() } : genericOperationInputSchema;
}

export interface NormalizedOperationInput {
  payload: Record<string, unknown>;
  responseMode: "normalized" | "raw";
  confirmToken?: string;
  mutationApproved: boolean;
  confirmPhrase?: string;
}

export function normalizeOperationInput(args: Record<string, unknown>): NormalizedOperationInput {
  const responseMode = args.responseMode === "raw" ? "raw" : "normalized";
  const mutationApproved = args.mutationApproved === true;
  const confirmToken = typeof args.confirmToken === "string" ? args.confirmToken : undefined;
  const confirmPhrase = typeof args.confirmPhrase === "string" ? args.confirmPhrase : undefined;
  const payload = mergePayload(args, new Set(["responseMode", "confirmToken", "mutationApproved", "confirmPhrase"]));
  return { payload, responseMode, confirmToken, mutationApproved, confirmPhrase };
}

export function mergePayload(args: Record<string, unknown>, controlKeys = new Set<string>()): Record<string, unknown> {
  const directPayload = isRecord(args.payload) ? args.payload : {};
  const data = isRecord(args.data) ? args.data : {};
  const payload: Record<string, unknown> = { ...directPayload, ...data };
  for (const [key, value] of Object.entries(args)) {
    if (controlKeys.has(key) || key === "payload" || key === "data" || value === undefined) continue;
    payload[key] = value;
  }
  return payload;
}

export function isDangerousMutation(domain: string, operation: string): boolean {
  return (
    operation === "delete" ||
    operation === "bulk_delete" ||
    operation === "bulk_delete_by_status" ||
    operation === "restart_all" ||
    operation.startsWith("bulk_") ||
    (domain === "hwid" && operation.startsWith("delete_"))
  );
}

export function dangerousMutationConfirmed(domain: string, operation: string, confirmPhrase?: string): boolean {
  if (!isDangerousMutation(domain, operation)) return true;
  return confirmPhrase === `confirm ${domain}.${operation}`;
}

export const operatorTools = [
  "remnawave_node_get_config",
  "remnawave_node_update_config",
  "remnawave_squad_add_users",
  "remnawave_user_suspend",
  "remnawave_user_set_squads",
] as const;

export type OperatorToolName = (typeof operatorTools)[number];

export function operatorToolSpec(name: OperatorToolName): { description: string; inputSchema: ToolInputShape; domain: string; operation: string } {
  switch (name) {
    case "remnawave_node_get_config":
      return {
        description: "Get a Remnawave node by uuid/id.",
        inputSchema: { ...identifierShape, ...controlShape },
        domain: "nodes",
        operation: "get",
      };
    case "remnawave_node_update_config":
      return {
        description: "Update a Remnawave node using typed common fields plus optional data.",
        inputSchema: { ...identifierShape, ...nodeFieldsShape, ...dataShape, ...controlShape },
        domain: "nodes",
        operation: "update",
      };
    case "remnawave_squad_add_users":
      return {
        description: "Add users to an internal or external Remnawave squad.",
        inputSchema: {
          squadType: z.enum(["internal", "external"]).default("internal"),
          squadUuid: z.string().min(1),
          userUuids: z.array(z.string().min(1)).min(1),
          ...controlShape,
        },
        domain: "internal_squads",
        operation: "add_users",
      };
    case "remnawave_user_suspend":
      return {
        description: "Disable a Remnawave user by uuid, username, email, shortUuid, tag, or telegramId.",
        inputSchema: { ...userLookupShape, ...controlShape },
        domain: "users",
        operation: "disable",
      };
    case "remnawave_user_set_squads":
      return {
        description: "Update a user's active internal/external squads.",
        inputSchema: {
          ...userLookupShape,
          activeInternalSquads: z.array(z.string()).optional(),
          activeExternalSquads: z.array(z.string()).optional(),
          ...controlShape,
        },
        domain: "users",
        operation: "update",
      };
  }
}

export function operatorTarget(name: OperatorToolName, args: Record<string, unknown>): { domain: string; operation: string; payload: Record<string, unknown> } {
  const spec = operatorToolSpec(name);
  if (name === "remnawave_squad_add_users") {
    const domain = args.squadType === "external" ? "external_squads" : "internal_squads";
    return { domain, operation: "add_users", payload: { squadUuid: args.squadUuid, userUuids: args.userUuids } };
  }
  return { domain: spec.domain, operation: spec.operation, payload: mergePayload(args, new Set(["responseMode", "confirmToken", "mutationApproved", "confirmPhrase"])) };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
