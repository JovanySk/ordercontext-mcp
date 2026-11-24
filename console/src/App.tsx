import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Moon, Sun } from "@phosphor-icons/react";
import { ArchStrip, type TraceState } from "./components/ArchStrip";
import { Presets, type Preset } from "./components/Presets";
import { ResponseViewer, errorKeyOf } from "./components/ResponseViewer";
import { SessionLog, ToolList } from "./components/Sidebar";
import { RequestPreview, ToolPanel } from "./components/ToolPanel";
import { BridgeHttpError, callTool, fetchTools } from "./lib/bridge";
import { I18nContext, dictionaries, type Lang } from "./lib/i18n";
import { buildArguments, fieldsFromSchema, type FormValues } from "./lib/schema";
import type { CallOutcome, Tool, ToolsResponse } from "./lib/types";

const HOP_MS = 110;
const MAX_LOG = 12;
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

function readPref<T extends string>(key: string, allowed: T[], fallback: T): T {
  try {
    const v = localStorage.getItem(key) as T | null;
    return v && allowed.includes(v) ? v : fallback;
  } catch {
    return fallback;
  }
}
function writePref(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage can be unavailable; the preference just will not persist */
  }
}

/** Where the trace stops for each outcome, so the strip shows which hop answered. */
function finalTrace(c: CallOutcome): TraceState {
  const ms = c.result?.durationMs ?? c.clientMs;
  switch (errorKeyOf(c)) {
    case null:
      return { phase: "done", durationMs: ms, reached: 4 };
    case "notFound":
      return { phase: "failed", at: 3, label: "404", durationMs: ms };
    case "api":
      return { phase: "failed", at: 3, label: "503", durationMs: ms };
    case "invalid":
      return { phase: "failed", at: 2, label: "-32602", durationMs: ms };
    case "tool":
      return { phase: "failed", at: 2, label: "isError", durationMs: ms };
    case "unknown":
      return { phase: "failed", at: 1, label: "unknown tool" };
    case "bridge":
      return { phase: "failed", at: 1, label: "offline" };
    case "mcp":
      return { phase: "failed", at: 2, label: "stdio" };
  }
}

