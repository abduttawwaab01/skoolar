import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "next-themes";
import { ServiceWorkerRegistration } from "@/components/pwa/service-worker-registration";
import { PreloaderWrapper } from "@/components/preloader/preloader-wrapper";
import { QueryProvider } from "@/components/providers/query-provider";
import { ErrorBoundary } from "@/components/shared/error-boundary";

// NOTE: Environment validation is deferred to runtime (middleware/first request).
// Running validation at module evaluation would break Vercel builds since env vars
// are only injected at runtime, not during the build step.

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#059669",
};

export const metadata: Metadata = {
  title: "Skoolar — Multi-School SaaS Platform",
  description: "Comprehensive school management platform handling academics, finance, attendance, ID cards, report cards, and real-time collaboration across multiple schools.",
  keywords: ["Skoolar", "school management", "education", "SaaS", "multi-tenant", "academics", "report cards"],
  authors: [{ name: "Odebunmi Tawwāb" }],
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { url: "/icon-192.svg", sizes: "192x192", type: "image/svg+xml" },
    ],
    apple: [
      { url: "/icon-192.png", sizes: "192x192" },
      { url: "/icon-512.png", sizes: "512x512" },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Skoolar",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning data-scroll-behavior="smooth">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
          <QueryProvider>
            <PreloaderWrapper>
              <ErrorBoundary>
                {children}
              </ErrorBoundary>
            </PreloaderWrapper>
            <ServiceWorkerRegistration />
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
