/**
 * Environment-only configuration for the OpenAI Coordinator.
 *
 * Security rules enforced here:
 * - Secrets come ONLY from environment variables (server secret store).
 * - Missing or implausible values fail closed with a clear error that lists
 *   the variable NAMES — never their values.
 * - Nothing in this file (or this repo) contains a real secret.
 */

export interface CoordinatorConfig {
  openaiApiKey: string;
  coordinatorGatewayKey: string;
  gatewayUrl: string;
  openaiBaseUrl: string;
  openaiModel: string;
  pollIntervalMs: number;
  maxToolSteps: number;
  requestTimeoutMs: number;
}

export class ConfigError extends Error {
  readonly missing: string[];
  constructor(missing: string[], invalid: string[]) {
    const parts: string[] = [];
    if (missing.length) parts.push(`missing required environment variables: ${missing.join(", ")}`);
    if (invalid.length) parts.push(`invalid environment variables: ${invalid.join(", ")}`);
    super(`Coordinator configuration error — ${parts.join("; ")}. Refusing to start (fail closed).`);
    this.name = "ConfigError";
    this.missing = missing;
  }
}

export const DEFAULT_GATEWAY_URL =
  "https://mimgwleghecseoymgdug.supabase.co/functions/v1/agent-gateway";
export const DEFAULT_OPENAI_BASE_URL = "https://api.openai.com/v1";

function parsePositiveInt(raw: string | undefined, fallback: number, min: number, max: number): number | null {
  if (raw === undefined || raw.trim() === "") return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < min || n > max) return null;
  return n;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): CoordinatorConfig {
  const missing: string[] = [];
  const invalid: string[] = [];

  const openaiApiKey = (env.OPENAI_API_KEY ?? "").trim();
  if (!openaiApiKey) missing.push("OPENAI_API_KEY");

  const coordinatorGatewayKey = (env.COORDINATOR_GATEWAY_KEY ?? "").trim();
  if (!coordinatorGatewayKey) {
    missing.push("COORDINATOR_GATEWAY_KEY");
  } else if (coordinatorGatewayKey.length < 40 || coordinatorGatewayKey.length > 200) {
    // The gateway rejects keys outside 40..200 chars at authentication time;
    // fail here instead with a clearer message.
    invalid.push("COORDINATOR_GATEWAY_KEY (must be 40-200 chars)");
  }

  const gatewayUrl = (env.GATEWAY_URL ?? "").trim() || DEFAULT_GATEWAY_URL;
  if (!/^https?:\/\//.test(gatewayUrl)) invalid.push("GATEWAY_URL (must be an http(s) URL)");

  const openaiBaseUrl = (env.OPENAI_BASE_URL ?? "").trim() || DEFAULT_OPENAI_BASE_URL;
  if (!/^https?:\/\//.test(openaiBaseUrl)) invalid.push("OPENAI_BASE_URL (must be an http(s) URL)");

  const openaiModel = (env.OPENAI_MODEL ?? "").trim() || "gpt-5";

  const pollIntervalMs = parsePositiveInt(env.POLL_INTERVAL_MS, 15_000, 250, 3_600_000);
  if (pollIntervalMs === null) invalid.push("POLL_INTERVAL_MS (integer 250..3600000)");

  const maxToolSteps = parsePositiveInt(env.MAX_TOOL_STEPS, 8, 1, 32);
  if (maxToolSteps === null) invalid.push("MAX_TOOL_STEPS (integer 1..32)");

  const requestTimeoutMs = parsePositiveInt(env.REQUEST_TIMEOUT_MS, 30_000, 1_000, 300_000);
  if (requestTimeoutMs === null) invalid.push("REQUEST_TIMEOUT_MS (integer 1000..300000)");

  if (missing.length || invalid.length) throw new ConfigError(missing, invalid);

  return {
    openaiApiKey,
    coordinatorGatewayKey,
    gatewayUrl: gatewayUrl.replace(/\/+$/, ""),
    openaiBaseUrl: openaiBaseUrl.replace(/\/+$/, ""),
    openaiModel,
    pollIntervalMs: pollIntervalMs as number,
    maxToolSteps: maxToolSteps as number,
    requestTimeoutMs: requestTimeoutMs as number,
  };
}

/** Summary safe to print: names and non-secret settings only. */
export function redactedSummary(cfg: CoordinatorConfig): Record<string, unknown> {
  return {
    gatewayUrl: cfg.gatewayUrl,
    openaiBaseUrl: cfg.openaiBaseUrl,
    openaiModel: cfg.openaiModel,
    pollIntervalMs: cfg.pollIntervalMs,
    maxToolSteps: cfg.maxToolSteps,
    requestTimeoutMs: cfg.requestTimeoutMs,
    openaiApiKey: cfg.openaiApiKey ? "<set, redacted>" : "<missing>",
    coordinatorGatewayKey: cfg.coordinatorGatewayKey ? "<set, redacted>" : "<missing>",
  };
}
