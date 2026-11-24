import { useState, type ReactNode } from "react";
import { Check, CircleNotch, Copy, Play, Warning } from "@phosphor-icons/react";
import { useI18n, type Dict } from "../lib/i18n";
import { fieldIssue, type FieldSpec, type FormValues } from "../lib/schema";
import type { Tool } from "../lib/types";

const ISSUE_TEXT: Record<NonNullable<ReturnType<typeof fieldIssue>>, keyof Dict> = {
  required: "issueRequired",
  nan: "issueNan",
  integer: "issueInteger",
  min: "issueMin",
  max: "issueMax",
};

function rangeText(f: FieldSpec) {
  if (f.min !== undefined && f.max !== undefined) return `${f.min}..${f.max}`;
  if (f.min !== undefined) return `>= ${f.min}`;
  if (f.max !== undefined) return `<= ${f.max}`;
  return null;
}

export function ToolPanel({
  tool,
  fields,
  values,
  onChange,
  onRun,
  running,
}: {
  tool: Tool;
  fields: FieldSpec[];
  values: FormValues;
  onChange: (name: string, value: string) => void;
  onRun: () => void;
  running: boolean;
}) {
  const { t } = useI18n();
  const a = tool.annotations ?? {};
  const issues = fields.map((f) => fieldIssue(f, values[f.name] ?? ""));
  const anyIssue = issues.some(Boolean);

  return (
    <section className="panel tool-panel" aria-labelledby="tool-title">
      <header className="tool-head">
        <div className="tool-head-names">
          <code id="tool-title" className="tool-head-name">{tool.name}</code>
          {tool.title && <span className="tool-head-title">{tool.title}</span>}
        </div>
        {tool.description && <p className="tool-head-desc">{tool.description}</p>}
        <div className="badges">
          {a.readOnlyHint && <span className="badge badge--accent">{t.readOnly}</span>}
          {a.destructiveHint === false && <span className="badge">{t.nonDestructive}</span>}
          {a.idempotentHint && <span className="badge">{t.idempotent}</span>}
          {a.openWorldHint === false && <span className="badge">{t.closedWorld}</span>}
        </div>
      </header>

      <form
        className="args"
        onSubmit={(e) => {
          e.preventDefault();
          onRun();
        }}
      >
        {fields.length === 0 ? (
          <p className="args-empty">{t.noArguments}</p>
        ) : (
          fields.map((f, i) => {
            const id = `arg-${f.name}`;
            const range = rangeText(f);
            const issue = issues[i];
            return (
              <div key={f.name} className={`field${issue ? " has-issue" : ""}`}>
                <label htmlFor={id} className="field-label">
                  <code>{f.name}</code>
                  <span className="field-type">{f.kind}</span>
                  <span className={`field-req${f.required ? " is-required" : ""}`}>{f.required ? t.required : t.optional}</span>
                </label>
                <FieldInput id={id} field={f} value={values[f.name] ?? ""} onChange={(v) => onChange(f.name, v)} placeholder={f.required ? "" : t.optionalHint} />
                <div className="field-foot">
                  {f.description && <span>{f.description}</span>}
                  {range && (
                    <span className="field-range">
                      {t.range} <code>{range}</code>
                    </span>
                  )}
                </div>
                {issue && (
                  <p className="field-issue" role="status">
                    <Warning size={13} weight="bold" aria-hidden /> {t[ISSUE_TEXT[issue]]}
                  </p>
                )}
              </div>
            );
          })
        )}
        {anyIssue && <p className="args-note">{t.issueNote}</p>}
        <div className="run-row">
          <button type="submit" className="btn-run" disabled={running}>
            {running ? <CircleNotch size={16} weight="bold" className="spin" aria-hidden /> : <Play size={16} weight="fill" aria-hidden />}
            {running ? t.running : t.run}
          </button>
          <kbd className="kbd">{t.shortcut}</kbd>
        </div>
      </form>
    </section>
  );
}

function FieldInput({ id, field, value, onChange, placeholder }: { id: string; field: FieldSpec; value: string; onChange: (v: string) => void; placeholder: string }) {
  if (field.kind === "boolean" || field.kind === "enum") {
    const options = field.kind === "boolean" ? ["true", "false"] : (field.options ?? []).map(String);
    return (
      <select id={id} className="input" value={value} onChange={(e) => onChange(e.target.value)}>
        {!field.required && <option value="">-</option>}
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    );
  }
  const numeric = field.kind === "integer" || field.kind === "number";
  return (
    <input
      id={id}
      className="input"
      type={numeric ? "number" : "text"}
      inputMode={field.kind === "integer" ? "numeric" : undefined}
      step={field.kind === "integer" ? 1 : "any"}
      min={field.min}
      max={field.max}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

/** Pretty JSON that keeps short objects and arrays on one line, like a hand-written request. */
export function compactJson(value: unknown, indent = 0, inline = 44): string {
  if (typeof value !== "object" || value === null) return JSON.stringify(value);
  const entries: [string | null, unknown][] = Array.isArray(value) ? value.map((v) => [null, v]) : Object.entries(value);
  const [open, close] = Array.isArray(value) ? ["[", "]"] : ["{", "}"];
  const item = (k: string | null, v: string) => (k === null ? v : `${JSON.stringify(k)}: ${v}`);
  const flat = `${open}${entries.map(([k, v]) => item(k, compactJson(v, 0, Infinity))).join(", ")}${close}`;
  if (flat.length <= inline || entries.length === 0) return flat;
  const pad = "  ".repeat(indent + 1);
  const lines = entries.map(([k, v]) => pad + item(k, compactJson(v, indent + 1, inline)));
  return `${open}\n${lines.join(",\n")}\n${"  ".repeat(indent)}${close}`;
}

/** Minimal JSON syntax colouring for the request preview. */
export function JsonCode({ value }: { value: unknown }) {
  const text = compactJson(value);
  const parts: ReactNode[] = [];
  const re = /("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false|null)\b|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    if (m[1]) {
      parts.push(
        <span key={k++} className={m[2] ? "j-key" : "j-str"}>
          {m[1]}
        </span>,
      );
      if (m[2]) parts.push(m[2]);
    } else if (m[3]) {
      parts.push(<span key={k++} className="j-lit">{m[3]}</span>);
    } else {
      parts.push(<span key={k++} className="j-num">{m[4]}</span>);
    }
    last = re.lastIndex;
  }
  parts.push(text.slice(last));
  return <code>{parts}</code>;
}

export function RequestPreview({ request }: { request: unknown }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(request, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      /* clipboard can be blocked; nothing to do */
    }
  };
  return (
    <section className="panel request" aria-labelledby="req-title">
      <header className="panel-head panel-head--row">
        <h2 id="req-title" className="panel-title">
          {t.request} <code className="method">tools/call</code>
          <span className="panel-title-hint">{t.requestHint}</span>
        </h2>
        <button type="button" className="icon-btn" onClick={copy} aria-label={copied ? t.copied : t.copy}>
          {copied ? <Check size={14} weight="bold" aria-hidden /> : <Copy size={14} aria-hidden />}
          <span>{copied ? t.copied : t.copy}</span>
        </button>
      </header>
      <pre className="code-block">
        <JsonCode value={request} />
      </pre>
    </section>
  );
}
