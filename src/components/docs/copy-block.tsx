"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

export function CopyBlock({
  code,
  label,
  language,
}: {
  code: string;
  label?: string;
  language?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-white/8 bg-[#01090B]">
      <div className="flex items-center justify-between border-b border-white/7 px-4 py-2.5">
        <div className="flex items-center gap-2">
          {label ? <span className="text-[8px] font-bold uppercase tracking-[.1em] text-[#8CA19B]">{label}</span> : null}
          {language ? <span className="text-[7px] uppercase tracking-[.1em] text-[#526A64]">{language}</span> : null}
        </div>
        <button
          type="button"
          onClick={copy}
          className="flex items-center gap-1.5 rounded-lg border border-white/8 px-2.5 py-1.5 text-[8px] font-semibold text-[#7F9992] transition hover:border-[#20F29A]/25 hover:text-[#20F29A]"
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          {copied ? "Copiado" : "Copiar"}
        </button>
      </div>
      <pre className="overflow-x-auto p-4 text-[10px] leading-5 text-[#A9C0BA]">
        <code>{code}</code>
      </pre>
    </div>
  );
}

export function InlineCode({ children }: { children: string }) {
  return (
    <code className="rounded-md border border-white/8 bg-white/[.035] px-1.5 py-0.5 text-[9px] text-[#8EDDBF]">
      {children}
    </code>
  );
}
