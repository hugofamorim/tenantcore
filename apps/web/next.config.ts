import type { NextConfig } from "next";

const browserTests = process.env.TENANTCORE_BROWSER_TESTS === "1";

const nextConfig: NextConfig = {
  distDir: browserTests ? ".next-e2e" : ".next",
  devIndicators: browserTests ? false : undefined,
  typescript: {
    tsconfigPath: browserTests ? "tsconfig.e2e.json" : "tsconfig.json",
  },
  async headers() {
    return ["/verify-email", "/reset-password", "/invitations/accept"].map(
      (source) => ({
        source,
        headers: [
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "Cache-Control", value: "no-store" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      }),
    );
  },
  async rewrites() {
    const apiUrl = process.env.API_URL ?? "http://localhost:3001";
    return [
      { source: "/api/auth/:path*", destination: `${apiUrl}/auth/:path*` },
      {
        source: "/api/organizations/:path*",
        destination: `${apiUrl}/organizations/:path*`,
      },
      {
        source: "/api/invitations/:path*",
        destination: `${apiUrl}/invitations/:path*`,
      },
    ];
  },
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
