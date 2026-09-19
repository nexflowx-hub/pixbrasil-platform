"use client";

import { ArrowRight, KeyRound, LockKeyhole, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { BrandLogo } from "@/components/brand/logo";

export function ClientLogin() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        success?: boolean;
        message?: string;
      };

      if (!response.ok || !payload.success) {
        throw new Error(payload.message || "Não foi possível entrar.");
      }

      router.replace("/app");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha de autenticação.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#020B0D] text-[#F4F1E8]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(32,242,154,.13),transparent_30%),radial-gradient(circle_at_82%_72%,rgba(40,235,208,.08),transparent_34%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-[.07] [background-image:linear-gradient(rgba(255,255,255,.12)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.12)_1px,transparent_1px)] [background-size:52px_52px]" />

      <div className="relative mx-auto grid min-h-screen w-full max-w-[1440px] lg:grid-cols-[1.05fr_.95fr]">
        <section className="hidden border-r border-white/8 px-10 py-12 lg:flex lg:flex-col lg:justify-between xl:px-16">
          <BrandLogo tagline className="text-[22px]" />

          <div className="max-w-xl pb-10">
            <span className="inline-flex items-center gap-2 rounded-full border border-[#20F29A]/20 bg-[#20F29A]/6 px-3 py-1.5 text-[11px] font-semibold tracking-[.13em] text-[#79D9BA]">
              <ShieldCheck className="h-3.5 w-3.5" />
              CLIENT PORTAL · MVP CONTROLADO
            </span>
            <h1 className="mt-7 text-5xl font-semibold leading-[1.03] tracking-[-.055em] xl:text-6xl">
              Uma visão clara do seu dinheiro, sem esconder o estado operacional.
            </h1>
            <p className="mt-6 max-w-lg text-[15px] leading-7 text-[#8FA7A1]">
              Acesse contas Personal e Business, wallets, Stores e atividade a partir do mesmo portal. Operações financeiras permanecem bloqueadas até a ativação segura de cada rail.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3 pb-3">
            {[
              ["Sessão", "HttpOnly"],
              ["Core", "Read-only"],
              ["Dados", "Minimizados"],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-white/8 bg-white/[.025] p-4">
                <span className="block text-[9px] uppercase tracking-[.16em] text-[#657D77]">{label}</span>
                <strong className="mt-2 block text-[13px] text-[#B8CDC7]">{value}</strong>
              </div>
            ))}
          </div>
        </section>

        <section className="flex items-center justify-center px-5 py-10 sm:px-8">
          <div className="w-full max-w-[450px]">
            <div className="mb-8 lg:hidden">
              <BrandLogo tagline className="text-[20px]" />
            </div>

            <div className="rounded-[28px] border border-white/10 bg-[#071315]/92 p-6 shadow-[0_30px_100px_rgba(0,0,0,.32)] backdrop-blur-xl sm:p-8">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#20F29A]/20 bg-[#20F29A]/7 text-[#20F29A]">
                <LockKeyhole className="h-5 w-5" />
              </div>
              <h2 className="mt-6 text-3xl font-semibold tracking-[-.045em]">Entrar no PiXBrasil</h2>
              <p className="mt-2 text-[13px] leading-6 text-[#7F9791]">
                Use a identidade autorizada para acessar o Client Portal.
              </p>

              <form onSubmit={submit} className="mt-7 space-y-4">
                <label className="block">
                  <span className="mb-2 block text-[10px] font-semibold uppercase tracking-[.12em] text-[#829A94]">Email</span>
                  <input
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="h-12 w-full rounded-xl border border-white/10 bg-[#020B0D] px-4 text-[13px] outline-none transition focus:border-[#20F29A]/45 focus:ring-4 focus:ring-[#20F29A]/5"
                    placeholder="voce@empresa.com"
                    required
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-[10px] font-semibold uppercase tracking-[.12em] text-[#829A94]">Senha</span>
                  <input
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="h-12 w-full rounded-xl border border-white/10 bg-[#020B0D] px-4 text-[13px] outline-none transition focus:border-[#20F29A]/45 focus:ring-4 focus:ring-[#20F29A]/5"
                    required
                  />
                </label>

                {error ? (
                  <div className="rounded-xl border border-red-400/20 bg-red-400/5 px-4 py-3 text-[11px] leading-5 text-red-200">
                    {error}
                  </div>
                ) : null}

                <button
                  type="submit"
                  disabled={busy}
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#20F29A] text-[12px] font-extrabold text-[#02100C] transition hover:bg-[#4BF6AF] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {busy ? <KeyRound className="h-4 w-4 animate-pulse" /> : <ArrowRight className="h-4 w-4" />}
                  {busy ? "A validar acesso…" : "Entrar com segurança"}
                </button>
              </form>

              <div className="mt-6 border-t border-white/8 pt-5 text-[10px] leading-5 text-[#607872]">
                Sessão protegida por cookies HttpOnly. O browser não recebe acesso direto ao banco ou credenciais financeiras.
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
