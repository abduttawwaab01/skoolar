import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  trailingSlash: false,

  typescript: {
    ignoreBuildErrors: false,
  },
  reactStrictMode: true,

  serverExternalPackages: [
    '@prisma/client',
    '@prisma/adapter-neon',
    'bcryptjs',
    'sharp',
    'pdfkit',
    'adm-zip',
    'qrcode',
  ],

  transpilePackages: [
    '@mdxeditor/editor',
    'react-syntax-highlighter',
    'recharts',
  ],

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
    ],
  },

  turbopack: {
    root: '.',
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },

  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: process.env.ALLOWED_ORIGIN || "*" },
          { key: "Access-Control-Allow-Methods", value: "GET, POST, PUT, DELETE, OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Content-Type, Authorization" },
          { key: "Access-Control-Allow-Credentials", value: "true" },
        ],
      },
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
