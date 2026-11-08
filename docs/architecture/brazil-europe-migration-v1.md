# PiXBrasil.org — gateway Brasil + expansão Europa

Data: 8 de novembro de 2026. Estado: direção de implementação; sem alteração de produção neste PR.

## Produto e posicionamento

PiXBrasil.org é o produto principal. A marca conserva o foco de origem no Brasil/PIX e apresenta a Europa como expansão do gateway. Proposta editorial: **Do PIX no Brasil aos pagamentos na Europa.**

A campanha de expansão é um evento de produto: novos métodos, packs e integração para vendedores. Data, preços publicados e disponibilidade real precisam de corresponder à homologação. Não anunciar países, métodos ou SLA apenas por existirem num catálogo planeado.

## Decisão de engenharia

Evoluir este monorepo. Manter NestJS, PostgreSQL e Redis do PiXBrasil como base; adaptar a experiência Stripe/MB WAY/Multibanco/Bizum do XPAYMENTS como provider adapter. Não copiar o backend Express inteiro nem criar um segundo livro financeiro. Não reconstruir de raiz componentes já presentes.

White/Black/Gold são condições comerciais versionadas. A referência Black-xxx é comercial, não uma conta no parceiro. A identificação manual externa tem estado e evidência administrativa. Os preços detalhados ficam no catálogo de trabalho, sem publicação automática neste repositório público.

## Alvo de alojamento

Todos os componentes de aplicação na VPS AtlasHub, em containers separados:
- pixbrasil.org / www.pixbrasil.org: site e portal Next.js;
- admin.pixbrasil.org: Admin Next.js;
- api.pixbrasil.org: NestJS;
- Redis privado e workers;
- Caddy como edge/TLS, respeitando serviços e portas existentes.

O repositório atual já tem API/Redis Compose e Caddy para api.pixbrasil.org. Ainda não possui, nessa configuração, os containers de site/Admin. As bases de dados atuais não serão movidas implicitamente: qualquer migração de dados exige inventário, backup, ensaio e reconciliação. Confirmar onde está o PostgreSQL antes de decidir se permanece gerido ou muda para a VPS.

## Fase 0 — localizar e reconciliar

Executar o inventário em cada VPS autorizada. Encontrar checkout/release e comparar com o GitHub. Não usar o deploy-api-prod.sh para descobrir o ambiente: esse script altera main, imagem e container.

Recolher: host, caminho, branch/SHA, quantidade de alterações locais, containers/imagens/estado, portas, rede edge, existência de configurações, implantação de frontend e backend, destino efetivo de dados, backups e responsável. Nunca publicar tokens, URLs de banco, .env, cookies, chaves, logs brutos ou remotes com credenciais.

O inventário automatizado é limitado a profundidade quatro em /opt, /srv, /root e /home; ausência de resultado não prova inexistência. Complementar com locais de instalação conhecidos.

## Sequência de implementação

1. Inventário e manifesto source/runtime.
2. Preview isolada no mesmo repositório, base de testes separada.
3. Contrato monetário único, ledger e preço do vendedor separados de custo interno.
4. Adaptador Stripe no motor comum e webhooks verificados.
5. Generalizar PIX/BRL para método/moeda/país, preservando isolamento e reconciliação.
6. Contratos de serviço, packs, setup/reservas e estados de onboarding.
7. Calendários de dias úteis e saídas em Europe/Lisbon; política padrão e Instant distintas.
8. Site de expansão, dashboard, CRM mínimo, páginas/links e atendimento.
9. Ensaio de produção, plano de rollback e ativação controlada de serviços homologados.

## Gateways e fronteiras

API direta, terminal e checkout devem chamar o mesmo motor. Cartões usam tokenização/SDK do provedor: PAN/CVV não entram na nossa API. Credenciais de provedor ficam no backend. Não herdar o handler de webhook Stripe antigo sem autenticação criptográfica.

Moeda em unidades menores ou representação decimal exata, validada por ativo. Não reutilizar amount ambiguamente em euros e cêntimos. Não substituir recibo de pagamento por prova de disponibilidade de fundos.

## Gates de entrega

- Deploy reproduzível e rollback por imagem/release identificada.
- Health/readiness, logs sem segredos e monitorização de callbacks.
- Isolamento vendedor/loja/ambiente; idempotência e concorrência testadas.
- Webhook com assinatura/validação apropriada, vínculo ao provider account original e reconciliação.
- Ledger balanceado, reservas de onboarding separadas, payout reservado atomicamente.
- Nenhum mock silencioso no ambiente live.
- Fluxos Brasil e Europa testados separadamente.
- Calendário e contrato efetivo preservados por transação.
- Zero alteração às operações existentes antes da homologação do novo fluxo.

## Escopo deste PR

Documentação de direção e inventário somente de leitura. Não publica preços, não muda DNS, containers, banco ou landing, e não ativa cobranças. Próximo passo dependente de ambiente: retorno do inventário AtlasHub.
