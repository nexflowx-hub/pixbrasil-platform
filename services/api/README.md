# PiXBrasil API

Planned backend: NestJS + TypeScript.

Milestones: health/readiness; auth/account context; merchants/stores; provider registry read model; gateway connections; routing policies; routing engine; PIX payment intents; PixGo adapter; MisticPay adapter; webhook inbox + S2S verification; settlement orchestration; ledger posting through Atlas Financial Core.

Public API direction:
- POST /api/v1/payment-intents
- GET /api/v1/payment-intents/:id
- POST /api/v1/pix/charges
- GET /api/v1/pix/charges/:id
- POST /api/v1/payment-links
- POST /api/v1/webhooks/pixgo
- POST /api/v1/webhooks/misticpay

Business management:
- GET/POST /api/v1/business/stores
- GET /api/v1/business/providers
- GET/POST /api/v1/business/gateway-connections
- GET/POST /api/v1/business/routing-policies
- GET /api/v1/business/routing-decisions

Provider credentials never travel through ordinary GET responses.