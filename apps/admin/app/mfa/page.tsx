"use client";

import Image from "next/image";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  KeyRound,
  LoaderCircle,
  ShieldCheck,
  Smartphone,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type Mode = "loading" | "challenge" | "enroll";

export default function MfaPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("loading");
  const [factorId, setFactorId] = useState("");
  const [qrCode, setQrCode] = useState("");
  const [secret, setSecret] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function prepare() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.replace("/login");
        return;
      }

      const { data: aal } =
        await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aal?.currentLevel === "aal2") {
        router.replace("/dashboard");
        return;
      }

      const { data, error: factorsError } =
        await supabase.auth.mfa.listFactors();

      if (!active) return;
      if (factorsError) {
        setError("Não foi possível carregar os fatores MFA.");
        return;
      }

      const verified = data.totp.find(
        (factor) => factor.status === "verified",
      );

      if (verified) {
        setFactorId(verified.id);
        setMode("challenge");
        return;
      }

      const { data: enrollment, error: enrollError } =
        await supabase.auth.mfa.enroll({
          factorType: "totp",
          friendlyName: "PiXBrasil Control Plane",
        });

      if (!active) return;
      if (enrollError) {
        setError("Não foi possível iniciar o registro TOTP.");
        return;
      }

      setFactorId(enrollment.id);
      setQrCode(enrollment.totp.qr_code);
      setSecret(enrollment.totp.secret);
      setMode("enroll");
    }

    void prepare();
    return () => {
      active = false;
    };
  }, [router]);

  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!factorId || code.length < 6) return;

    setBusy(true);
    setError("");

    const { error: verifyError } =
      await supabase.auth.mfa.challengeAndVerify({
        factorId,
        code: code.trim(),
      });

    if (verifyError) {
      setError("Código inválido ou expirado. Confirme o autenticador.");
      setBusy(false);
      return;
    }

    const { data, error: aalError } =
      await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

    if (aalError || data.currentLevel !== "aal2") {
      setError("O segundo fator foi verificado, mas a sessão não chegou a AAL2.");
      setBusy(false);
      return;
    }

    router.replace("/dashboard");
  }

  return (
    <main className="mfa-shell">
      <section className="mfa-card">
        <div className="mfa-icon"><ShieldCheck size={24} /></div>
        <span className="eyebrow">STEP-UP AUTHENTICATION</span>
        <h1>Verificação AAL2</h1>
        <p className="subtle">
          {mode === "enroll"
            ? "Registe o PiXBrasil no seu autenticador e confirme o código."
            : "Introduza o código atual do seu autenticador."}
        </p>

        {mode === "loading" ? (
          <div className="mfa-loading">
            <LoaderCircle className="spin" size={22} />
            A verificar fatores…
          </div>
        ) : null}

        {mode === "enroll" && qrCode ? (
          <div className="enrollment">
            <div className="qr-wrap">
              <Image
                src={qrCode}
                alt="QR Code TOTP PiXBrasil"
                width={208}
                height={208}
                unoptimized
              />
            </div>
            <div className="secret-box">
              <span><KeyRound size={14} /> Chave manual</span>
              <code>{secret}</code>
            </div>
          </div>
        ) : null}

        {mode !== "loading" ? (
          <form onSubmit={verify} className="mfa-form">
            <label>
              Código de 6 dígitos
              <div className="code-input-wrap">
                <Smartphone size={18} />
                <input
                  autoComplete="one-time-code"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={8}
                  value={code}
                  onChange={(event) =>
                    setCode(event.target.value.replace(/\D/g, ""))
                  }
                  placeholder="000000"
                  autoFocus
                />
              </div>
            </label>
            {error ? <div className="form-error">{error}</div> : null}
            <button className="primary-button" type="submit" disabled={busy}>
              {busy ? "A verificar…" : "Verificar e entrar"}
              {!busy ? <ArrowRight size={17} /> : null}
            </button>
          </form>
        ) : null}

        {mode === "loading" && error ? (
          <div className="form-error">{error}</div>
        ) : null}
      </section>
    </main>
  );
}