export default function App() {
  const [lang, setLang] = useState<Lang>(() => readPref("mcp-console.lang", ["en", "es"], "en"));
  const [theme, setTheme] = useState<"dark" | "light">(() => readPref("mcp-console.theme", ["dark", "light"], "dark"));
  const t = dictionaries[lang];

  const [toolsRes, setToolsRes] = useState<ToolsResponse | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "offline">("loading");
  const [selected, setSelected] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, FormValues>>({});
  const [running, setRunning] = useState(false);
  const [calls, setCalls] = useState<CallOutcome[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [trace, setTrace] = useState<TraceState>({ phase: "idle" });
  const nextId = useRef(1);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    writePref("mcp-console.theme", theme);
  }, [theme]);
  useEffect(() => {
    document.documentElement.lang = lang;
    writePref("mcp-console.lang", lang);
  }, [lang]);

  const loadTools = useCallback(async () => {
    setLoadState("loading");
    try {
      const res = await fetchTools();
      setToolsRes(res);
      setLoadState("ready");
      setSelected((s) => s ?? res.tools.find((x) => x.name === "generate_order_context")?.name ?? res.tools[0]?.name ?? null);
    } catch {
      setLoadState("offline");
    }
  }, []);
  useEffect(() => {
    void loadTools();
  }, [loadTools]);

  const tools: Tool[] = toolsRes?.tools ?? [];
  const tool = tools.find((x) => x.name === selected) ?? null;
  const fields = useMemo(() => (tool ? fieldsFromSchema(tool.inputSchema) : []), [tool]);
  const formValues = (selected && values[selected]) || {};
  const args = buildArguments(fields, formValues);
  const preview = { jsonrpc: "2.0", id: nextId.current, method: "tools/call", params: { name: selected ?? "", arguments: args } };
  const activeCall = calls.find((c) => c.id === activeId) ?? null;

  const run = useCallback(
    async (toolName: string, callArgs: Record<string, unknown>) => {
      if (running) return;
      const id = nextId.current++;
      setRunning(true);
      let hop = 0;
      setTrace({ phase: "running", hop });
      const timer = setInterval(() => {
        hop = Math.min(hop + 1, 4);
        setTrace({ phase: "running", hop });
      }, HOP_MS);

      const started = performance.now();
      const outcome: CallOutcome = { id, at: new Date(), tool: toolName, args: callArgs, clientMs: 0 };
      const work = callTool(toolName, callArgs).then(
        (result) => {
          outcome.result = result;
        },
        (err: unknown) => {
          outcome.failure =
            err instanceof BridgeHttpError ? err.failure : { code: "BRIDGE_UNREACHABLE", message: String(err), httpStatus: 0 };
        },
      );
      await work;
      outcome.clientMs = performance.now() - started;
      // Let the trace reach the hop that answered; the real duration is reported separately.
      await delay(Math.max(0, HOP_MS * 4 - outcome.clientMs));
      clearInterval(timer);

      setTrace(finalTrace(outcome));
      setCalls((cs) => [outcome, ...cs].slice(0, MAX_LOG));
      setActiveId(id);
      setRunning(false);
      if (outcome.failure?.code === "BRIDGE_UNREACHABLE" || outcome.failure?.code === "MCP_UNAVAILABLE") setLoadState("offline");
      else if (loadState === "offline") void loadTools();
    },
    [running, loadState, loadTools],
  );

  const runCurrent = useCallback(() => {
    if (selected) void run(selected, args);
  }, [selected, args, run]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        runCurrent();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [runCurrent]);

  const runPreset = (p: Preset) => {
    setSelected(p.tool);
    setValues((v) => ({ ...v, [p.tool]: { ...p.args } }));
    const presetTool = tools.find((x) => x.name === p.tool);
    const presetArgs = presetTool ? buildArguments(fieldsFromSchema(presetTool.inputSchema), p.args) : {};
    void run(p.tool, presetArgs);
  };

  const pickCall = (c: CallOutcome) => {
    setActiveId(c.id);
    setSelected(c.tool);
    setValues((v) => ({ ...v, [c.tool]: Object.fromEntries(Object.entries(c.args).map(([k, x]) => [k, String(x)])) }));
    setTrace(finalTrace(c));
  };

  const server = toolsRes?.server;
  const conn = loadState === "ready" ? "ok" : loadState === "loading" ? "wait" : "off";

  return (
    <I18nContext.Provider value={{ lang, t }}>
      <div className="app">
        <header className="topbar">
          <div className="brand">
            <span className="brand-mark" aria-hidden>
              <span />
              <span />
            </span>
            <div className="brand-text">
              <h1>MCP Console</h1>
              <p>{t.appSubtitle}</p>
            </div>
          </div>
          <div className="topbar-right">
            <span className={`conn conn--${conn}`} title={server ? `${server.name} ${server.version}` : undefined}>
              <span className="conn-dot" aria-hidden />
              {conn === "ok" ? t.connected : conn === "wait" ? t.connecting : t.offline}
              {server && <code>{server.name}@{server.version}</code>}
            </span>
            <div className="seg seg--small" role="group" aria-label={t.langLabel}>
              {(["en", "es"] as const).map((l) => (
                <button key={l} type="button" className={lang === l ? "is-on" : ""} aria-pressed={lang === l} onClick={() => setLang(l)}>
                  {l.toUpperCase()}
                </button>
              ))}
            </div>
            <button type="button" className="icon-btn icon-btn--square" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} aria-label={t.themeToggle}>
              {theme === "dark" ? <Sun size={16} aria-hidden /> : <Moon size={16} aria-hidden />}
            </button>
          </div>
        </header>

        <ArchStrip trace={trace} />
        <Presets onRun={runPreset} disabled={running || tools.length === 0} />

        <main className="layout">
          <div className="col col--left">
            <ToolList tools={tools} selected={selected} onSelect={setSelected} />
            <SessionLog
              calls={calls}
              activeId={activeId}
              onPick={pickCall}
              onClear={() => {
                setCalls([]);
                setActiveId(null);
                setTrace({ phase: "idle" });
              }}
            />
          </div>
          <div className="col col--center">
            {tool && (
              <ToolPanel
                tool={tool}
                fields={fields}
                values={formValues}
                running={running}
                onRun={runCurrent}
                onChange={(name, value) => setValues((v) => ({ ...v, [tool.name]: { ...v[tool.name], [name]: value } }))}
              />
            )}
            {tool && <RequestPreview request={preview} />}
          </div>
          <div className="col col--right">
            <ResponseViewer key={activeCall?.id ?? 0} call={activeCall} running={running} />
          </div>
        </main>
      </div>
    </I18nContext.Provider>
  );
}
