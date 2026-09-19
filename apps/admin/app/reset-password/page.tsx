"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, ShieldCheck } from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function checkRecoverySession() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!active) return;
      setReady(Boolean(session));
    }

    void checkRecoverySession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === "PASSWORD_RECOVERY" || session) setReady(true);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (password.length < 12) {
      setError("Use uma senha com pelo menos 12 caracteres.");
      return;
    }

    if (password !== confirmPassword) {
      setError("As duas senhas não coincidem.");
      return;
    }

    setBusy(true);

    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setError("Não foi possível atualizar a senha. Solicite um novo link.");
      setBusy(false);
      return;
    }

    await supabase.auth.signOut({ scope: "global" });
    router.replace("/login");
  }

  return (
    <main className="mfa-shell">
      <section className="mfa-card">
        <div className="mfa-icon"><KeyRound size={24} /></div>
        <span className="eyebrow">SECURE CREDENTIAL RESET</span>
        <h1>Nova senha</h1>
        <p className="subtle">
          Defina uma nova senha para o SUPER_ADMIN. Depois entraremos novamente
          e registraremos o TOTP para elevar a sessão a AAL2.
        </p>

        {!ready ? (
          <div className="form-error">
            O link de recuperação ainda não foi validado. Abra esta página pelo
            link enviado pelo Supabase.
          </div>
        ) : (
          <form onSubmit={submit} className="mfa-form">
            <label>
              Nova senha
              <input
                autoComplete="new-password"
                type="password"
                required
                minLength={12}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Mínimo 12 caracteres"
              />
            </label>
            <label>
              Confirmar nova senha
              <input
                autoComplete="new-password"
                type="password"
                required
                minLength={12}
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="Repita a nova senha"
              />
            </label>

            {error ? <div className="form-error">{error}</div> : null}

            <button className="primary-button" disabled={busy} type="submit">
              {busy ? "A atualizar…" : "Guardar nova senha"}
            </button>
          </form>
        )}

        <div className="login-footnote">
          <ShieldCheck size={14} />
          A senha não é guardada no PiXBrasil; é processada pelo Supabase Auth.
        </div>
      </section>
    </main>
  );
}
