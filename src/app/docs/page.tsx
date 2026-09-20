import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Bot, Braces, CheckCircle2, KeyRound, RadioTower, Store, Webhook } from "lucide-react";
import { DocsCard, DocsGrid, DocsSection, DocsShell } from "@/components/docs/docs-shell";
import { CopyBlock, InlineCode } from "@/components/docs/copy-block";

export const metadata: Metadata = {
  title: "Documentação API",
  description: "Guia oficial de integração do PiXBrasil para merchants.",
};

const quickStart = "# Server-side only\nPIXBRASIL_API_URL=https://api.pixbrasil.org/api/v1\nPIXBRASIL_API_KEY=pix_live_...\nPIXBRASIL_STORE=SIGNUM";

const charge = "curl -X POST https://api.pixbrasil.org/api/v1/payments/charge \\\n  -H \"Authorization: Bearer $PIXBRASIL_API_KEY\" \\\n  -H \"Idempotency-Key: order-8472-pix-1\" \\\n  -H \"Content-Type: application/json\" \\\n  -d '{\n    \"store\": \"SIGNUM\",\n    \"amount\": 149.90,\n    \"currency\": \"BRL\",\n    \"reference\": \"ORDER-8472\",\n    \"payer\": {\n      \"name\": \"Cliente Exemplo\",\n      \"taxId\": \"CPF_OU_CNPJ_VALIDO\"\n    },\n    \"metadata\": {\n      \"orderId\": \"8472\",\n      \"attribution\": {\n        \"utm_source\": \"meta\",\n        \"utm_campaign\": \"signum-launch\"\n      }\n    }\n  }'";

