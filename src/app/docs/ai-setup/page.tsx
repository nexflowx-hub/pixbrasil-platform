import type { Metadata } from "next";
import { DocsCard, DocsGrid, DocsSection, DocsShell } from "@/components/docs/docs-shell";
import { CopyBlock } from "@/components/docs/copy-block";

export const metadata: Metadata = {
  title: "AI Setup Kits",
  description: "Prompts prontos para integrar PiXBrasil com GPT, Claude, Cursor ou outro agente.",
};

const universalPrompt = "Você é o engenheiro responsável por integrar meu site ao PiXBrasil. Trabalhe diretamente no repositório atual e NÃO exponha segredos no browser, bundle, logs ou commits.\n\nOBJETIVO\nIntegrar checkout PIX server-side usando a API PiXBrasil, criar webhook assinado, manter idempotência e devolver um relatório final com a URL pública do webhook que eu devo registrar.\n\nCONTRATO PIXBRASIL\nBase URL: https://api.pixbrasil.org/api/v1\nAuth: Authorization: Bearer process.env.PIXBRASIL_API_KEY\nStore: process.env.PIXBRASIL_STORE\nCreate payment: POST /payments/charge\nGet payment: GET /payments/{paymentIntentId}\nRegister webhook: POST /webhook-endpoints\nTest webhook: POST /webhook-endpoints/{endpointId}/test\nWebhook signature: HMAC-SHA256(timestamp + '.' + rawBody)\nHeaders: X-PiXBrasil-Timestamp, X-PiXBrasil-Signature, X-PiXBrasil-Delivery, X-PiXBrasil-Event\n\nREGRAS OBRIGATÓRIAS\n1. Detecte o stack do projeto antes de alterar código.\n2. Crie variáveis server-side: PIXBRASIL_API_URL, PIXBRASIL_API_KEY, PIXBRASIL_STORE e depois PIXBRASIL_WEBHOOK_SECRET.\n3. Nunca coloque a API Key em NEXT_PUBLIC_*, VITE_*, HTML, JS client-side, GTM ou app mobile.\n4. O browser NÃO define o valor final da cobrança. Recalcule produto, preço, desconto, frete e total no backend usando fonte confiável.\n5. Para cada tentativa de checkout, derive uma Idempotency-Key estável e reutilize-a em retries.\n6. Crie uma rota server-side de checkout que chama POST /payments/charge.\n7. Em PENDING_PAYMENT, renderize somente o QR/copia-e-cola retornado em provider.action. Nunca fabrique ou derive um QR no client.\n8. Persista paymentIntentId, reference, store e status no meu banco.\n9. Crie GET/status server-side como fallback usando GET /payments/{paymentIntentId}.\n10. Crie um endpoint HTTPS público /api/webhooks/pixbrasil ou equivalente idiomático para o stack.\n11. Leia o RAW BODY antes de JSON.parse e valide HMAC-SHA256 em tempo constante. Rejeite timestamp acima de 5 minutos.\n12. Deduplicatee por X-PiXBrasil-Delivery.\n13. Em payment.succeeded, atualize o pedido de forma idempotente; nunca confie apenas em retorno do browser.\n14. Capture UTMs e click IDs em first-party storage e envie em metadata.attribution: utm_source, utm_medium, utm_campaign, utm_content, utm_term, src, sck, fbclid, gclid, ttclid e msclkid quando existirem.\n15. No webhook payment.succeeded, exponha esses dados para meu módulo de analytics/postback. Não invente endpoints de terceiros; use somente a documentação oficial que estiver disponível no projeto/conta.\n16. Preserve o checkout atual como rollback até eu autorizar a troca definitiva.\n17. Adicione testes para assinatura, idempotência, valor server-side e webhook replay.\n18. Não altere secrets reais em commits. Use placeholders e indique exatamente onde devo configurar os valores no ambiente de produção.\n\nENTREGA FINAL OBRIGATÓRIA\n- arquivos criados/alterados\n- variáveis de ambiente necessárias\n- rota server-side de criação PIX\n- URL pública final do webhook\n- formato exato que devo cadastrar no PiXBrasil\n- comando/teste para validar o webhook\n- como confirmar que a API Key não vazou para o browser\n- como fazer rollback\n- riscos ainda pendentes\n- não declare integração concluída se build/testes falharem.";

