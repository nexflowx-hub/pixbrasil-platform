"use client";

import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRight,
  Fingerprint,
  LockKeyhole,
  ShieldCheck,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError("Credenciais inválidas ou acesso não autorizado.");
      setBusy(false);
      return;
    }

    const { data, error: aalError } =
      await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

    if (aalError) {
      setError("Não foi possível verificar o nível de autenticação.");
      setBusy(false);
      return;
    }

    if (data.currentLevel !== "aal2") {
      router.replace("/mfa");
      return;
    }

    router.replace(searchParams.get("next") || "/dashboard");
  }

  return (
    <main className="login-shell">
      <section className="login-brand">
        <div className="brand-orbit brand-orbit-a" />
        <div className="brand-orbit brand-orbit-b" />
        <div className="brand-grid" />
        <div className="brand-copy">
          <div className="brand-lockup">
            <div className="brand-glyph">P</div>
            <div>
              <strong>PiXBrasil</strong>
              <span>Financial Control Plane</span>
            </div>
          </div>
          <div className="login-statement">
            <span className="eyebrow">OPERATIONS / PRODUCTION</span>
            <h1>Controle financeiro com segurança de infraestrutura.</h1>
            <p>
              Acesso restrito. Sessões administrativas exigem autenticação
              multifator e autorização RBAC no Atlas Financial Core.
            </p>
          </div>
          <div className="security-strip">
            <span><ShieldCheck size={15} /> AAL2 obrigatório</span>
            <span><Fingerprint size={15} /> TOTP</span>
            <span><LockKeyhole size={15} /> RBAC privado</span>
          </div>
        </div>
      </section>

      <section className="login-panel">
        <div className="login-card">
          <div className="status-pill"><i /> CONTROL PLANE ONLINE</div>
          <h2>Acesso administrativo</h2>
          <p className="subtle">
            Entre com a conta autorizada. O segundo fator será solicitado na
            etapa seguinte.
          </p>

          <form onSubmit={submit} className="login-form">
            <label>
              E-mail
              <input
                autoComplete="email"
                inputMode="email"
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="admin@pixbrasil.org"
              />
            </label>
            <label>
              Palavra-passe
              <input
                autoComplete="current-password"
                type="password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••••••"
              />
            </label>

            {error ? <div className="form-error">{error}</div> : null}

            <button className="primary-button" disabled={busy} type="submit">
              {busy ? "A validar…" : "Continuar"}
              {!busy ? <ArrowRight size={17} /> : null}
            </button>
          </form>

          <div className="login-footnote">
            <ShieldCheck size={14} />
            O backend não confia em metadata editável do utilizador. Permissões
            são resolvidas no Control Plane privado.
          </div>
        </div>
      </section>
    </main>
  );
}
