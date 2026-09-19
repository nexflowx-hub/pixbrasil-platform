"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { ArrowLeft, MailCheck, ShieldCheck } from "lucide-react";
import { supabase } from "@/lib/supabase";

const DEFAULT_ADMIN_EMAIL = "mgj.expert@gmail.com";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState(DEFAULT_ADMIN_EMAIL);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");

    const redirectTo =
      typeof window !== "undefined"
        ? `${window.location.origin}/reset-password`
        : "https://admin.pixbrasil.org/reset-password";

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email.trim(),
      { redirectTo },
    );

    if (resetError) {
      setError("Não foi possível enviar o e-mail de recuperação.");
      setBusy(false);
      return;
    }

    setSent(true);
    setBusy(false);
  }

  return (
    <main className="mfa-shell">
      <section className="mfa-card">
        <div className="mfa-icon"><MailCheck size={24} /></div>
        <span className="eyebrow">ACCOUNT RECOVERY</span>
        <h1>Redefinir senha</h1>
        <p className="subtle">
          Enviaremos um link de recuperação para o e-mail autorizado do
          SUPER_ADMIN.
        </p>

        {sent ? (
          <div className="recovery-success">
            <ShieldCheck size={18} />
            <div>
              <strong>E-mail enviado</strong>
              <span>
                Abra a mensagem recebida em {email} e siga o link para definir
                uma nova senha.
              </span>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="mfa-form">
            <label>
              E-mail do SUPER_ADMIN
              <input
                autoComplete="email"
                inputMode="email"
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>

            {error ? <div className="form-error">{error}</div> : null}

            <button className="primary-button" disabled={busy} type="submit">
              {busy ? "A enviar…" : "Enviar link de recuperação"}
            </button>
          </form>
        )}

        <Link href="/login" className="recovery-link">
          <ArrowLeft size={14} />
          Voltar ao login
        </Link>
      </section>
    </main>
  );
}
