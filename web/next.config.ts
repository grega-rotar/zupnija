import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Runs as a long-lived Node server in Docker on t4a (infra/compose.yml).
  output: "standalone",
  // The monorepo root is one level up; keeps Turbopack from scanning $HOME.
  turbopack: { root: path.join(__dirname, "..") },
  images: {
    loader: "custom",
    loaderFile: "./src/sanity/image-loader.ts",
    deviceSizes: [360, 414, 640, 768, 1024, 1280, 1536, 1920],
    imageSizes: [96, 160, 240, 320, 480],
  },
  // Slovenian slugs contain no diacritics, but keep URLs case-sensitive and clean.
  trailingSlash: false,
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
