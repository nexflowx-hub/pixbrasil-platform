import type { Metadata } from "next";
import { DocsCard, DocsGrid, DocsSection, DocsShell } from "@/components/docs/docs-shell";
import { CopyBlock, InlineCode } from "@/components/docs/copy-block";

export const metadata: Metadata = {
  title: "Tracking & UTM",
  description: "Atribuição, UTMify e postbacks com PiXBrasil.",
};

const metadataExample = "{\n  \"metadata\": {\n    \"orderId\": \"8472\",\n    \"attribution\": {\n      \"utm_source\": \"meta\",\n      \"utm_medium\": \"paid_social\",\n      \"utm_campaign\": \"signum_launch\",\n      \"utm_content\": \"creative_03\",\n      \"utm_term\": \"audience_broad\",\n      \"src\": \"facebook\",\n      \"sck\": \"abc123\",\n      \"fbclid\": \"...\",\n      \"gclid\": \"...\",\n      \"ttclid\": \"...\",\n      \"msclkid\": \"...\"\n    }\n  }\n}";

const bridge = "Browser/Funnel\n  ↓ captura UTMs e click IDs\nBackend do Merchant\n  ↓ metadata.attribution\nPiXBrasil PaymentIntent\n  ↓ pagamento confirmado\nPiXBrasil Merchant Webhook\n  ↓ payment.succeeded + metadata.attribution\nSeu Tracking Bridge\n  ├─ UTMify\n  ├─ Meta CAPI\n  ├─ TikTok Events API\n  ├─ Google Ads / GA4\n  └─ CRM / BI";

const trackingPrompt = "Implemente uma camada de atribuição first-party no meu site. Capture utm_source, utm_medium, utm_campaign, utm_content, utm_term, src, sck, fbclid, gclid, ttclid e msclkid na primeira visita. Preserve os valores por 30 dias em storage/cookie apropriado ao stack e grave também no pedido server-side. Ao criar o PIX PiXBrasil, envie esses campos em metadata.attribution. No webhook payment.succeeded, leia metadata.attribution e encaminhe a conversão para a plataforma de tracking configurada usando exclusivamente a documentação oficial/credenciais da conta. Não invente endpoints. O pagamento confirmado pelo PiXBrasil deve ser a source of truth da conversão. Implemente dedupe para que o mesmo paymentIntentId não gere duas conversões.";

export default function TrackingDocsPage() {
  return (
    <DocsShell
      eyebrow="TRACKING & ATTRIBUTION"
      title="O pagamento confirmado deve fechar o ciclo de atribuição."
      description="O PiXBrasil transporta metadata de atribuição do checkout até o webhook do merchant. Isso permite ligar conversões confirmadas a UTMify e outras plataformas sem acoplar o Core financeiro a um único tracker."
    >
      <DocsSection id="architecture" title="Arquitetura recomendada">
        <CopyBlock label="Attribution flow" language="text" code={bridge} />
      </DocsSection>

      <DocsSection id="capture" title="Campos recomendados">
        <CopyBlock label="Payment metadata" language="json" code={metadataExample} />
        <p className="mt-4 text-[9px] leading-5 text-[#718A83]">
          Preserve somente identificadores necessários à atribuição. Não envie senha, cartão, documento completo ou secrets em <InlineCode>metadata</InlineCode>.
        </p>
      </DocsSection>

      <DocsSection id="utmify" title="UTMify">
        <DocsGrid>
          <DocsCard title="Integração hoje" tone="green">
            Use <InlineCode>payment.succeeded</InlineCode> como source of truth e faça o postback através do seu backend/Tracking Bridge.
          </DocsCard>
          <DocsCard title="Por que não acoplar diretamente">
            Credenciais, payloads e regras de terceiros mudam. O Core financeiro não deve depender da disponibilidade do tracker para confirmar um pagamento.
          </DocsCard>
          <DocsCard title="Falha de tracking">
            Se UTMify estiver indisponível, o pedido continua pago. Grave uma fila/retry independente para analytics.
          </DocsCard>
          <DocsCard title="Native Connector — próximo passo" tone="gold">
            Podemos adicionar UTMify/Meta/TikTok/Google como connectors nativos com credenciais em Vault, logs, retries e mapping configurável por Store.
          </DocsCard>
        </DocsGrid>
      </DocsSection>

      <DocsSection id="other-platforms" title="Outras plataformas">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {["Meta CAPI", "TikTok Events API", "Google Ads / GA4", "CRM / BI"].map((item) => (
            <div key={item} className="rounded-2xl border border-white/8 bg-[#061214] p-4">
              <strong className="text-[10px]">{item}</strong>
              <p className="mt-2 text-[8px] leading-4 text-[#708780]">Dispare somente após evento financeiro verificado e aplique dedupe por PaymentIntent.</p>
            </div>
          ))}
        </div>
      </DocsSection>

      <DocsSection id="ai" title="Prompt para criar o Tracking Bridge">
        <CopyBlock label="AI prompt" language="prompt" code={trackingPrompt} />
      </DocsSection>

      <DocsSection id="principles" title="Princípios">
        <ul className="space-y-2 text-[9px] leading-5 text-[#78918A]">
          <li>• PiXBrasil confirma dinheiro; tracker mede aquisição.</li>
          <li>• Analytics nunca deve bloquear checkout ou webhook financeiro.</li>
          <li>• Use first-party attribution e server-side postback sempre que possível.</li>
          <li>• Deduplique por PaymentIntent/evento antes de enviar conversão.</li>
          <li>• Guarde tokens de tracking em secret manager/Vault, nunca em metadata.</li>
        </ul>
      </DocsSection>
    </DocsShell>
  );
}
