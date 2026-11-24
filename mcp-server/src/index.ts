#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { OrderApiClient } from "./apiClient.js";
import { registerTools } from "./tools.js";

const apiUrl = process.env.ORDER_API_URL ?? "http://localhost:8080/api";

const server = new McpServer({ name: "ordercontext", version: "1.0.0" });
registerTools(server, new OrderApiClient(apiUrl));

await server.connect(new StdioServerTransport());
// stdout carries the MCP protocol, so logs go to stderr
console.error(`ordercontext MCP server ready (API: ${apiUrl})`);
