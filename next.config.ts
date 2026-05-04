import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cloudflare Pages uses edge runtime — do NOT use "standalone"
  // The @opennextjs/cloudflare adapter handles the build output

  typescript: {
    ignoreBuildErrors: false, // Fail build on TypeScript errors
  },
  eslint: {
    ignoreDuringBuilds: true, // Disable ESLint during builds to avoid config issues
  },
  reactStrictMode: true, // Enable strict mode for better error catching

  // Cloudflare Workers have a 100 MB response body limit
  // and individual assets up to 25 MB by default
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cdn.skoolar.org",
      },
      {
        protocol: "https",
        hostname: "*.r2.dev",
      },
      {
        protocol: "https",
        hostname: "*.r2.cloudflarestorage.com",
      },
      // Add other trusted domains as needed (e.g., avatar services)
      // {
      //   protocol: "https",
      //   hostname: "*.gravatar.com",
      // },
    ],
  },

  // Optimize for edge deployment
  experimental: {
    // Enable server actions (supported on Cloudflare via OpenNext)
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
