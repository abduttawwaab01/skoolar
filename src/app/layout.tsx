import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Noto_Naskh_Arabic } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "next-themes";
import { ServiceWorkerRegistration } from "@/components/pwa/service-worker-registration";
import { PreloaderWrapper } from "@/components/preloader/preloader-wrapper";
import { QueryProvider } from "@/components/providers/query-provider";
import { LanguageProvider } from "@/components/providers/language-provider";
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

const notoNaskhArabic = Noto_Naskh_Arabic({
  variable: "--font-noto-arabic",
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#0E5D52" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

export const metadata: Metadata = {
  title: "Skoolar — Multi-School SaaS Platform",
  description: "Comprehensive school management platform handling academics, finance, attendance, ID cards, report cards, and real-time collaboration across multiple schools.",
  keywords: ["Skoolar", "school management", "education", "SaaS", "multi-tenant", "academics", "report cards"],
  authors: [{ name: "Odebunmi Tawwāb" }],
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/apple-icon-180.png", sizes: "180x180", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192" },
      { url: "/icon-512.png", sizes: "512x512" },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Skoolar",
  },
  formatDetection: {
    telephone: false,
    email: false,
    address: false,
  },
  other: {
    "apple-touch-startup-image": "/splash/apple-splash.png",
    "msapplication-TileColor": "#0E5D52",
    "msapplication-TileImage": "/icon-192.png",
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
        className={`${geistSans.variable} ${geistMono.variable} ${notoNaskhArabic.variable} antialiased bg-background text-foreground touch-manipulation`}
      >
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
          <LanguageProvider>
            <QueryProvider>
              <PreloaderWrapper>
                <ErrorBoundary>
                  {children}
                </ErrorBoundary>
              </PreloaderWrapper>
              <ServiceWorkerRegistration />
            </QueryProvider>
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
