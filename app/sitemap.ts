import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL || "https://legal-adviser.vercel.app";

  const routes = [
    { url: "", priority: 1.0, changeFrequency: "daily" },
    { url: "/login", priority: 0.8, changeFrequency: "monthly" },
    { url: "/signup", priority: 0.8, changeFrequency: "monthly" },
    { url: "/privacy", priority: 0.5, changeFrequency: "yearly" },
    { url: "/terms", priority: 0.5, changeFrequency: "yearly" },
    { url: "/cookie", priority: 0.5, changeFrequency: "yearly" },
    { url: "/disclaimer", priority: 0.5, changeFrequency: "yearly" },
  ] as const;

  return routes.map((route) => ({
    url: `${baseUrl}${route.url}`,
    lastModified: new Date(),
    changeFrequency: route.changeFrequency as "daily" | "monthly" | "yearly",
    priority: route.priority,
  }));
}
