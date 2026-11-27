import { spawnSync } from "node:child_process";
import { createSerwistRoute } from "@serwist/turbopack";
// If you are using Next.js versions older than 15.0.0, add the
// `nextConfig` option so that Serwist can configure the service
// worker according to your options. Serwist 10 and newer will
// only support Next.js 15.0.0 and above.
// import nextConfig from "$cwd/next.config.mjs";

// This is optional!
// A revision helps Serwist version a precached page. This
// avoids outdated precached responses being used. Using
// `git rev-parse HEAD` might not the most efficient way
// of determining a revision, however. You may prefer to use
// the hashes of every extra file you precache.
const revision =
  spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf-8" }).stdout ??
  crypto.randomUUID();

export const { dynamic, dynamicParams, revalidate, generateStaticParams, GET } =
  createSerwistRoute({
    additionalPrecacheEntries: [{ url: "/~offline", revision }],
    swSrc: "app/sw.ts",
    // nextConfig,
    // If set to `false`, Serwist will attempt to use `esbuild-wasm`.
    useNativeEsbuild: true,
    esbuildOptions: {
      sourcemap: false,
      define: {
        "process.env.NEXT_PUBLIC_FIREBASE_API_KEY": JSON.stringify(
          process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "",
        ),
        "process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN": JSON.stringify(
          process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "",
        ),
        "process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID": JSON.stringify(
          process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "",
        ),
        "process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET": JSON.stringify(
          process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "",
        ),
        "process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID": JSON.stringify(
          process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "",
        ),
        "process.env.NEXT_PUBLIC_FIREBASE_APP_ID": JSON.stringify(
          process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "",
        ),
        "process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID": JSON.stringify(
          process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID ?? "",
        ),
      },
    },
  });
