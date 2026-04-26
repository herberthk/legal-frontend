import type { NextConfig } from "next";
import { withSerwist } from "@serwist/turbopack";

// const withSerwist = withSerwistInit({
//   swSrc: "app/sw.ts",
//   swDest: "public/sw.js",
//   disable: process.env.NODE_ENV === "development",
// });

const nextConfig: NextConfig = {
  /* config options here */
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "ui-avatars.com",
      },
      {
        protocol: "https",
        hostname: "i.pravatar.cc",
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
    ],
  },
  productionBrowserSourceMaps: false,
  reactCompiler: true,
  headers: async () => {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Content-Type-Options",
            value: "nosniff", // Prevents MIME type sniffing, reducing the risk of malicious file uploads.
          },
          {
            key: "X-Frame-Options",
            value: "DENY", // Prevents Clickjacking attacks by disallowing the page to be embedded in an iframe.
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin", // Controls how much referrer information is included with requests, balancing security and functionality.
          },
        ],
      },
      {
        source: "/serwist/sw.js",
        headers: [
          {
            key: "Content-Type",
            value: "application/javascript; charset=utf-8", // Ensures the service worker is interpreted correctly as JavaScript.
          },
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate", // Prevents the browser from caching the service worker, ensuring users always get the latest version.
          },
          {
            key: "Content-Security-Policy",
            value: "default-src 'self'; script-src 'self'", // Restricts the sources from which scripts can be loaded, protecting against XSS attacks.
          },
        ],
      },
    ];
  },
};

export default withSerwist(nextConfig);
