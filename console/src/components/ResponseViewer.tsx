import { useMemo, useState } from "react";
import { CloudSlash, MagnifyingGlass, Prohibit, Question, Terminal, Timer, WarningOctagon, type Icon } from "@phosphor-icons/react";
import { useI18n, type Dict } from "../lib/i18n";
import type { CallOutcome } from "../lib/types";
import { BriefView } from "./BriefView";
import { JsonTree, type Json, type TreeMode } from "./JsonTree";

type ErrorKey = "notFound" | "invalid" | "api" | "tool" | "bridge" | "mcp" | "unknown";

const ERRORS: Record<ErrorKey, { icon: Icon; title: keyof Dict; body: keyof Dict; hint?: keyof Dict; code: string }> = {
  notFound: { icon: MagnifyingGlass, title: "errNotFoundTitle", body: "errNotFoundBody", code: "404" },
  invalid: { icon: Prohibit, title: "errInvalidTitle", body: "errInvalidBody", code: "-32602" },
  api: { icon: CloudSlash, title: "errApiTitle", body: "errApiBody", hint: "errApiHint", code: "503" },
  tool: { icon: WarningOctagon, title: "errToolTitle", body: "errToolBody", code: "isError" },
  bridge: { icon: CloudSlash, title: "errBridgeTitle", body: "errBridgeBody", hint: "errBridgeHint", code: "bridge" },
  mcp: { icon: Terminal, title: "errMcpTitle", body: "errMcpBody", hint: "errMcpHint", code: "stdio" },
  unknown: { icon: Question, title: "errUnknownTitle", body: "errUnknownBody", code: "404" },
};

export function errorKeyOf(c: CallOutcome): ErrorKey | null {
  if (c.failure) {
    if (c.failure.code === "UNKNOWN_TOOL") return "unknown";
    if (c.failure.code === "INVALID_ARGUMENTS") return "invalid";
    if (c.failure.code === "BRIDGE_UNREACHABLE") return "bridge";
    return "mcp";
  }
  if (!c.result?.isError) return null;
  switch (c.result.errorKind) {
    case "not_found":
      return "notFound";
    case "invalid_arguments":
      return "invalid";
    case "api_unavailable":
      return "api";
    default:
      return "tool";
  }
}

const textOf = (c: CallOutcome) => (c.result?.content ?? []).map((b) => b.text ?? "").join("\n");

function ErrorCard({ k, message, call }: { k: ErrorKey; message: string; call: CallOutcome }) {
  const { t } = useI18n();
  const e = ERRORS[k];
  const Ico = e.icon;
  return (
    <div className="err-card" role="alert">
      <div className="err-icon">
        <Ico size={20} weight="duotone" aria-hidden />
      </div>
      <div className="err-body">
        <div className="err-title-row">
          <h3 className="err-title">{t[e.title]}</h3>
          <code className="err-code">{e.code}</code>
        </div>
        <p className="err-text">{t[e.body]}</p>
        <div className="err-raw">
          <span className="eyebrow">{t.whatAssistantSees}</span>
          <pre>{message}</pre>
        </div>
        <p className="err-call">
          <code>
            {call.tool}({JSON.stringify(call.args)})
          </code>
        </p>
        {e.hint && <p className="err-hint">{t[e.hint]}</p>}
      </div>
    </div>
  );
}

function tryJson(text: string): { ok: true; value: Json } | { ok: false } {
  const s = text.trim();
  if (!s.startsWith("{") && !s.startsWith("[")) return { ok: false };
  try {
    return { ok: true, value: JSON.parse(s) as Json };
  } catch {
    return { ok: false };
  }
}

export function ResponseViewer({ call, running }: { call: CallOutcome | null; running: boolean }) {
  const { t } = useI18n();
  const [view, setView] = useState<"rendered" | "raw">("rendered");
  const [tree, setTree] = useState<{ mode: TreeMode; nonce: number }>({ mode: "default", nonce: 0 });
  const setTreeMode = (mode: TreeMode) => setTree((x) => ({ mode, nonce: x.nonce + 1 }));
  const text = call ? textOf(call) : "";
  const parsed = useMemo(() => tryJson(text), [text]);

  if (!call) {
    return (
      <section className="panel response" aria-labelledby="resp-title">
        <header className="panel-head">
          <h2 id="resp-title" className="panel-title">{t.response}</h2>
        </header>
        <div className={`resp-empty${running ? " is-running" : ""}`}>
          <div className="resp-empty-art" aria-hidden>
            <span />
            <span />
            <span />
          </div>
          <p className="resp-empty-title">{t.responseEmpty}</p>
          <p className="resp-empty-hint">{t.responseEmptyHint}</p>
        </div>
      </section>
    );
  }

  const errKey = errorKeyOf(call);
  const status = call.failure ? t.bridgeError : call.result?.isError ? t.toolError : t.ok;
  const ms = call.result?.durationMs ?? call.clientMs;
  const isBrief = call.tool === "generate_order_context" && !errKey;
  const canToggle = !errKey && (isBrief || parsed.ok);
  const effective = canToggle ? view : "raw";

  return (
    <section className={`panel response${running ? " is-stale" : ""}`} aria-labelledby="resp-title" aria-busy={running}>
      <header className="panel-head panel-head--row resp-head">
        <div className="resp-head-left">
          <h2 id="resp-title" className="panel-title">{t.response}</h2>
          <span className={`status ${errKey ? "status--err" : "status--ok"}`}>{status}</span>
          <code className="resp-tool">{call.tool}</code>
        </div>
        <div className="resp-meta">
          <span title="Measured by the bridge around client.callTool">
            <Timer size={13} aria-hidden /> {ms.toFixed(1)} ms
          </span>
          {!call.failure && (
            <span title="Approximate: characters / 4">
              {text.length.toLocaleString()} {t.chars} · ≈{Math.ceil(text.length / 4).toLocaleString()} {t.tokens}
            </span>
          )}
        </div>
      </header>

      {canToggle && (
        <div className="resp-bar">
        <div className="seg" role="tablist" aria-label={t.response}>
          <button type="button" role="tab" aria-selected={view === "rendered"} className={view === "rendered" ? "is-on" : ""} onClick={() => setView("rendered")}>
            {isBrief ? t.rendered : "JSON"}
          </button>
          <button type="button" role="tab" aria-selected={view === "raw"} className={view === "raw" ? "is-on" : ""} onClick={() => setView("raw")}>
            {t.raw}
          </button>
        </div>
          {!isBrief && effective === "rendered" && (
            <div className="resp-bar-tools">
              <button type="button" className="link-btn" onClick={() => setTreeMode("all")}>
                {t.expandAll}
              </button>
              <button type="button" className="link-btn" onClick={() => setTreeMode("none")}>
                {t.collapseAll}
              </button>
            </div>
          )}
        </div>
      )}

      <div className="resp-body">
        {errKey ? (
          <ErrorCard k={errKey} message={call.failure ? `${call.failure.code}: ${call.failure.message}` : text} call={call} />
        ) : effective === "raw" ? (
          <pre className="code-block code-block--raw">{text}</pre>
        ) : isBrief ? (
          <BriefView text={text} />
        ) : parsed.ok ? (
          <JsonTree key={`${call.id}-${tree.nonce}`} data={parsed.value} mode={tree.mode} />
        ) : (
          <pre className="code-block code-block--raw">{text}</pre>
        )}
      </div>
    </section>
  );
}
