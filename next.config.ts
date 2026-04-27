import type { NextConfig } from "next";
import { withSerwist } from "@serwist/turbopack";

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
            value: "strict-origin-when-cross-origin",
          },
          {
            // Allows the opener page to retain a reference to the Google auth
            // popup so Firebase can detect window.closed after sign-in.
            // "same-origin-allow-popups" is the recommended value for apps
            // using popup-based OAuth (signInWithPopup).
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin-allow-popups",
          },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self' https://apis.google.com https://*.googleapis.com https://*.firebaseio.com https://*.firebaseapp.com https://*.web.app;",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://apis.google.com https://www.gstatic.com https://*.google-analytics.com https://www.googletagmanager.com;",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;",
              "font-src 'self' https://fonts.gstatic.com;",
              "img-src 'self' data: blob: https://ui-avatars.com https://i.pravatar.cc https://lh3.googleusercontent.com https://www.transparenttextures.com https://*.google-analytics.com https://www.googletagmanager.com;",
              "connect-src 'self' https://apis.google.com https://*.googleapis.com https://*.firebaseio.com https://*.firebaseapp.com https://*.google-analytics.com https://*.google.com https://*.gstatic.com https://www.googletagmanager.com;",
              "frame-src 'self' https://*.firebaseapp.com https://*.web.app;",
              "object-src 'none';",
              "base-uri 'self';",
              "form-action 'self';",
              "frame-ancestors 'none';",
              "upgrade-insecure-requests;",
            ].join(" "),
          },
        ],
      },
      {
        source: "/serwist/sw.js",
        headers: [
          {
            key: "Content-Type",
            value: "application/javascript; charset=utf-8",
          },
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
          {
            // Service workers enforce the CSP of their OWN response when
            // calling fetch() internally. We set a permissive policy here so
            // the SW can reach Google/Firebase origins for the auth passthrough
            // handler in sw.ts. The page-level CSP (above) still protects the
            // actual document context.
            key: "Content-Security-Policy",
            value: "default-src * 'unsafe-inline' 'unsafe-eval'; script-src * 'unsafe-inline' 'unsafe-eval'; connect-src *",
          },
        ],
      },
    ];
  },
};

export default withSerwist(nextConfig);
