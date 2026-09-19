import type { Metadata } from "next";
import { DocsCard, DocsGrid, DocsSection, DocsShell } from "@/components/docs/docs-shell";
import { CopyBlock, InlineCode } from "@/components/docs/copy-block";

export const metadata: Metadata = {
  title: "Webhooks",
  description: "Integração segura de webhooks PiXBrasil.",
};

const register = "curl -X POST https://api.pixbrasil.org/api/v1/webhook-endpoints \\\n  -H \"Authorization: Bearer $PIXBRASIL_API_KEY\" \\\n  -H \"Content-Type: application/json\" \\\n  -d '{\n    \"name\": \"Checkout production\",\n    \"endpointUrl\": \"https://shop.example.com/api/webhooks/pixbrasil\",\n    \"events\": [\"payment.pending\",\"payment.succeeded\",\"payment.failed\",\"payment.canceled\"]\n  }'";

const response = "{\n  \"success\": true,\n  \"data\": {\n    \"endpointId\": \"uuid\",\n    \"endpointUrl\": \"https://shop.example.com/api/webhooks/pixbrasil\",\n    \"status\": \"ACTIVE\",\n    \"signingSecret\": \"whsec_...\",\n    \"signingAlgorithm\": \"HMAC-SHA256\",\n    \"signatureHeader\": \"X-PiXBrasil-Signature\",\n    \"timestampHeader\": \"X-PiXBrasil-Timestamp\"\n  }\n}";

const node = "import { createHmac, timingSafeEqual } from \"node:crypto\";\n\nexport function verifyPixBrasilWebhook(rawBody, headers, secret) {\n  const timestamp = headers.get(\"x-pixbrasil-timestamp\") || \"\";\n  const received = (headers.get(\"x-pixbrasil-signature\") || \"\").replace(/^v1=/, \"\");\n\n  if (!/^\\d+$/.test(timestamp)) throw new Error(\"invalid timestamp\");\n  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) throw new Error(\"expired webhook\");\n\n  const expected = createHmac(\"sha256\", secret)\n    .update(timestamp + \".\" + rawBody)\n    .digest();\n  const receivedBytes = Buffer.from(received, \"hex\");\n\n  if (expected.length !== receivedBytes.length || !timingSafeEqual(expected, receivedBytes)) {\n    throw new Error(\"invalid signature\");\n  }\n}";

const next = "export async function POST(request) {\n  const rawBody = await request.text();\n  verifyPixBrasilWebhook(rawBody, request.headers, process.env.PIXBRASIL_WEBHOOK_SECRET);\n\n  const event = JSON.parse(rawBody);\n  const deliveryId = request.headers.get(\"x-pixbrasil-delivery\");\n\n  // 1. dedupe by deliveryId in your DB\n  // 2. update the order idempotently\n  // 3. return 2xx quickly\n  // 4. queue analytics/postbacks after the response when possible\n\n  return Response.json({ received: true });\n}";

const payload = "{\n  \"id\": \"delivery-uuid\",\n  \"type\": \"payment.succeeded\",\n  \"createdAt\": \"2026-09-19T...Z\",\n  \"data\": {\n    \"paymentIntentId\": \"uuid\",\n    \"reference\": \"ORDER-8472\",\n    \"amount\": 149.90,\n    \"currency\": \"BRL\",\n    \"status\": \"SUCCEEDED\",\n    \"store\": { \"code\": \"SIGNUM\" },\n    \"provider\": { \"code\": \"MISTICPAY\", \"paymentId\": \"...\" },\n    \"completedAt\": \"2026-09-19T...Z\",\n    \"metadata\": {\n      \"orderId\": \"8472\",\n      \"attribution\": { \"utm_source\": \"meta\" }\n    }\n  }\n}";

