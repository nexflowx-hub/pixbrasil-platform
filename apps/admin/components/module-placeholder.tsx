import {
  ArrowUpRight,
  CircleDashed,
  Construction,
  ShieldCheck,
} from "lucide-react";

export function ModulePlaceholder({
  title,
  eyebrow,
  description,
}: {
  title: string;
  eyebrow: string;
  description: string;
}) {
  return (
    <div className="page-stack">
      <section className="page-heading">
        <div>
          <span className="eyebrow">{eyebrow}</span>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        <span className="status-chip gold"><CircleDashed size={12} /> FOUNDATION</span>
      </section>

      <section className="panel module-foundation">
        <div className="foundation-icon"><Construction size={24} /></div>
        <div>
          <h2>Módulo preparado para integração</h2>
          <p>
            A superfície visual já está dentro do Control Plane. Operações de
            escrita serão introduzidas somente quando o respetivo backend,
            approvals e auditoria estiverem ativos.
          </p>
        </div>
        <div className="foundation-guardrails">
          <span><ShieldCheck size={14} /> RBAC obrigatório</span>
          <span><ShieldCheck size={14} /> Auditoria</span>
          <span><ShieldCheck size={14} /> Maker / Checker quando crítico</span>
        </div>
        <button className="ghost-button" disabled>
          Backend write path pending
          <ArrowUpRight size={15} />
        </button>
      </section>
    </div>
  );
}
