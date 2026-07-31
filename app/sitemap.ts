import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/siteUrl";

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = getSiteUrl();
  const now = new Date();
  const entries: Array<{ path: string; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"]; priority: number }> = [
    { path: "/", changeFrequency: "daily", priority: 1 },
    { path: "/deals", changeFrequency: "hourly", priority: 0.9 },
    { path: "/guide/return-checklist", changeFrequency: "monthly", priority: 0.4 },
    { path: "/guide/safe-categories", changeFrequency: "monthly", priority: 0.4 },
    { path: "/disclosure", changeFrequency: "yearly", priority: 0.2 },
    { path: "/picks/novatech-s1-window-cleaner", changeFrequency: "weekly", priority: 0.8 }
  ];

  return entries.map((entry) => ({
    url: `${siteUrl}${entry.path}`,
    lastModified: now,
    changeFrequency: entry.changeFrequency,
    priority: entry.priority
  }));
}
