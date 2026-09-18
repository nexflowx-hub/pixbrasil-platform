"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, Share2, X } from "lucide-react";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

export function PwaInstallPrompt() {
  const [installEvent, setInstallEvent] = useState<InstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [iosHint, setIosHint] = useState(false);

  const installed = useMemo(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(display-mode: standalone)").matches ||
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
  }, []);

  useEffect(() => {
    if (installed || sessionStorage.getItem("pixbrasil:pwa-dismissed") === "1") return;

    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const isSafari = /safari/i.test(navigator.userAgent) && !/crios|fxios|edgios/i.test(navigator.userAgent);

    if (isIos && isSafari) {
      setIosHint(true);
      setVisible(true);
    }

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as InstallPromptEvent);
      setVisible(true);
    };

    const onInstalled = () => {
      setVisible(false);
      setInstallEvent(null);
      sessionStorage.removeItem("pixbrasil:pwa-dismissed");
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, [installed]);

  if (!visible || installed) return null;

  const dismiss = () => {
    sessionStorage.setItem("pixbrasil:pwa-dismissed", "1");
    setVisible(false);
  };

  const install = async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    if (choice.outcome === "accepted") setVisible(false);
    setInstallEvent(null);
  };

  return (
    <aside
      className="fixed bottom-4 left-4 right-4 z-[70] mx-auto max-w-[420px] rounded-2xl border border-pix/25 bg-[#041315]/95 p-4 shadow-[0_18px_70px_rgba(0,0,0,.55)] backdrop-blur-2xl sm:left-auto sm:right-5"
      aria-label="Instalar aplicação PiXBrasil"
    >
      <button type="button" onClick={dismiss} aria-label="Fechar sugestão de instalação" className="absolute right-3 top-3 rounded-full p-1.5 text-dim hover:bg-white/5 hover:text-cream">
        <X className="h-4 w-4" />
      </button>

      <div className="pr-8">
        <p className="text-[13px] font-semibold text-cream">Leve o PiXBrasil para a tela inicial</p>
        <p className="mt-1 text-[11px] leading-[1.45] text-dim">
          {iosHint
            ? "No Safari, toque em Compartilhar e depois em “Adicionar à Tela de Início”."
            : "Instale a experiência web como app. Nenhum dado financeiro é armazenado offline."}
        </p>
      </div>

      <div className="mt-3 flex items-center gap-2">
        {installEvent ? (
          <button type="button" onClick={install} className="btn-cta inline-flex h-9 items-center gap-2 rounded-full px-4 text-[11.5px] font-semibold">
            <Download className="h-3.5 w-3.5" /> Instalar app
          </button>
        ) : iosHint ? (
          <span className="inline-flex h-9 items-center gap-2 rounded-full border border-pix/30 bg-pix/[0.08] px-4 text-[11.5px] font-medium text-mist">
            <Share2 className="h-3.5 w-3.5 text-pix" /> Compartilhar → Adicionar à Tela
          </span>
        ) : null}
      </div>
    </aside>
  );
}
