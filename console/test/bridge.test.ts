import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { classifyToolError, createBridgeApp, mapThrownError, type ToolClient, type ToolInfo } from "../bridge/app";

const tools: ToolInfo[] = [
  {
    name: "get_order_by_id",
    title: "Get order",
    description: "Returns one bakery order.",
    inputSchema: { type: "object", properties: { orderId: { type: "integer", exclusiveMinimum: 0 } }, required: ["orderId"] },
    annotations: { readOnlyHint: true },
  },
  {
    name: "get_low_stock_products",
    description: "Products at or below minimum stock.",
    inputSchema: { type: "object", properties: {} },
    annotations: { readOnlyHint: true },
  },
];

function fakeClient(callTool: ToolClient["callTool"] = async () => ({ content: [{ type: "text", text: "{}" }] })) {
  return {
    listTools: vi.fn(async () => ({ tools })),
    callTool: vi.fn(callTool),
    getServerVersion: () => ({ name: "ordercontext", version: "1.0.0" }),
  };
}

function appWith(client: ReturnType<typeof fakeClient>, extra: Partial<Parameters<typeof createBridgeApp>[0]> = {}) {
  let t = 0;
  return createBridgeApp({ getClient: async () => client, now: () => (t += 12.34), ...extra });
}

describe("GET /bridge/tools", () => {
  it("returns the tools with input schemas and annotations from the MCP server", async () => {
    const res = await request(appWith(fakeClient())).get("/bridge/tools").expect(200);
    expect(res.body.server).toEqual({ name: "ordercontext", version: "1.0.0" });
    expect(res.body.tools.map((t: ToolInfo) => t.name)).toEqual(["get_order_by_id", "get_low_stock_products"]);
    expect(res.body.tools[0].inputSchema.required).toEqual(["orderId"]);
    expect(res.body.tools[0].annotations.readOnlyHint).toBe(true);
  });

  it("answers 503 when the MCP server cannot be spawned", async () => {
    const onConnectionLost = vi.fn();
    const app = createBridgeApp({ getClient: async () => { throw new Error("spawn node ENOENT"); }, onConnectionLost });
    const res = await request(app).get("/bridge/tools").expect(503);
    expect(res.body.error.code).toBe("MCP_UNAVAILABLE");
    expect(onConnectionLost).toHaveBeenCalled();
  });
});

describe("POST /bridge/call: tool name validation", () => {
  it("rejects a tool that the server does not list, without calling it", async () => {
    const client = fakeClient();
    const res = await request(appWith(client)).post("/bridge/call").send({ name: "delete_order", arguments: { orderId: 1 } }).expect(404);
    expect(res.body.error.code).toBe("UNKNOWN_TOOL");
    expect(res.body.error.availableTools).toContain("get_order_by_id");
    expect(client.callTool).not.toHaveBeenCalled();
  });

  it.each([
    [{}],
    [{ name: "" }],
    [{ name: 42 }],
    [{ name: "get_order_by_id", arguments: [1] }],
    [{ name: "get_order_by_id", arguments: "orderId=1" }],
  ])("rejects a malformed body %j with 400", async (body) => {
    const client = fakeClient();
    const res = await request(appWith(client)).post("/bridge/call").send(body).expect(400);
    expect(res.body.error.code).toBe("INVALID_REQUEST");
    expect(client.callTool).not.toHaveBeenCalled();
  });

  it("calls a listed tool and returns content, isError, the JSON-RPC request and the duration", async () => {
    const client = fakeClient(async () => ({ content: [{ type: "text", text: '{"id":10}' }] }));
    const res = await request(appWith(client)).post("/bridge/call").send({ name: "get_order_by_id", arguments: { orderId: 10 } }).expect(200);
    expect(client.callTool).toHaveBeenCalledWith({ name: "get_order_by_id", arguments: { orderId: 10 } });
    expect(res.body).toMatchObject({
      isError: false,
      errorKind: null,
      durationMs: 12.3,
      content: [{ type: "text", text: '{"id":10}' }],
      request: { jsonrpc: "2.0", method: "tools/call", params: { name: "get_order_by_id", arguments: { orderId: 10 } } },
    });
  });

  it("defaults missing arguments to an empty object", async () => {
    const client = fakeClient();
    await request(appWith(client)).post("/bridge/call").send({ name: "get_low_stock_products" }).expect(200);
    expect(client.callTool).toHaveBeenCalledWith({ name: "get_low_stock_products", arguments: {} });
  });
});

describe("error mapping", () => {
  it.each([
    ["Error 404: Resource not found", "not_found"],
    ["MCP error -32602: Input validation error: Invalid arguments for tool get_order_by_id", "invalid_arguments"],
    ["Error 503: The orders API is not reachable at http://localhost:8080/api", "api_unavailable"],
    ["Error 503: The orders API timed out at http://localhost:8080/api", "api_unavailable"],
    ["Unexpected error", "tool_error"],
  ])("classifies tool error %j as %s", (text, kind) => {
    expect(classifyToolError(text)).toBe(kind);
  });

  it("keeps a tool error as a 200 result with isError and its kind", async () => {
    const client = fakeClient(async () => ({ isError: true, content: [{ type: "text", text: "Error 404: Resource not found" }] }));
    const res = await request(appWith(client)).post("/bridge/call").send({ name: "get_order_by_id", arguments: { orderId: 999 } }).expect(200);
    expect(res.body.isError).toBe(true);
    expect(res.body.errorKind).toBe("not_found");
  });

  it.each([
    [new McpError(ErrorCode.InvalidParams, "bad params"), 400, "INVALID_ARGUMENTS"],
    [new McpError(ErrorCode.RequestTimeout, "timeout"), 504, "MCP_TIMEOUT"],
    [new McpError(ErrorCode.ConnectionClosed, "closed"), 503, "MCP_UNAVAILABLE"],
    [new McpError(ErrorCode.InternalError, "boom"), 502, "MCP_ERROR"],
    [new Error("socket hang up"), 503, "MCP_UNAVAILABLE"],
  ])("maps thrown %s to HTTP %i %s", (err, status, code) => {
    expect(mapThrownError(err)).toMatchObject({ status, code });
  });

  it("returns the mapped HTTP error and asks for a reconnect when the transport dies mid-call", async () => {
    const onConnectionLost = vi.fn();
    const client = fakeClient(async () => { throw new McpError(ErrorCode.ConnectionClosed, "Connection closed"); });
    const res = await request(appWith(client, { onConnectionLost })).post("/bridge/call").send({ name: "get_order_by_id", arguments: { orderId: 1 } }).expect(503);
    expect(res.body.error.code).toBe("MCP_UNAVAILABLE");
    expect(onConnectionLost).toHaveBeenCalledOnce();
  });

  it("maps a protocol timeout to 504", async () => {
    const client = fakeClient(async () => { throw new McpError(ErrorCode.RequestTimeout, "Request timed out"); });
    const res = await request(appWith(client)).post("/bridge/call").send({ name: "get_order_by_id", arguments: { orderId: 1 } }).expect(504);
    expect(res.body.error.code).toBe("MCP_TIMEOUT");
  });
});
