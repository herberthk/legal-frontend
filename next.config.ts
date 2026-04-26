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
};

export default withSerwist(nextConfig);
