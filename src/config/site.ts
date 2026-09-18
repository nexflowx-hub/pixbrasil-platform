const DEFAULT_SITE_URL = "https://pixbrasil.org";

export function normalizeSiteUrl(value?: string): string {
  const raw = value?.trim();

  if (!raw) {
    return DEFAULT_SITE_URL;
  }

  const candidate = /^[a-zA-Z][a-zA-Z\d+.-]*:\/\//.test(raw)
    ? raw
    : `https://${raw}`;

  try {
    const url = new URL(candidate);

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return DEFAULT_SITE_URL;
    }

    return url.origin;
  } catch {
    return DEFAULT_SITE_URL;
  }
}

export const SITE_URL = normalizeSiteUrl(
  process.env.NEXT_PUBLIC_SITE_URL
);

export const siteConfig = {
  name: "PiXBrasil.org",
  shortName: "PiXBrasil",
  tagline: "Seu dinheiro sem fronteiras",
  description:
    "Receba via PIX, mantenha seus recursos em ativos digitais e escolha como utilizar ou sacar. Soluções para pessoas e empresas.",
  locale: "pt-BR",
} as const;
