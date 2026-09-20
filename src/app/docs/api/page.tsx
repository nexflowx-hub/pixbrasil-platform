import type { Metadata } from "next";
import { DocsCard, DocsGrid, DocsSection, DocsShell } from "@/components/docs/docs-shell";
import { CopyBlock, InlineCode } from "@/components/docs/copy-block";

export const metadata: Metadata = {
  title: "API Reference",
  description: "Referência da API merchant PiXBrasil.",
};

const createRequest = "POST /api/v1/payments/charge\nAuthorization: Bearer pix_live_...\nIdempotency-Key: order-8472-pix-1\nContent-Type: application/json\n\n{\n  \"store\": \"SIGNUM\",\n  \"amount\": 149.90,\n  \"currency\": \"BRL\",\n  \"reference\": \"ORDER-8472\",\n  \"description\": \"SIGNUM 312\",\n  \"payer\": {\n    \"name\": \"Cliente Exemplo\",\n    \"taxId\": \"CPF_OU_CNPJ_VALIDO\",\n    \"email\": \"cliente@example.com\",\n    \"phone\": \"+55...\"\n  },\n  \"metadata\": {\n    \"orderId\": \"8472\",\n    \"attribution\": {\n      \"utm_source\": \"meta\",\n      \"utm_medium\": \"paid\",\n      \"utm_campaign\": \"launch\"\n    }\n  }\n}";

const liveResponse = "{\n  \"success\": true,\n  \"data\": {\n    \"paymentIntentId\": \"uuid\",\n    \"idempotentReplay\": false,\n    \"status\": \"PENDING_PAYMENT\",\n    \"amount\": 149.90,\n    \"currency\": \"BRL\",\n    \"reference\": \"ORDER-8472\",\n    \"store\": { \"code\": \"SIGNUM\", \"name\": \"Signum\" },\n    \"routing\": {\n      \"mode\": \"LIVE\",\n      \"providerCode\": \"MISTICPAY\",\n      \"gatewayAlias\": \"misticpay-primary\",\n      \"releaseClass\": \"D0\"\n    },\n    \"provider\": { \"paymentId\": \"provider-id\" },\n    \"action\": {\n      \"type\": \"PIX_QR\",\n      \"copyPaste\": \"000201...PixCopiaECola...\"\n    }\n  }\n}";

const getPayment = "GET /api/v1/payments/{paymentIntentId}\nAuthorization: Bearer pix_live_...";

const registerWebhook = "POST /api/v1/webhook-endpoints\nAuthorization: Bearer pix_live_...\nContent-Type: application/json\n\n{\n  \"name\": \"Production checkout\",\n  \"endpointUrl\": \"https://shop.example.com/api/webhooks/pixbrasil\",\n  \"events\": [\n    \"payment.pending\",\n    \"payment.succeeded\",\n    \"payment.failed\",\n    \"payment.canceled\"\n  ]\n}";

