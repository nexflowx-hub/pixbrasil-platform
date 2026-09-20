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
  tagline: "PIX, routing e Wallet BRL em uma única operação",
  description:
    "Infraestrutura financeira brasileira para PIX, routing multi-provider, Wallet BRL, liberações, webhooks e operação Personal e Business.",
  locale: "pt-BR",
  release: "0.6.0",
} as const;
