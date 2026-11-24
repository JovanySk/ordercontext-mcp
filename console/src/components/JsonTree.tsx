import { useState } from "react";
import { CaretRight } from "@phosphor-icons/react";
import { useI18n } from "../lib/i18n";

type Json = null | boolean | number | string | Json[] | { [k: string]: Json };

const isContainer = (v: Json): v is Json[] | { [k: string]: Json } => typeof v === "object" && v !== null;

function Primitive({ value }: { value: Json }) {
  if (value === null) return <span className="j-lit">null</span>;
  if (typeof value === "string") return <span className="j-str">"{value}"</span>;
  if (typeof value === "number") return <span className="j-num">{value}</span>;
  return <span className="j-lit">{String(value)}</span>;
}

/** One-line preview of a collapsed object: its first few primitive fields. */
function preview(v: Json[] | { [k: string]: Json }) {
  if (Array.isArray(v)) return `[${v.length}]`;
  const parts = Object.entries(v)
    .filter(([, x]) => !isContainer(x))
    .slice(0, 3)
    .map(([k, x]) => `${k}: ${typeof x === "string" ? `"${x}"` : String(x)}`);
  return `{ ${parts.join(", ")}${Object.keys(v).length > parts.length ? ", …" : ""} }`;
}

interface NodeProps {
  name?: string | number;
  value: Json;
  depth: number;
  path: string;
  isOpen: (path: string, depth: number) => boolean;
  toggle: (path: string, open: boolean) => void;
}

function JsonNode({ name, value, depth, path, isOpen, toggle }: NodeProps) {
  const { t } = useI18n();
  const label =
    name === undefined ? null : typeof name === "number" ? <span className="j-index">{name}</span> : <span className="j-key">{name}</span>;

  if (!isContainer(value)) {
    return (
      <li className="jt-row jt-leaf">
        {label}
        {label && <span className="j-punct">: </span>}
        <Primitive value={value} />
      </li>
    );
  }

  const open = isOpen(path, depth);
  const entries: [string | number, Json][] = Array.isArray(value) ? value.map((v, i) => [i, v]) : Object.entries(value);
  const size = entries.length;
  const sizeLabel = Array.isArray(value) ? `${size} ${t.items}` : `${size} ${t.keys}`;

  return (
    <li className="jt-row">
      <button type="button" className="jt-toggle" aria-expanded={open} onClick={() => toggle(path, !open)}>
        <CaretRight size={11} weight="bold" className={`jt-caret${open ? " is-open" : ""}`} aria-hidden />
        {label}
        {label && <span className="j-punct">: </span>}
        {open ? (
          <span className="jt-meta">{Array.isArray(value) ? "[" : "{"} <span className="jt-size">{sizeLabel}</span></span>
        ) : (
          <span className="jt-preview">{preview(value)}</span>
        )}
      </button>
      {open && (
        <>
          <ul className="jt-children">
            {entries.map(([k, v]) => (
              <JsonNode key={k} name={k} value={v} depth={depth + 1} path={`${path}/${k}`} isOpen={isOpen} toggle={toggle} />
            ))}
          </ul>
          <span className="jt-close j-punct">{Array.isArray(value) ? "]" : "}"}</span>
        </>
      )}
    </li>
  );
}

/**
 * Collapsible JSON tree. By default the root and the first entry are open so the shape
 * of the data is visible at a glance; everything else shows a one-line preview.
 */
export type TreeMode = "default" | "all" | "none";

export function JsonTree({ data, mode }: { data: Json; mode: TreeMode }) {
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});

  const isOpen = (path: string, depth: number) => {
    if (path in overrides) return overrides[path];
    if (mode === "all") return true;
    if (mode === "none") return depth === 0;
    return depth === 0 || (depth === 1 && /^\$\/0$/.test(path)) || (depth === 1 && !Array.isArray(data));
  };
  const toggle = (path: string, open: boolean) => setOverrides((o) => ({ ...o, [path]: open }));

  return (
    <div className="jt">
      <ul className="jt-root">
        <JsonNode value={data} depth={0} path="$" isOpen={isOpen} toggle={toggle} />
      </ul>
    </div>
  );
}

export type { Json };
