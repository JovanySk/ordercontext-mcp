export interface JsonSchemaProperty {
  type?: string | string[];
  description?: string;
  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: number;
  exclusiveMaximum?: number;
  enum?: (string | number)[];
  default?: unknown;
}

export interface ToolSchema {
  type?: string;
  properties?: Record<string, JsonSchemaProperty>;
  required?: string[];
}

export interface Tool {
  name: string;
  title?: string;
  description?: string;
  inputSchema: ToolSchema;
  annotations?: {
    readOnlyHint?: boolean;
    destructiveHint?: boolean;
    idempotentHint?: boolean;
    openWorldHint?: boolean;
  };
}

export interface ToolsResponse {
  server: { name: string; version: string } | null;
  tools: Tool[];
}

export type ToolErrorKind = "not_found" | "invalid_arguments" | "api_unavailable" | "tool_error";

export interface CallSuccess {
  request: { jsonrpc: string; id: number; method: string; params: { name: string; arguments: Record<string, unknown> } };
  content: { type: string; text?: string }[];
  isError: boolean;
  errorKind: ToolErrorKind | null;
  durationMs: number;
}

export interface BridgeFailure {
  code: string;
  message: string;
  httpStatus: number;
}

/** What one run produced: either an MCP result (possibly a tool error) or a bridge-level failure. */
export interface CallOutcome {
  id: number;
  at: Date;
  tool: string;
  args: Record<string, unknown>;
  result?: CallSuccess;
  failure?: BridgeFailure;
  clientMs: number;
}
