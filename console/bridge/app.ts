import express, { type Request, type Response } from "express";
import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";

/**
 * HTTP bridge between the browser and the MCP server.
 * The browser cannot speak stdio, so this tiny Express app holds one MCP client
 * and exposes the two things the console needs: the tool list and tool calls.
 */

export interface ToolInfo {
  name: string;
  title?: string;
  description?: string;
  inputSchema: Record<string, unknown>;
  annotations?: Record<string, unknown>;
}

export interface ToolCallResult {
  content?: unknown;
  isError?: boolean;
}

/** The subset of the MCP SDK Client the bridge uses, so tests can pass a fake. */
export interface ToolClient {
  listTools(): Promise<{ tools: ToolInfo[] }>;
  callTool(params: { name: string; arguments?: Record<string, unknown> }): Promise<ToolCallResult>;
  getServerVersion?(): { name: string; version: string } | undefined;
}

export type ToolErrorKind = "not_found" | "invalid_arguments" | "api_unavailable" | "tool_error";

export interface BridgeError {
  status: number;
  code: "INVALID_REQUEST" | "UNKNOWN_TOOL" | "INVALID_ARGUMENTS" | "MCP_TIMEOUT" | "MCP_UNAVAILABLE" | "MCP_ERROR";
  message: string;
}

const firstText = (content: unknown): string => {
  if (!Array.isArray(content)) return "";
  const block = content.find((c) => c && typeof c === "object" && (c as { type?: string }).type === "text");
  return block ? String((block as { text?: unknown }).text ?? "") : "";
};

/**
 * A tool error is a normal MCP result with isError=true. The text tells us why,
 * so the console can show a specific card instead of a generic failure.
 */
export function classifyToolError(text: string): ToolErrorKind {
  if (/-32602|input validation|invalid arguments/i.test(text)) return "invalid_arguments";
  if (/\b404\b|not found/i.test(text)) return "not_found";
  if (/\b503\b|not reachable|timed out/i.test(text)) return "api_unavailable";
  return "tool_error";
}

/** Errors thrown by the MCP client (protocol or transport level) become HTTP errors. */
export function mapThrownError(err: unknown): BridgeError {
  if (err instanceof McpError) {
    switch (err.code) {
      case ErrorCode.InvalidParams:
        return { status: 400, code: "INVALID_ARGUMENTS", message: err.message };
      case ErrorCode.RequestTimeout:
        return { status: 504, code: "MCP_TIMEOUT", message: "The MCP server did not answer in time" };
      case ErrorCode.ConnectionClosed:
        return { status: 503, code: "MCP_UNAVAILABLE", message: "The MCP server connection is closed" };
      default:
        return { status: 502, code: "MCP_ERROR", message: err.message };
    }
  }
  const message = err instanceof Error ? err.message : String(err);
  return { status: 503, code: "MCP_UNAVAILABLE", message: `Could not reach the MCP server: ${message}` };
}

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

export interface BridgeOptions {
  getClient: () => Promise<ToolClient>;
  /** Called after a transport-level failure so the next request reconnects. */
  onConnectionLost?: () => void;
  apiUrl?: string;
  now?: () => number;
}

export function createBridgeApp({ getClient, onConnectionLost, apiUrl, now = () => performance.now() }: BridgeOptions) {
  const app = express();
  app.use(express.json({ limit: "32kb" }));

  let toolCache: ToolInfo[] | null = null;
  let rpcId = 0;

  const sendError = (res: Response, e: BridgeError, extra: Record<string, unknown> = {}) =>
    res.status(e.status).json({ error: { code: e.code, message: e.message, ...extra } });

  const fail = (res: Response, err: unknown) => {
    const mapped = mapThrownError(err);
    if (mapped.code === "MCP_UNAVAILABLE") {
      toolCache = null;
      onConnectionLost?.();
    }
    sendError(res, mapped);
  };

  const loadTools = async (refresh = false) => {
    if (!toolCache || refresh) {
      const client = await getClient();
      const { tools } = await client.listTools();
      toolCache = tools.map(({ name, title, description, inputSchema, annotations }) => ({
        name, title, description, inputSchema, annotations,
      }));
    }
    return toolCache;
  };

  app.get("/bridge/health", async (_req: Request, res: Response) => {
    try {
      const client = await getClient();
      res.json({ ok: true, server: client.getServerVersion?.() ?? null, apiUrl: apiUrl ?? null });
    } catch (err) {
      fail(res, err);
    }
  });

  app.get("/bridge/tools", async (_req: Request, res: Response) => {
    try {
      const client = await getClient();
      const tools = await loadTools(true);
      res.json({ server: client.getServerVersion?.() ?? null, tools });
    } catch (err) {
      fail(res, err);
    }
  });

  app.post("/bridge/call", async (req: Request, res: Response) => {
    const body: unknown = req.body;
    if (!isPlainObject(body) || typeof body.name !== "string" || body.name.trim() === "") {
      return sendError(res, { status: 400, code: "INVALID_REQUEST", message: "Body must be { name: string, arguments?: object }" });
    }
    if (body.arguments !== undefined && !isPlainObject(body.arguments)) {
      return sendError(res, { status: 400, code: "INVALID_REQUEST", message: "arguments must be a JSON object" });
    }
    const name = body.name;
    const args = (body.arguments ?? {}) as Record<string, unknown>;

    try {
      const tools = await loadTools();
      if (!tools.some((t) => t.name === name)) {
        return sendError(
          res,
          { status: 404, code: "UNKNOWN_TOOL", message: `"${name}" is not a tool exposed by the MCP server` },
          { availableTools: tools.map((t) => t.name) },
        );
      }

      const client = await getClient();
      const request = { jsonrpc: "2.0", id: ++rpcId, method: "tools/call", params: { name, arguments: args } };
      const started = now();
      const result = await client.callTool({ name, arguments: args });
      const durationMs = Math.round((now() - started) * 10) / 10;
      const isError = result.isError === true;

      res.json({
        request,
        content: result.content ?? [],
        isError,
        errorKind: isError ? classifyToolError(firstText(result.content)) : null,
        durationMs,
      });
    } catch (err) {
      fail(res, err);
    }
  });

  return app;
}
