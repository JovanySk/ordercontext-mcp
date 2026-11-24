import { ArrowRight, Package, Receipt, Truck, UserCircle, type Icon } from "@phosphor-icons/react";
import { useI18n, type Dict } from "../lib/i18n";

export interface Preset {
  id: string;
  icon: Icon;
  title: keyof Dict;
  desc: keyof Dict;
  tool: string;
  args: Record<string, string>;
}

export const PRESETS: Preset[] = [
  { id: "brief", icon: Receipt, title: "preset1", desc: "preset1d", tool: "generate_order_context", args: { orderId: "10" } },
  { id: "pending", icon: Truck, title: "preset2", desc: "preset2d", tool: "list_pending_orders", args: { limit: "5" } },
  { id: "customer", icon: UserCircle, title: "preset3", desc: "preset3d", tool: "get_customer_summary", args: { customerId: "1" } },
  { id: "stock", icon: Package, title: "preset4", desc: "preset4d", tool: "get_low_stock_products", args: {} },
];

const argLine = (p: Preset) => {
  const entries = Object.entries(p.args);
  return entries.length ? entries.map(([k, v]) => `${k}: ${v}`).join(", ") : "no args";
};

export function Presets({ onRun, disabled }: { onRun: (p: Preset) => void; disabled: boolean }) {
  const { t } = useI18n();
  return (
    <section className="presets" aria-labelledby="try-title">
      <header className="presets-head">
        <h2 id="try-title" className="panel-title">{t.try}</h2>
        <p className="panel-hint">{t.tryHint}</p>
      </header>
      <div className="preset-grid">
        {PRESETS.map((p) => {
          const Ico = p.icon;
          return (
            <button key={p.id} type="button" className="preset" onClick={() => onRun(p)} disabled={disabled} title={t[p.desc]}>
              <span className="preset-icon">
                <Ico size={18} weight="duotone" aria-hidden />
              </span>
              <span className="preset-body">
                <span className="preset-title">{t[p.title]}</span>
                <code className="preset-call">
                  {p.tool}({argLine(p)})
                </code>
              </span>
              <ArrowRight size={14} className="preset-go" aria-hidden />
            </button>
          );
        })}
      </div>
    </section>
  );
}