const nextPrompt = "Integre PiXBrasil neste projeto Next.js App Router. Use Route Handlers server-side, cookies/DB apenas quando necessário e nunca exponha a API Key. Implemente /api/payments/pix, /api/payments/pix/status e /api/webhooks/pixbrasil. Recalcule o total usando o catálogo/DB server-side. Use Idempotency-Key estável. No webhook, use request.text() para obter rawBody antes do parse, valide X-PiXBrasil-Timestamp e X-PiXBrasil-Signature com HMAC-SHA256 e timingSafeEqual, dedupe por X-PiXBrasil-Delivery e atualize o pedido. Capture attribution em metadata.attribution. Preserve o provider atual como fallback via variável PAYMENT_ORCHESTRATOR. Ao final, devolva a URL pública completa do webhook e um checklist de Vercel envs.";

const phpPrompt = "Integre PiXBrasil neste projeto PHP/WooCommerce sem editar core do WordPress. Crie plugin/integração isolada, mantenha PIXBRASIL_API_KEY apenas no servidor, derive o valor do pedido pelo WooCommerce, use Idempotency-Key baseada no order ID e crie webhook REST próprio para PiXBrasil. Valide HMAC-SHA256 sobre timestamp + '.' + rawBody antes de processar. Deduplicatee delivery IDs, atualize status do pedido somente após payment.succeeded e mantenha logs sem secrets/PII desnecessária. Capture UTMs/click IDs no pedido e encaminhe em metadata.attribution. Ao final, devolva a URL REST pública do webhook e o passo a passo exato de cadastro.";

const auditPrompt = "Audite uma integração PiXBrasil existente. Procure especificamente: API Key exposta ao client, valor de pagamento vindo do browser sem recálculo, ausência de Idempotency-Key, webhook sem raw-body HMAC, comparação de assinatura não constante, ausência de anti-replay/timestamp, ausência de dedupe por delivery ID, fulfillment baseado apenas em redirect/polling, metadata com PII excessiva, grants de Store muito amplos, ausência de fallback/reconciliation e logging de secrets. Corrija tudo que for seguro, execute typecheck/lint/build/tests e devolva achados por severidade.";

export default function AiSetupDocsPage() {
  return (
    <DocsShell
      eyebrow="AI SETUP KITS"
      title="Dê contexto completo à IA que já conhece o seu site."
      description="Os prompts abaixo foram escritos para agentes com acesso ao repositório. Eles instruem a IA a integrar o PiXBrasil sem pedir que você cole API Keys no chat."
    >
      <DocsSection id="universal" title="Prompt Universal — recomendado">
        <CopyBlock label="GPT / Claude / Cursor / Codex / Agent" language="prompt" code={universalPrompt} />
      </DocsSection>

      <DocsSection id="specialized" title="Prompts especializados">
        <div className="space-y-4">
          <CopyBlock label="Next.js / Node.js" language="prompt" code={nextPrompt} />
          <CopyBlock label="PHP / WooCommerce" language="prompt" code={phpPrompt} />
          <CopyBlock label="Auditar integração existente" language="prompt" code={auditPrompt} />
        </div>
      </DocsSection>

      <DocsSection id="workflow" title="Como usar corretamente">
        <DocsGrid>
          <DocsCard title="1. Cole o prompt">Use a IA que já tem acesso ao repositório ou envie o repositório para a sessão de desenvolvimento.</DocsCard>
          <DocsCard title="2. Não cole secrets">Configure PIXBRASIL_API_KEY diretamente no Vercel, VPS, secret manager ou painel do hosting.</DocsCard>
          <DocsCard title="3. Exija testes">A IA deve executar build/typecheck/testes e validar que a key não entrou no bundle client-side.</DocsCard>
          <DocsCard title="4. Pegue a URL">A entrega deve terminar com algo como https://seudominio.com/api/webhooks/pixbrasil.</DocsCard>
        </DocsGrid>
      </DocsSection>

      <DocsSection id="output" title="O que a IA deve devolver">
        <ul className="space-y-2 text-[9px] leading-5 text-[#78918A]">
          <li>• URL pública do webhook.</li>
          <li>• Variáveis de ambiente e onde configurá-las.</li>
          <li>• Store utilizada e estratégia de rollback.</li>
          <li>• Endpoint server-side de criação e status.</li>
          <li>• Prova de validação HMAC e idempotência.</li>
          <li>• Teste do endpoint usando POST /webhook-endpoints/:id/test.</li>
          <li>• Lista de UTMs/click IDs preservados.</li>
          <li>• Pendências operacionais antes de considerar a integração concluída.</li>
        </ul>
      </DocsSection>
    </DocsShell>
  );
}
