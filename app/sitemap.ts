import type { MetadataRoute } from "next";

const SITE_URL = "https://agenthood.flabs.tech";

const routes = [
  { path: "", priority: 1, changeFrequency: "weekly" as const },
  { path: "/academy", priority: 0.8, changeFrequency: "weekly" as const },
  { path: "/adr", priority: 0.7, changeFrequency: "monthly" as const },
  { path: "/docs", priority: 0.9, changeFrequency: "weekly" as const },
  { path: "/getting-started", priority: 0.9, changeFrequency: "monthly" as const },
  { path: "/releases", priority: 0.6, changeFrequency: "weekly" as const },
  { path: "/studio", priority: 0.8, changeFrequency: "monthly" as const },
  { path: "/studio/playground", priority: 0.7, changeFrequency: "monthly" as const },
  { path: "/studio/workspaces", priority: 0.7, changeFrequency: "monthly" as const },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return routes.map((route) => ({
    url: `${SITE_URL}${route.path}`,
    lastModified: now,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));
}
