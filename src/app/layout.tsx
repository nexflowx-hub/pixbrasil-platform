import type { Metadata, Viewport } from "next";
import { Inter, Caveat } from "next/font/google";
import "./globals.css";
import { PwaRegister } from "@/components/pwa-register";
import { PwaInstallPrompt } from "@/components/pwa-install-prompt";
import { SITE_URL, siteConfig } from "@/config/site";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const caveat = Caveat({
  variable: "--font-caveat",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "PiXBrasil.org — PIX, ativos digitais e liberdade financeira",
    template: "%s | PiXBrasil.org",
  },
  description:
    "Receba via PIX, mantenha seus recursos em ativos digitais e escolha como utilizar ou sacar. Soluções para pessoas e empresas.",
  keywords: [
    "PIX",
    "ativos digitais",
    "fintech brasileira",
    "conta digital",
    "USDT",
    "Liquid",
    "TRON",
    "pagamentos",
    "API PIX",
    "links de pagamento",
  ],
  authors: [{ name: siteConfig.name }],
  creator: "PiXBrasil.org",
  publisher: "PiXBrasil.org",
  alternates: {
    canonical: "/",
    languages: {
      "pt-BR": "/",
      "x-default": "/",
    },
  },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    url: SITE_URL,
    siteName: "PiXBrasil.org",
    title: "PiXBrasil.org — PIX, ativos digitais e liberdade financeira",
    description:
      "Entrada via PIX. Liquidação digital. Controle total. Receba em PIX, mantenha o valor em ativos digitais e tenha liberdade para sacar em BRL ou cripto.",
    images: [
      {
        url: "/images/og-cover.png",
        width: 1200,
        height: 630,
        alt: "PiXBrasil.org — Seu dinheiro sem fronteiras",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "PiXBrasil.org — PIX, ativos digitais e liberdade financeira",
    description:
      "Entrada via PIX. Liquidação digital. Controle total. Seu dinheiro sem fronteiras.",
    images: ["/images/og-cover.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icons/icon.svg", type: "image/svg+xml" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#02090B",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: siteConfig.name,
  alternateName: siteConfig.shortName,
  url: SITE_URL,
  logo: `${SITE_URL}/icons/icon-512.png`,
  slogan: "Seu dinheiro sem fronteiras",
  description:
    "Receba via PIX, mantenha seus recursos em ativos digitais e escolha como utilizar ou sacar. Soluções para pessoas e empresas.",
  areaServed: { "@type": "Country", name: "Brasil" },
  knowsAbout: ["PIX", "Ativos digitais", "Blockchain", "Pagamentos"],
};

const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: siteConfig.name,
  alternateName: siteConfig.shortName,
  url: SITE_URL,
  inLanguage: "pt-BR",
  publisher: {
    "@type": "Organization",
    name: siteConfig.name,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${caveat.variable} font-sans antialiased bg-[#02090B] text-foreground`}
      >
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify([organizationJsonLd, websiteJsonLd]),
          }}
        />
        {children}
        <PwaRegister />
        <PwaInstallPrompt />
      </body>
    </html>
  );
}
