const SECRET_PATTERN = /(token|secret|private|key|uuid|subscription|authorization|bearer|shortuuid|short_uuid|url)/i;

export function log(level: "debug" | "info" | "warn" | "error", message: string, meta?: unknown): void {
  const configured = process.env.LOG_LEVEL ?? "warn";
  const order = ["debug", "info", "warn", "error"];
  if (order.indexOf(level) < order.indexOf(configured)) return;
  const suffix = meta === undefined ? "" : ` ${redact(meta)}`;
  console.error(`[remnawave-tools] ${level}: ${message}${suffix}`);
}

export function redact(value: unknown): string {
  return JSON.stringify(redactValue(value), null, 0);
}

export function redactValue(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value, (key, inner) => {
    if (SECRET_PATTERN.test(key)) return "[REDACTED]";
    if (typeof inner === "string" && /(https?:\/\/|vless:\/\/|trojan:\/\/|ss:\/\/|eyJ|[A-Za-z0-9_-]{24,})/.test(inner)) {
      return "[REDACTED]";
    }
    return inner;
  }));
}