export default function WebhooksDocsPage() {
  return (
    <DocsShell
      eyebrow="MERCHANT WEBHOOKS"
      title="Confirmação de pagamento deve chegar ao seu backend assinada."
      description="O PiXBrasil envia eventos somente para endpoints HTTPS registrados pelo merchant. Cada endpoint recebe um signing secret exclusivo guardado em Vault."
    >
      <DocsSection id="events" title="Eventos">
        <DocsGrid>
          <DocsCard title="payment.pending">Estado intermediário. Não entregue produto/serviço apenas com este evento.</DocsCard>
          <DocsCard title="payment.succeeded" tone="green">Confirmação verificada pelo provider. Este é o evento normal para fulfillment.</DocsCard>
          <DocsCard title="payment.failed">Falha definitiva conhecida.</DocsCard>
          <DocsCard title="payment.canceled">Cancelamento ou estado equivalente confirmado.</DocsCard>
        </DocsGrid>
      </DocsSection>

      <DocsSection id="register" title="1. Registre seu endpoint">
        <CopyBlock label="Register" language="curl" code={register} />
        <div className="mt-4"><CopyBlock label="One-time response" language="json" code={response} /></div>
        <p className="mt-4 text-[9px] leading-5 text-[#718A83]">
          Salve o <InlineCode>signingSecret</InlineCode> em <InlineCode>PIXBRASIL_WEBHOOK_SECRET</InlineCode>. Ele é exibido uma única vez.
        </p>
      </DocsSection>

      <DocsSection id="signature" title="2. Valide a assinatura">
        <p className="mb-4 text-[9px] leading-5 text-[#718A83]">
          A assinatura é <InlineCode>HMAC-SHA256</InlineCode> sobre <InlineCode>timestamp + "." + rawBody</InlineCode>. O header contém <InlineCode>v1=HEX</InlineCode>. Compare em tempo constante e rejeite timestamps antigos.
        </p>
        <CopyBlock label="Node.js verification" language="ts" code={node} />
      </DocsSection>

      <DocsSection id="handler" title="3. Faça um handler idempotente">
        <CopyBlock label="Next.js App Router" language="ts" code={next} />
        <div className="mt-4 rounded-2xl border border-white/8 bg-[#061214] p-4 text-[9px] leading-5 text-[#718A83]">
          Use <InlineCode>X-PiXBrasil-Delivery</InlineCode> como chave de deduplicação. Responda 2xx rapidamente; não dependa de analytics externo para confirmar o webhook.
        </div>
      </DocsSection>

      <DocsSection id="payload" title="Payload de pagamento">
        <CopyBlock label="payment.succeeded" language="json" code={payload} />
      </DocsSection>

      <DocsSection id="headers" title="Headers enviados">
        <div className="overflow-x-auto rounded-2xl border border-white/8">
          <table className="w-full min-w-[620px] text-left text-[9px]">
            <thead className="bg-white/[.025] text-[#718A83]"><tr><th className="p-3">Header</th><th className="p-3">Uso</th></tr></thead>
            <tbody className="divide-y divide-white/6">
              <tr><td className="p-3">X-PiXBrasil-Event</td><td className="p-3">Tipo do evento.</td></tr>
              <tr><td className="p-3">X-PiXBrasil-Delivery</td><td className="p-3">UUID para deduplicação e auditoria.</td></tr>
              <tr><td className="p-3">X-PiXBrasil-Timestamp</td><td className="p-3">Unix timestamp usado na assinatura.</td></tr>
              <tr><td className="p-3">X-PiXBrasil-Signature</td><td className="p-3">v1=HMAC-SHA256.</td></tr>
            </tbody>
          </table>
        </div>
      </DocsSection>

      <DocsSection id="test" title="Teste antes de receber dinheiro">
        <p className="text-[9px] leading-5 text-[#718A83]">
          Use <InlineCode>POST /webhook-endpoints/:endpointId/test</InlineCode>. O PiXBrasil enviará <InlineCode>webhook.test</InlineCode> e registrará HTTP status, delivery ID e eventual falha. O endpoint deve responder 2xx.
        </p>
      </DocsSection>
    </DocsShell>
  );
}
