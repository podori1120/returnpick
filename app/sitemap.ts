import type { MetadataRoute } from "next";
import { categoryOptions } from "@/lib/category";
import { listProducts } from "@/lib/dataStore";
import { isPublicDealReady } from "@/lib/publicDeal";
import { searchIntentLandings } from "@/lib/searchLandings";
import { getSiteUrl } from "@/lib/siteUrl";

export const revalidate = 300;

function toLastModified(value: string | null | undefined, fallback: Date) {
  if (!value) return fallback;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

type SitemapEntry = {
  path: string;
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
  priority: number;
  lastModified?: Date;
};

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = getSiteUrl();
  const now = new Date();
  const entries: SitemapEntry[] = [
    { path: "/", changeFrequency: "daily", priority: 1 },
    { path: "/deals", changeFrequency: "hourly", priority: 0.9 },
    { path: "/picks", changeFrequency: "daily", priority: 0.82 },
    { path: "/guide/return-checklist", changeFrequency: "monthly", priority: 0.4 },
    { path: "/guide/safe-categories", changeFrequency: "monthly", priority: 0.4 },
    { path: "/disclosure", changeFrequency: "yearly", priority: 0.2 },
    { path: "/picks/novatech-s1-window-cleaner", changeFrequency: "weekly", priority: 0.8 }
  ];
  const categoryEntries: SitemapEntry[] = categoryOptions.map((category) => ({
    path: `/deals/category/${category.value}`,
    changeFrequency: "daily" as const,
    priority: 0.75
  }));
  const searchIntentEntries: SitemapEntry[] = searchIntentLandings.map((landing) => ({
    path: `/guide/search/${landing.slug}`,
    changeFrequency: "weekly" as const,
    priority: 0.68
  }));

  let productEntries: SitemapEntry[] = [];

  try {
    const products = await listProducts({ published: true });
    productEntries = products.filter(isPublicDealReady).map((product) => ({
      path: `/deals/${product.id}`,
      changeFrequency: "hourly",
      priority: 0.85,
      lastModified: toLastModified(product.last_observed_at ?? product.updated_at, now)
    }));
  } catch {
    // Keep the base sitemap available during a temporary data-store outage.
  }

  return [...entries, ...categoryEntries, ...searchIntentEntries, ...productEntries].map((entry) => ({
    url: `${siteUrl}${entry.path}`,
    ...(entry.lastModified ? { lastModified: entry.lastModified } : {}),
    changeFrequency: entry.changeFrequency,
    priority: entry.priority
  }));
}
