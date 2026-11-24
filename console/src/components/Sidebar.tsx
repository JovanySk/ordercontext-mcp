import { ClockCounterClockwise, LockSimple, Wrench } from "@phosphor-icons/react";
import { useI18n } from "../lib/i18n";
import type { CallOutcome, Tool } from "../lib/types";

export function ToolList({ tools, selected, onSelect }: { tools: Tool[]; selected: string | null; onSelect: (name: string) => void }) {
  const { t } = useI18n();
  return (
    <section className="panel tools" aria-labelledby="tools-title">
      <header className="panel-head">
        <h2 id="tools-title" className="panel-title">
          <Wrench size={15} aria-hidden /> {t.tools}
          <span className="count">{tools.length}</span>
        </h2>
        <p className="panel-hint">{t.toolsHint}</p>
      </header>
      {tools.length === 0 ? (
        <p className="empty-line">{t.noTools}</p>
      ) : (
        <ul className="tool-list" role="listbox" aria-label={t.tools}>
          {tools.map((tool) => {
            const active = tool.name === selected;
            return (
              <li key={tool.name}>
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  className={`tool-item${active ? " is-active" : ""}`}
                  onClick={() => onSelect(tool.name)}
                >
                  <span className="tool-item-top">
                    <code className="tool-name">{tool.name}</code>
                    {tool.annotations?.readOnlyHint && (
                      <span className="badge badge--accent" title="annotations.readOnlyHint = true">
                        <LockSimple size={11} weight="bold" aria-hidden /> {t.readOnly}
                      </span>
                    )}
                  </span>
                  {tool.description && <span className="tool-desc">{tool.description}</span>}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

const shortArgs = (args: Record<string, unknown>) => {
  const entries = Object.entries(args);
  return entries.length ? entries.map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(" ") : "{}";
};

export function SessionLog({
  calls,
  activeId,
  onPick,
  onClear,
}: {
  calls: CallOutcome[];
  activeId: number | null;
  onPick: (c: CallOutcome) => void;
  onClear: () => void;
}) {
  const { t, lang } = useI18n();
  const fmt = new Intl.DateTimeFormat(lang === "es" ? "es-MX" : "en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
  return (
    <section className="panel log" aria-labelledby="log-title">
      <header className="panel-head panel-head--row">
        <h2 id="log-title" className="panel-title">
          <ClockCounterClockwise size={15} aria-hidden /> {t.session}
          {calls.length > 0 && <span className="count">{calls.length}</span>}
        </h2>
        {calls.length > 0 && (
          <button type="button" className="link-btn" onClick={onClear}>
            {t.clear}
          </button>
        )}
      </header>
      {calls.length === 0 ? (
        <p className="empty-line">{t.sessionEmpty}</p>
      ) : (
        <ol className="log-list">
          {calls.map((c) => {
            const failed = !!c.failure || !!c.result?.isError;
            const ms = c.result?.durationMs ?? c.clientMs;
            return (
              <li key={c.id}>
                <button type="button" className={`log-row${c.id === activeId ? " is-active" : ""}`} onClick={() => onPick(c)}>
                  <span className={`dot ${failed ? "dot--err" : "dot--ok"}`} aria-label={failed ? t.toolError : t.ok} />
                  <span className="log-main">
                    <code className="log-tool">{c.tool}</code>
                    <code className="log-args">{shortArgs(c.args)}</code>
                  </span>
                  <span className="log-meta">
                    <span>{ms.toFixed(0)} ms</span>
                    <span>{fmt.format(c.at)}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
