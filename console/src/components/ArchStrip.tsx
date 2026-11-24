import { AppWindow, Database, HardDrives, Plugs, TerminalWindow, type Icon } from "@phosphor-icons/react";
import { useI18n, type Dict } from "../lib/i18n";

export type TraceState =
  | { phase: "idle" }
  | { phase: "running"; hop: number }
  | { phase: "done"; durationMs: number; reached: number }
  | { phase: "failed"; at: number; label: string; durationMs?: number };

const NODES: { icon: Icon; name: keyof Dict; sub: keyof Dict }[] = [
  { icon: AppWindow, name: "hopBrowser", sub: "hopBrowserSub" },
  { icon: Plugs, name: "hopBridge", sub: "hopBridgeSub" },
  { icon: TerminalWindow, name: "hopMcp", sub: "hopMcpSub" },
  { icon: HardDrives, name: "hopApi", sub: "hopApiSub" },
  { icon: Database, name: "hopDb", sub: "hopDbSub" },
];

const LINKS: (keyof Dict)[] = ["linkHttp", "linkRpc", "linkGet", "linkJpa"];

type NodeState = "idle" | "active" | "lit" | "failed" | "skipped";

function nodeState(trace: TraceState, i: number): NodeState {
  switch (trace.phase) {
    case "idle":
      return "idle";
    case "running":
      return i === trace.hop ? "active" : i < trace.hop ? "lit" : "idle";
    case "done":
      return i <= trace.reached ? "lit" : "skipped";
    case "failed":
      return i === trace.at ? "failed" : i < trace.at ? "lit" : "skipped";
  }
}

/** Browser to database, drawn with plain boxes. The hop being called lights up during a run. */
export function ArchStrip({ trace }: { trace: TraceState }) {
  const { t } = useI18n();

  let status: string;
  if (trace.phase === "running") status = `${t.archRunning} ${t[NODES[trace.hop].name]}`;
  else if (trace.phase === "done") status = `${t.archDone} ${trace.durationMs.toFixed(1)} ms`;
  else if (trace.phase === "failed") status = `${t.archFailed} ${t[NODES[trace.at].name]}: ${trace.label}`;
  else status = t.archIdle;

  return (
    <section className="arch" aria-label={t.archTitle}>
      <div className="arch-head">
        <span className="eyebrow">{t.archTitle}</span>
        <span className={`arch-status arch-status--${trace.phase}`} aria-live="polite">
          {status}
        </span>
      </div>
      <ol className="arch-track">
        {NODES.map((n, i) => {
          const state = nodeState(trace, i);
          const linkState = i < NODES.length - 1 ? nodeState(trace, i + 1) : null;
          const Ico = n.icon;
          return (
            <li key={n.name} className="arch-cell">
              <div className={`arch-node arch-node--${state}`}>
                <Ico size={18} weight={state === "idle" || state === "skipped" ? "regular" : "duotone"} aria-hidden />
                <div className="arch-node-text">
                  <span className="arch-node-name">{t[n.name]}</span>
                  <span className="arch-node-sub">{t[n.sub]}</span>
                </div>
                {state === "failed" && trace.phase === "failed" && <span className="arch-node-flag">{trace.label}</span>}
              </div>
              {linkState && (
                <div className={`arch-link arch-link--${linkState}`} aria-hidden>
                  <span className="arch-link-label">{t[LINKS[i]]}</span>
                  <span className="arch-link-line" />
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
