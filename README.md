# PiXBrasil.org

Frontend público do **PiXBrasil.org**, atualmente em fase de pré-lançamento.

## Estado atual
- Landing pública em Next.js App Router
- Personal e Business apresentados como produtos em desenvolvimento
- Nenhuma operação financeira pública ativa
- Backend, Financial Core, providers e settlement ainda não ligados a este frontend

## Stack
- Next.js 16.3.5 (Active LTS)
- React 19
- TypeScript strict
- Tailwind CSS 4
- Playwright
- Vercel (frontend)

## Quality gates
```bash
npm install
npm run typecheck
npm run lint
npm run build
npm run test:e2e
```

## Segurança
- CSP e security headers
- nenhum formulário financeiro fictício
- PWA cacheia apenas assets públicos
- API, HTML e dados financeiros não são cacheados
- /api/health é o único endpoint local público nesta fase

## Deploy
1. CI verde
2. Vercel Preview
3. auditoria visual/responsiva
4. Lighthouse/console
5. promoção para produção