export default function ApiDocsPage() {
  return (
    <DocsShell
      eyebrow="API REFERENCE"
      title="Uma API pequena, server-side e orientada a PaymentIntent."
      description="A API merchant usa Bearer API Keys e grants por Store. Todas as operações sensíveis devem acontecer no backend do merchant."
    >
      <DocsSection id="base" title="Base URL & autenticação">
        <DocsGrid>
          <DocsCard title="Production" tone="green">
            <InlineCode>https://api.pixbrasil.org/api/v1</InlineCode>
          </DocsCard>
          <DocsCard title="Authorization">
            <InlineCode>Authorization: Bearer pix_live_...</InlineCode>
          </DocsCard>
        </DocsGrid>
        <p className="mt-4 text-[9px] leading-5 text-[#718A83]">
          Novas chaves emitidas pelo Admin recebem os scopes <InlineCode>payments:create</InlineCode> e <InlineCode>webhooks:manage</InlineCode>. Grants limitam quais Stores a chave pode utilizar.
        </p>
      </DocsSection>

      <DocsSection id="create" title="POST /payments/charge" description="Cria um PaymentIntent idempotente e resolve Store → policy → provider → economics → release.">
        <CopyBlock label="Request" language="http" code={createRequest} />
        <div className="mt-4"><CopyBlock label="Production response" language="json" code={liveResponse} /></div>
        <div className="mt-4 rounded-2xl border border-[#20F29A]/16 bg-[#20F29A]/4 p-4 text-[9px] leading-5 text-[#7FBBA7]">
          <strong className="text-[#20F29A]">Produção:</strong> renderize o QR/Copia e Cola somente quando <InlineCode>status</InlineCode> for <InlineCode>PENDING_PAYMENT</InlineCode> e <InlineCode>action.type</InlineCode> for <InlineCode>PIX_QR</InlineCode>. A confirmação final deve vir por webhook verificado.
        </div>
      </DocsSection>

      <DocsSection id="status" title="GET /payments/:paymentIntentId">
        <CopyBlock label="Request" language="http" code={getPayment} />
        <p className="mt-4 text-[9px] leading-5 text-[#718A83]">
          Use consulta de status como fallback/reconciliação. O mecanismo principal para confirmação assíncrona deve ser webhook.
        </p>
      </DocsSection>

      <DocsSection id="webhook-api" title="Webhook endpoint management">
        <div className="space-y-4">
          <CopyBlock label="Register endpoint" language="http" code={registerWebhook} />
          <DocsGrid>
            <DocsCard title="GET /webhook-endpoints">Lista endpoints, eventos, status, failure count e última entrega. O signing secret nunca é reexibido.</DocsCard>
            <DocsCard title="POST /webhook-endpoints/:id/test">Envia <InlineCode>webhook.test</InlineCode> para validar rede, TLS e handler.</DocsCard>
            <DocsCard title="POST /webhook-endpoints/:id/revoke">Revoga o endpoint imediatamente.</DocsCard>
            <DocsCard title="Signing secret">O <InlineCode>whsec_...</InlineCode> é retornado uma única vez na criação e armazenado em Vault no PiXBrasil.</DocsCard>
          </DocsGrid>
        </div>
      </DocsSection>

      <DocsSection id="errors" title="Erros e comportamento esperado">
        <div className="overflow-x-auto rounded-2xl border border-white/8">
          <table className="w-full min-w-[650px] text-left text-[9px]">
            <thead className="bg-white/[.025] text-[#718A83]">
              <tr><th className="p-3">HTTP</th><th className="p-3">Quando</th><th className="p-3">Ação</th></tr>
            </thead>
            <tbody className="divide-y divide-white/6">
              <tr><td className="p-3">400</td><td className="p-3">Payload, CPF/CNPJ, URL ou metadata inválidos</td><td className="p-3">Corrija o request; não faça retry cego.</td></tr>
              <tr><td className="p-3">401</td><td className="p-3">API Key ausente/inválida</td><td className="p-3">Verifique env server-side.</td></tr>
              <tr><td className="p-3">403</td><td className="p-3">Scope/Store não autorizado</td><td className="p-3">Revise grants da chave.</td></tr>
              <tr><td className="p-3">404</td><td className="p-3">PaymentIntent/Store não encontrado</td><td className="p-3">Confirme IDs e escopo do merchant.</td></tr>
              <tr><td className="p-3">409</td><td className="p-3">Idempotency-Key reutilizada com payload diferente</td><td className="p-3">Não altere dados usando a mesma chave.</td></tr>
              <tr><td className="p-3">5xx</td><td className="p-3">Falha temporária</td><td className="p-3">Retry exponencial usando a mesma Idempotency-Key.</td></tr>
            </tbody>
          </table>
        </div>
      </DocsSection>

      <DocsSection id="openapi" title="OpenAPI">
        <p className="text-[9px] leading-5 text-[#718A83]">
          A especificação machine-readable está disponível em <a className="text-[#20F29A]" href="/openapi.json">/openapi.json</a> para importar em Postman, Insomnia, Bruno ou ferramentas de geração de SDK.
        </p>
      </DocsSection>
    </DocsShell>
  );
}
