# PiXBrasil.org — Landing Page

> **Seu dinheiro sem fronteiras.**
> Entrada via PIX. Liquidação digital. Controle total.

Landing page oficial do **PiXBrasil.org**, reproduzindo com fidelidade máxima a maquete visual de referência. Fintech premium + blockchain + identidade brasileira.

![Referência visual](public/images/og-cover.png)

## Stack

- **Next.js 16** (App Router, React 19, Server Components)
- **TypeScript 5** strict
- **Tailwind CSS 4** + CSS Variables (design tokens dark-first)
- **Lucide React** icons
- **next/font** (Inter + Caveat)
- **next/image** com otimização

## Destaques de implementação

- **Device mockups reais em React/CSS** — smartphone e laptop com dashboards vivos (não são imagens), nítidos, responsivos e prontos para evoluir para o produto real
- **Mapa do Brasil digital em SVG** — dot-matrix cartography com nodes dourados pulsantes, mesh de conexões e arcos orbitais animados
- **Ambient background cinematográfico** — gradient mesh, arcos emerald/cyan, partículas, grid e film grain, tudo respeitando `prefers-reduced-motion`
- **Horizonte da Terra** com glow ciano e city lights em CSS puro
- **Escala fluida da cena do hero** por breakpoints (o smartphone nunca cobre o copy)
- **SEO completo** — metadata, OpenGraph, Twitter Card, JSON-LD (Organization + WebSite), sitemap, robots, canonical, hreflang-preparado
- **PWA-ready** — manifest, ícones (any + maskable), apple-touch-icon
- **Security headers** — nosniff, X-Frame-Options, Referrer-Policy, Permissions-Policy

## Estrutura

```
src/
  app/
    layout.tsx        # Fontes, metadata SEO, JSON-LD
    page.tsx          # Composição da landing
    globals.css       # Design tokens + animações + utilities
    sitemap.ts
  components/
    brand/            # Logo, bandeira do Brasil
    marketing/        # header, hero, capability-bar, how-it-works, audiences, trust, footer
    devices/          # phone-mockup, dashboard-mockup, balance-chart, hero-device-scene
    visuals/          # brazil-network (SVG), ambient-background
  components/ui/      # shadcn/ui
public/
  images/             # Assets cinematográficos (Rio, SP, skyline, OG)
  icons/              # PWA icons
```

## Desenvolvimento

```bash
bun install
bun run dev        # http://localhost:3000
bun run lint
```

## Roadmap do produto

A arquitetura de componentes já considera a evolução para o ecossistema completo:

- **Personal (PF)** — conta pessoal, entrada PIX, wallets, ativos, conversão, saída BRL/cripto
- **Business (PJ)** — merchant, stores, API PIX, payment links, checkout, webhooks, analytics, RBAC, settlements

---

**PiXBrasil.org** — Brasil para o mundo. 🇧🇷
