import type { BridgeFailure, CallSuccess, ToolsResponse } from "./types";

export class BridgeHttpError extends Error {
  constructor(readonly failure: BridgeFailure) {
    super(failure.message);
  }
}

async function readJson(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

async function send<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, init);
  } catch (err) {
    throw new BridgeHttpError({ code: "BRIDGE_UNREACHABLE", message: (err as Error).message, httpStatus: 0 });
  }
  const body = (await readJson(res)) as { error?: { code: string; message: string } } | null;
  if (!res.ok) {
    // The Vite proxy answers 5xx with an empty body when the bridge process is down.
    const error = body?.error ?? { code: "BRIDGE_UNREACHABLE", message: `HTTP ${res.status} from the bridge` };
    throw new BridgeHttpError({ ...error, httpStatus: res.status });
  }
  return body as T;
}

export const fetchTools = () => send<ToolsResponse>("/bridge/tools");

export const callTool = (name: string, args: Record<string, unknown>) =>
  send<CallSuccess>("/bridge/call", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, arguments: args }),
  });