export default function DocsHomePage() {
  return (
    <DocsShell
      eyebrow="MERCHANT DOCUMENTATION"
      title="Integre PIX sem transformar o seu site num projeto financeiro."
      description="O PiXBrasil separa Store, routing, provider, liberação e credenciais. Esta documentação mostra o fluxo mínimo e seguro para integrar um site, e-commerce, SaaS ou funnel ao Core."
    >
      <DocsSection id="status" title="Estado atual da plataforma" description="A documentação descreve as capacidades em produção, o routing por Store e o processamento manual de Tesouraria.">
        <DocsGrid>
          <DocsCard title="API S2S" tone="green">
            <div className="flex items-center gap-2 text-[#79D8B8]"><CheckCircle2 className="h-3.5 w-3.5" /> Disponível</div>
            <p className="mt-2">API Keys por Merchant/Store, idempotência, PaymentIntent e consulta de status.</p>
          </DocsCard>
          <DocsCard title="Merchant Webhooks" tone="green">
            <div className="flex items-center gap-2 text-[#79D8B8]"><CheckCircle2 className="h-3.5 w-3.5" /> Disponível</div>
            <p className="mt-2">Endpoints HTTPS assinados com HMAC-SHA256 e signing secret em Vault.</p>
          </DocsCard>
          <DocsCard title="Provider execution" tone="gold">
            <div className="flex items-center gap-2 text-[#D9B969]"><CheckCircle2 className="h-3.5 w-3.5" /> PRODUÇÃO / routing por Store</div>
            <p className="mt-2">Stores em produção criam PIX real através do provider selecionado pelo routing configurado.</p>
          </DocsCard>
          <DocsCard title="Payouts & settlement" tone="gold">
            <div className="flex items-center gap-2 text-[#D9B969]"><CheckCircle2 className="h-3.5 w-3.5" /> Manual</div>
            <p className="mt-2">Liberação obedece à release policy da Store; payouts são processados por ticket manual de Tesouraria nesta fase.</p>
          </DocsCard>
        </DocsGrid>
      </DocsSection>

      <DocsSection id="mental-model" title="O modelo mental em 60 segundos">
        <div className="grid gap-3 md:grid-cols-4">
          {[
            [Store, "Merchant", "A empresa que integra o PiXBrasil."],
            [Store, "Store", "O escopo comercial/operacional que define routing e release."],
            [Braces, "PaymentIntent", "A intenção de pagamento criada de forma idempotente."],
            [Webhook, "Webhook", "A confirmação assíncrona enviada ao backend do merchant."],
          ].map(([Icon, title, text]) => (
            <div key={String(title)} className="rounded-2xl border border-white/8 bg-[#061214] p-4">
              <Icon className="h-4 w-4 text-[#20F29A]" />
              <strong className="mt-4 block text-[11px]">{String(title)}</strong>
              <p className="mt-2 text-[9px] leading-5 text-[#718A83]">{String(text)}</p>
            </div>
          ))}
        </div>
      </DocsSection>

      <DocsSection id="quickstart" title="Quickstart">
        <ol className="grid gap-3 md:grid-cols-2">
          {[
            ["1", "Gere uma API Key", "No Admin PiXBrasil, crie uma chave S2S com grants apenas às Stores necessárias."],
            ["2", "Guarde no servidor", "Nunca envie a chave para JavaScript client-side, app móvel, GTM ou HTML."],
            ["3", "Crie PaymentIntent", "Valide preço/pedido no seu backend e chame POST /payments/charge com Idempotency-Key."],
            ["4", "Configure webhook", "Crie um endpoint HTTPS no seu site e registre-o no PiXBrasil."],
          ].map(([n, title, text]) => (
            <li key={n} className="rounded-2xl border border-white/8 bg-[#061214] p-4">
              <span className="text-[9px] font-bold text-[#20F29A]">{n}</span>
              <strong className="ml-2 text-[11px]">{title}</strong>
              <p className="mt-2 text-[9px] leading-5 text-[#718A83]">{text}</p>
            </li>
          ))}
        </ol>
        <div className="mt-5 space-y-4">
          <CopyBlock label="Environment" language=".env" code={quickStart} />
          <CopyBlock label="Create payment" language="curl" code={charge} />
        </div>
      </DocsSection>

      <DocsSection id="security" title="Regras que não podem ser quebradas">
        <DocsGrid>
          <DocsCard title="API Key">Somente backend. Trate <InlineCode>pix_live_...</InlineCode> como segredo financeiro.</DocsCard>
          <DocsCard title="Idempotência">Uma tentativa de checkout deve reutilizar a mesma <InlineCode>Idempotency-Key</InlineCode> em retries.</DocsCard>
          <DocsCard title="Preço">Nunca aceite o valor final enviado pelo browser. Recalcule preço, frete e descontos no servidor.</DocsCard>
          <DocsCard title="Webhook">Valide timestamp e assinatura HMAC usando o raw body antes de alterar o pedido.</DocsCard>
        </DocsGrid>
      </DocsSection>

      <DocsSection id="next" title="Escolha o próximo passo">
        <div className="grid gap-3 md:grid-cols-2">
          {[
            ["/docs/api", Braces, "API Reference", "Requests, responses, status e erros."],
            ["/docs/webhooks", RadioTower, "Webhooks", "Registro, assinatura e handler seguro."],
            ["/docs/ai-setup", Bot, "AI Setup Kits", "Prompts prontos para GPT, Claude, Cursor e agentes."],
            ["/docs/tracking", KeyRound, "Tracking & UTM", "UTMify, pixels, click IDs e attribution bridge."],
          ].map(([href, Icon, title, text]) => (
            <Link key={String(href)} href={String(href)} className="group rounded-2xl border border-white/8 bg-[#061214] p-4 transition hover:border-[#20F29A]/20">
              <Icon className="h-4 w-4 text-[#5CC9A7]" />
              <strong className="mt-4 flex items-center gap-2 text-[11px]">{String(title)} <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-1" /></strong>
              <p className="mt-2 text-[9px] leading-5 text-[#718A83]">{String(text)}</p>
            </Link>
          ))}
        </div>
      </DocsSection>
    </DocsShell>
  );
}
