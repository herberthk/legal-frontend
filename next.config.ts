// import type { NextConfig } from "next";
// import withSerwistInit from "@serwist/next";

// const withSerwist = withSerwistInit({
//   swSrc: "app/sw.ts",
//   swDest: "public/sw.js",
//   disable: process.env.NODE_ENV === "development",
// });

// const nextConfig: NextConfig = {
//   /* config options here */
//   images: {
//     remotePatterns: [
//       {
//         protocol: "https",
//         hostname: "ui-avatars.com",
//       },
//       {
//         protocol: "https",
//         hostname: "i.pravatar.cc",
//       },
//       {
//         protocol: "https",
//         hostname: "lh3.googleusercontent.com",
//       },
//     ],
//   },
// };

// export default withSerwist(nextConfig);

import {
  PHASE_DEVELOPMENT_SERVER,
  PHASE_PRODUCTION_BUILD,
} from "next/constants";
// import { withSerwist } from "@serwist/next";
import { spawnSync } from "node:child_process";
import type { NextConfig } from "next";

/** @type {(phase: string, defaultConfig: import("next").NextConfig) => Promise<import("next").NextConfig>} */
const config = async (phase: string) => {
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
  };

  if (phase === PHASE_DEVELOPMENT_SERVER || phase === PHASE_PRODUCTION_BUILD) {
    // This is optional!
    // A revision helps Serwist version a precached page. This
    // avoids outdated precached responses being used. Using
    // `git rev-parse HEAD` might not the most efficient way
    // of determining a revision, however. You may prefer to use
    // the hashes of every extra file you precache.
    const revision =
      spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf-8" }).stdout ??
      crypto.randomUUID();

    const withSerwist = (await import("@serwist/next")).default({
      additionalPrecacheEntries: [{ url: "/~offline", revision }],
      // Note: This is only an example. If you use Pages Router,
      // use something else that works, such as "service-worker/index.ts".
      swSrc: "app/sw.ts",
      swDest: "public/sw.js",
    });
    return withSerwist(nextConfig);
  }

  return nextConfig;
};

export default config;
