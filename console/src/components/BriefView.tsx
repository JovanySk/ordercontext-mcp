import type { ReactNode } from "react";
import { CheckCircle, Warning } from "@phosphor-icons/react";
import { useI18n } from "../lib/i18n";

/**
 * Renders the Markdown brief from generate_order_context. The brief uses a tiny, known
 * subset of Markdown (#, ##, "- " bullets, "Key: value" lines), so a small parser is
 * enough and keeps the output faithful to the text the assistant actually receives.
 */

type Block =
  | { kind: "h1"; text: string }
  | { kind: "section"; title: string; lines: string[]; total?: string }
  | { kind: "kv"; key: string; value: string }
  | { kind: "p"; text: string };

export function parseBrief(md: string): Block[] {
  const blocks: Block[] = [];
  let section: Extract<Block, { kind: "section" }> | null = null;
  for (const raw of md.split("\n")) {
    const line = raw.trimEnd();
    if (line.startsWith("# ")) {
      section = null;
      blocks.push({ kind: "h1", text: line.slice(2) });
    } else if (line.startsWith("## ")) {
      section = { kind: "section", title: line.slice(3), lines: [] };
      blocks.push(section);
    } else if (line.startsWith("- ") && section) {
      section.lines.push(line.slice(2));
    } else if (line === "") {
      continue;
    } else {
      const kv = /^([A-Z][A-Za-z ]{1,20}):\s+(.+)$/.exec(line);
      const block: Block = kv ? { kind: "kv", key: kv[1], value: kv[2] } : { kind: "p", text: line };
      // "Total:" right after the items list is shown as that list's footer.
      if (section && kv?.[1] === "Total") section.total = kv[2];
      else blocks.push(block);
      section = null;
    }
  }
  return blocks;
}

const ITEM = /^(\d+) × (.+) \[([^\]]+)\] @ (.+) = (.+)$/;
const WARNING = /^(.+) \[([^\]]+)\]: requested (\d+), available (-?\d+)$/;

function ItemRow({ line }: { line: string }) {
  const m = ITEM.exec(line);
  if (!m) return <li className="brief-li">{line}</li>;
  const [, qty, name, sku, unit, subtotal] = m;
  return (
    <li className="brief-item">
      <span className="brief-qty">{qty}×</span>
      <span className="brief-item-name">
        {name} <code className="sku">{sku}</code>
      </span>
      <span className="brief-unit">@ {unit}</span>
      <span className="brief-sub">{subtotal}</span>
    </li>
  );
}

function StockWarnings({ lines }: { lines: string[] }) {
  const { t } = useI18n();
  const real = lines.filter((l) => l !== "None");
  if (real.length === 0) {
    return (
      <div className="stock-ok">
        <CheckCircle size={16} weight="fill" aria-hidden /> {t.briefNoWarnings}
      </div>
    );
  }
  return (
    <div className="stock-warn" role="note">
      <div className="stock-warn-head">
        <Warning size={16} weight="fill" aria-hidden />
        <span>{t.briefStock}</span>
        <span className="stock-warn-count">{real.length}</span>
      </div>
      <ul className="stock-warn-list">
        {real.map((line) => {
          const m = WARNING.exec(line);
          if (!m) return <li key={line}>{line}</li>;
          const [, name, sku, req, avail] = m;
          const requested = Number(req);
          const available = Math.max(0, Number(avail));
          const pct = Math.min(100, (available / requested) * 100);
          return (
            <li key={line} className="stock-row">
              <div className="stock-row-top">
                <span>
                  {name} <code className="sku">{sku}</code>
                </span>
                <span className="stock-short">
                  {t.briefShort} {requested - available}
                </span>
              </div>
              <div className="stock-bar" aria-hidden>
                <span style={{ width: `${pct}%` }} />
              </div>
              <div className="stock-row-nums">
                <span>
                  {available} {t.briefAvailable}
                </span>
                <span>
                  {requested} {t.briefRequested}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function BriefView({ text }: { text: string }) {
  const { t } = useI18n();
  const blocks = parseBrief(text);
  const out: ReactNode[] = [];
  let kvRun: Extract<Block, { kind: "kv" }>[] = [];
  const flushKv = () => {
    if (!kvRun.length) return;
    out.push(
      <dl key={`kv-${out.length}`} className="brief-kv">
        {kvRun.map((b) => (
          <div key={b.key} className={`brief-kv-row${b.key === "Total" ? " is-total" : ""}`}>
            <dt>{b.key}</dt>
            <dd>{b.value}</dd>
          </div>
        ))}
      </dl>,
    );
    kvRun = [];
  };

  blocks.forEach((b, i) => {
    if (b.kind === "kv") {
      kvRun.push(b);
      return;
    }
    flushKv();
    if (b.kind === "h1") {
      const m = /^(.*?)\s*\(([A-Z_]+)\)$/.exec(b.text);
      out.push(
        <h3 key={i} className="brief-h1">
          {m ? m[1] : b.text}
          {m && <span className={`status-pill status-${m[2].toLowerCase()}`}>{m[2]}</span>}
        </h3>,
      );
    } else if (b.kind === "section") {
      const isStock = /stock/i.test(b.title);
      const isItems = /items/i.test(b.title);
      out.push(
        <section key={i} className="brief-section">
          {!isStock && <h4 className="brief-h2">{isItems ? t.briefItems : b.title}</h4>}
          {isStock ? (
            <StockWarnings lines={b.lines} />
          ) : (
            <ul className={isItems ? "brief-items" : "brief-list"}>
              {b.lines.map((l) => (isItems ? <ItemRow key={l} line={l} /> : <li key={l} className="brief-li">{l}</li>))}
              {b.total && (
                <li className="brief-total">
                  <span>Total</span>
                  <span>{b.total}</span>
                </li>
              )}
            </ul>
          )}
        </section>,
      );
    } else {
      out.push(
        <p key={i} className="brief-p">
          {b.text}
        </p>,
      );
    }
  });
  flushKv();

  return <article className="brief">{out}</article>;
}
