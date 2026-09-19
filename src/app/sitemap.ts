import type { MetadataRoute } from "next";
import { SITE_URL } from "@/config/site";

const PUBLIC_ROUTES = [
  "/","/personal","/business","/pricing","/how-it-works","/support",
  "/docs","/docs/api","/docs/webhooks","/docs/ai-setup","/docs/tracking",
  "/legal/terms","/legal/privacy","/legal/cookies","/legal/risk-disclosure",
  "/legal/regulatory-status","/legal/aml-kyc","/legal/acceptable-use"
];

export default function sitemap(): MetadataRoute.Sitemap {
  return PUBLIC_ROUTES.map((route) => ({
    url: `${SITE_URL}${route === "/" ? "" : route}`,
    lastModified: new Date(),
    changeFrequency: route === "/" ? "weekly" : "monthly",
    priority: route === "/" ? 1 : 0.6
  }));
}
