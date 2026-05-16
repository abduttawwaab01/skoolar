import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cloudflare Pages uses edge runtime — do NOT use "standalone"
  // The @opennextjs/cloudflare adapter handles the build output

  typescript: {
    ignoreBuildErrors: false, // Fail build on TypeScript errors
  },
  reactStrictMode: true, // Enable strict mode for better error catching

  // Security headers via middleware
  // Note: HTTPS enforcement is handled by HSTS header in public/_headers (no redirect needed)
  headers: async () => {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains; preload',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), payment=()',
          },
        ],
      },
    ];
  },

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

  // Externalize native Node.js addons to prevent Turbopack bundling errors
  serverExternalPackages: ['@resvg/resvg-js'],

  // Optimize for edge deployment
  experimental: {
    // Enable server actions (supported on Cloudflare via OpenNext)
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
