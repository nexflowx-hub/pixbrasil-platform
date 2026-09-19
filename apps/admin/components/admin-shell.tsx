"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Activity,
  Bell,
  Blocks,
  BookOpenCheck,
  Building2,
  ChevronRight,
  CircleDollarSign,
  Database,
  FileCheck2,
  Gauge,
  GitBranch,
  KeyRound,
  Landmark,
  LogOut,
  Menu,
  Radar,
  ReceiptText,
  Settings2,
  ShieldCheck,
  Store,
  Users,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { adminFetch } from "@/lib/api";
import { supabase } from "@/lib/supabase";

const navigation = [
  { href: "/dashboard", label: "Overview", icon: Gauge },
  { href: "/onboarding", label: "Onboarding", icon: BookOpenCheck },
  { href: "/merchants", label: "Merchants", icon: Building2 },
  { href: "/stores", label: "Stores", icon: Store },
  { href: "/providers", label: "Provider Library", icon: Blocks },
  { href: "/gateway-vault", label: "Gateway Vault", icon: KeyRound },
  { href: "/routing", label: "Routing Studio", icon: GitBranch },
  { href: "/transactions", label: "Transactions", icon: ReceiptText },
  { href: "/ledger", label: "Ledger", icon: Database },
  { href: "/settlements", label: "Settlements", icon: Landmark },
  { href: "/payouts", label: "Payouts", icon: CircleDollarSign },
  { href: "/approvals", label: "Approvals", icon: FileCheck2 },
  { href: "/users", label: "Users & RBAC", icon: Users },
  { href: "/audit", label: "Audit", icon: Radar },
  { href: "/system", label: "System", icon: Settings2 },
];

interface AdminSession {
  success: true;
  data: {
    email?: string;
    displayName?: string;
    aal: "aal1" | "aal2";
    roles: string[];
    permissions: string[];
  };
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [session, setSession] = useState<AdminSession["data"] | null>(null);

  useEffect(() => {
    let active = true;
    adminFetch<AdminSession>("/api/v1/admin/session")
      .then((payload) => {
        if (active) setSession(payload.data);
      })
      .catch(() => {
        if (active) setSession(null);
      });
    return () => {
      active = false;
    };
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  return (
    <div className="control-plane">
      <aside className={`sidebar ${mobileOpen ? "sidebar-open" : ""}`}>
        <div className="sidebar-head">
          <Link href="/dashboard" className="brand-lockup compact">
            <div className="brand-glyph">P</div>
            <div>
              <strong>PiXBrasil</strong>
              <span>Control Plane</span>
            </div>
          </Link>
          <button
            className="icon-button mobile-only"
            aria-label="Fechar menu"
            onClick={() => setMobileOpen(false)}
          >
            <X size={18} />
          </button>
        </div>

        <div className="environment-badge">
          <i />
          <div>
            <span>ENVIRONMENT</span>
            <strong>PRODUCTION</strong>
          </div>
          <ShieldCheck size={15} />
        </div>

        <nav className="sidebar-nav">
          {navigation.map(({ href, label, icon: Icon }) => {
            const active =
              pathname === href ||
              (href !== "/dashboard" && pathname.startsWith(`${href}/`));
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setMobileOpen(false)}
                className={active ? "nav-item active" : "nav-item"}
              >
                <Icon size={17} />
                <span>{label}</span>
                {active ? <ChevronRight size={14} /> : null}
              </Link>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <div className="operator">
            <div className="operator-avatar">
              {(session?.email?.[0] || "A").toUpperCase()}
            </div>
            <div className="operator-copy">
              <strong>{session?.displayName || "Super Admin"}</strong>
              <span>{session?.email || "Sessão protegida"}</span>
            </div>
            <button
              className="icon-button"
              onClick={signOut}
              aria-label="Terminar sessão"
              title="Terminar sessão"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {mobileOpen ? (
        <button
          className="sidebar-scrim mobile-only"
          onClick={() => setMobileOpen(false)}
          aria-label="Fechar menu"
        />
      ) : null}

      <main className="main-stage">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="icon-button mobile-only"
              onClick={() => setMobileOpen(true)}
              aria-label="Abrir menu"
            >
              <Menu size={19} />
            </button>
            <div className="breadcrumb">
              <span>PiXBrasil</span>
              <ChevronRight size={13} />
              <strong>
                {navigation.find((item) => pathname.startsWith(item.href))
                  ?.label || "Control Plane"}
              </strong>
            </div>
          </div>

          <div className="topbar-right">
            <span className="aal-badge">
              <ShieldCheck size={14} />
              AAL2
            </span>
            <span className="runtime-badge">
              <Activity size={14} />
              API v0.3.0
            </span>
            <button className="icon-button" aria-label="Notificações">
              <Bell size={17} />
              <i className="notification-dot" />
            </button>
          </div>
        </header>

        <div className="content-stage">{children}</div>
      </main>
    </div>
  );
}
