const envSiteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();

export const SITE_URL = (envSiteUrl || "https://pixbrasil.org").replace(/\/$/, "");

export const siteConfig = {
  name: "PiXBrasil.org",
  shortName: "PiXBrasil",
  tagline: "Seu dinheiro sem fronteiras",
  description: "Receba via PIX, mantenha seus recursos em ativos digitais e escolha como utilizar ou sacar. Soluções para pessoas e empresas.",
  locale: "pt-BR"
} as const;
