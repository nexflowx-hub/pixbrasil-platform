"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, Share, X } from "lucide-react";
import { BrandMark } from "@/components/brand/logo";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

function isIosDevice() {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isStandalone() {
  if (typeof window === "undefined") return false;
  const iosStandalone = Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
  return window.matchMedia("(display-mode: standalone)").matches || iosStandalone;
}

export function PwaInstallPrompt() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [dismissed, setDismissed] = useState(true);
  const [iosHelp, setIosHelp] = useState(false);

  const ios = useMemo(() => isIosDevice(), []);

  useEffect(() => {
    const bootstrapTimer = window.setTimeout(() => {
      setInstalled(isStandalone());
      const wasDismissed = sessionStorage.getItem("pixbrasil-install-dismissed") === "1";
      setDismissed(wasDismissed);
    }, 0);

    const timer = window.setTimeout(() => {
      if (sessionStorage.getItem("pixbrasil-install-dismissed") !== "1") {
        setDismissed(false);
      }
    }, 4500);

    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setInstallEvent(null);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      window.clearTimeout(bootstrapTimer);
      window.clearTimeout(timer);
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed || dismissed || (!installEvent && !ios)) return null;

  const dismiss = () => {
    sessionStorage.setItem("pixbrasil-install-dismissed", "1");
    setDismissed(true);
  };

  const install = async () => {
    if (installEvent) {
      await installEvent.prompt();
      const choice = await installEvent.userChoice;
      if (choice.outcome === "accepted") {
        setInstalled(true);
      }
      setInstallEvent(null);
      return;
    }
    setIosHelp(true);
  };

  return (
    <aside
      aria-label="Instalar PiXBrasil como aplicativo"
      className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] left-4 right-4 z-[70] mx-auto max-w-[420px] rounded-2xl border border-pix/30 bg-[#031416]/95 p-4 shadow-[0_22px_70px_rgba(0,0,0,.55)] backdrop-blur-xl sm:left-auto sm:right-5 sm:mx-0"
    >
      <button
        type="button"
        onClick={dismiss}
        aria-label="Fechar convite de instalação"
        className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full text-dim transition-colors hover:bg-white/5 hover:text-cream"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="flex items-start gap-3 pr-8">
        <BrandMark className="h-11 w-11" />
        <div className="min-w-0">
          <p className="text-sm font-bold text-cream">PiXBrasil no seu dispositivo</p>
          <p className="mt-1 text-[12px] leading-5 text-mist">
            Instale a experiência PWA para abrir em modo aplicativo. Nesta fase, a área financeira continua em pré-lançamento.
          </p>
        </div>
      </div>

      {iosHelp ? (
        <p className="mt-3 rounded-xl border border-white/10 bg-white/[0.035] p-3 text-[11.5px] leading-5 text-mist">
          No Safari, toque em <Share className="mx-1 inline h-3.5 w-3.5 text-pix" /> <strong className="text-cream">Compartilhar</strong> e depois em <strong className="text-cream">Adicionar à Tela de Início</strong>.
        </p>
      ) : null}

      <button
        type="button"
        onClick={install}
        className="btn-cta mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-full px-5 text-[13px] font-bold"
      >
        <Download className="h-4 w-4" />
        {installEvent ? "Instalar aplicativo" : "Como instalar"}
      </button>
    </aside>
  );
}
