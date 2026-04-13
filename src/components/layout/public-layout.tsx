'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { School, Menu, X, BookOpen, GraduationCap, CreditCard, PenLine, Shield, Cookie, Mail, Phone, MapPin, MessageCircle, Facebook, Twitter, Instagram, Linkedin, Youtube, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { AnnouncementTicker } from '@/components/platform/announcement-ticker';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Preloader = require('@/components/preloader/preloader-wrapper').PreloaderWrapper;

interface PlatformSettings {
  id: string;
  siteName: string;
  siteDescription: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  contactAddress: string | null;
  socialLinks: string | null;
  enablePreloader: boolean;
  enableAnnouncements: boolean;
  enableAdverts: boolean;
}

interface PublicLayoutProps {
  children: React.ReactNode;
}

const navLinks = [
  { href: '/blog', label: 'Blog', icon: BookOpen },
  { href: '/stories', label: 'Stories', icon: GraduationCap },
  { href: '/learning-hub', label: 'Learning Hub', icon: MessageCircle },
  { href: '/pricing', label: 'Pricing', icon: CreditCard },
  { href: '/submit-story', label: 'Submit Story', icon: PenLine },
];

const footerLinks = [
  { href: '/blog', label: 'Blog' },
  { href: '/stories', label: 'Stories' },
  { href: '/learning-hub', label: 'Learning Hub' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/submit-story', label: 'Submit Story' },
  { href: '/privacy', label: 'Privacy Policy' },
  { href: '/cookies', label: 'Cookie Policy' },
];

function PublicHeader({ settings, pathname }: { settings: PlatformSettings | null; pathname: string }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const siteName = settings?.siteName || 'Skoolar';

  return (
    <>
      <header className="sticky top-0 z-50 bg-white/70 backdrop-blur-xl border-b border-white/20 shadow-sm transition-all duration-300">
        <div className="max-w-7xl mx-auto px-4 lg:px-8 h-20 flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-600 to-emerald-500 flex items-center justify-center shadow-lg shadow-indigo-200 group-hover:scale-110 group-hover:rotate-6 transition-all duration-500">
              <School className="h-6 w-6 text-white" />
            </div>
            <span className="text-2xl font-bold text-gray-900 tracking-tighter uppercase italic">{siteName}</span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-2 bg-gray-100/50 p-1.5 rounded-2xl backdrop-blur-sm border border-white/40">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = pathname === link.href || pathname.startsWith(link.href + '/');
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all",
                    isActive
                      ? 'bg-white text-indigo-700 shadow-sm'
                      : 'text-gray-500 hover:text-gray-900 hover:bg-white/40'
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {link.label}
                </Link>
              );
            })}
          </nav>

          {/* Desktop CTA */}
          <div className="hidden md:flex items-center gap-4">
            <Link href="/login">
              <Button variant="ghost" size="sm" className="text-gray-900 font-bold text-xs uppercase tracking-widest hover:bg-transparent hover:text-indigo-600 transition-colors">
                Log in
              </Button>
            </Link>
            <Link href="/register">
              <Button size="sm" className="bg-gray-900 hover:bg-indigo-700 text-white shadow-xl shadow-gray-200 rounded-xl px-6 h-11 font-bold text-xs uppercase tracking-widest transition-all hover:scale-105 active:scale-95">
                Register
              </Button>
            </Link>
          </div>

          {/* Mobile Menu */}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild className="md:hidden">
              <Button variant="ghost" size="icon" className="size-9">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72 p-0">
              <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
              <div className="flex flex-col h-full">
                {/* Mobile Header */}
                <div className="flex items-center justify-between px-4 h-16 border-b">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                      <School className="h-4 w-4 text-white" />
                    </div>
                    <span className="font-bold text-gray-900">{siteName}</span>
                  </div>
                  <Button variant="ghost" size="icon" className="size-8" onClick={() => setMobileOpen(false)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                {/* Mobile Nav Links */}
                <nav className="flex-1 px-3 py-4 space-y-1">
                  {navLinks.map((link) => {
                    const Icon = link.icon;
                    const isActive = pathname === link.href || pathname.startsWith(link.href + '/');
                    return (
                      <Link
                        key={link.href}
                        href={link.href}
                        onClick={() => setMobileOpen(false)}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                          isActive
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                        {link.label}
                      </Link>
                    );
                  })}
                  <Separator className="my-3" />
                  <Link
                    href="/privacy"
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50"
                  >
                    <Shield className="h-4 w-4" />
                    Privacy Policy
                  </Link>
                  <Link
                    href="/cookies"
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50"
                  >
                    <Cookie className="h-4 w-4" />
                    Cookie Policy
                  </Link>
                </nav>

                {/* Mobile CTA */}
                <div className="p-4 border-t">
                  <Link href="/login" onClick={() => setMobileOpen(false)}>
                    <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white">
                      Log in
                    </Button>
                  </Link>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </header>
      <AnnouncementTicker />
    </>
  );
}

// ── Configurable Footer Credits ────────────────────────────────────────────
const FOOTER_CREDITS_TEXT = 'SKOOLAR | Odebunmi Tawwāb';

interface SocialLink {
  platform: string;
  url: string;
  icon: React.ElementType;
}

function parseSocialLinks(json: string | null): SocialLink[] {
  if (!json) return [];
  try {
    const links = JSON.parse(json);
    return Object.entries(links).map(([platform, url]) => ({
      platform,
      url: url as string,
      icon: getSocialIcon(platform),
    }));
  } catch {
    return [];
  }
}

function getSocialIcon(platform: string): React.ElementType {
  const icons: Record<string, React.ElementType> = {
    facebook: Facebook,
    twitter: Twitter,
    instagram: Instagram,
    linkedin: Linkedin,
    youtube: Youtube,
  };
  return icons[platform.toLowerCase()] || Facebook;
}

function PublicFooter({ settings }: { settings: PlatformSettings | null }) {
  const siteName = settings?.siteName || 'Skoolar';
  const year = new Date().getFullYear();
  const socialLinks = parseSocialLinks(settings?.socialLinks ?? null);

  return (
    <footer className="bg-white border-t mt-auto">
      {/* Main Footer */}
      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="md:col-span-1">
            <Link href="/" className="flex items-center gap-2.5 mb-4">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                <School className="h-5 w-5 text-white" />
              </div>
              <span className="text-lg font-bold text-gray-900">{siteName}</span>
            </Link>
            <p className="text-sm text-gray-500 leading-relaxed">
              {settings?.siteDescription || 'Empowering education through technology. A comprehensive school management platform for modern schools.'}
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-sm font-semibold text-gray-900 mb-4">Explore</h4>
            <ul className="space-y-2.5">
              {[
                { href: '/blog', label: 'Blog' },
                { href: '/stories', label: 'Stories' },
                { href: '/learning-hub', label: 'Learning Hub' },
                { href: '/pricing', label: 'Pricing' },
                { href: '/submit-story', label: 'Submit Story' },
              ].map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-sm text-gray-500 hover:text-emerald-600 transition-colors">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="text-sm font-semibold text-gray-900 mb-4">Legal</h4>
            <ul className="space-y-2.5">
              {[
                { href: '/privacy', label: 'Privacy Policy' },
                { href: '/cookies', label: 'Cookie Policy' },
              ].map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-sm text-gray-500 hover:text-emerald-600 transition-colors">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="text-sm font-semibold text-gray-900 mb-4">Contact</h4>
            <ul className="space-y-2.5">
              {settings?.contactEmail && (
                <li>
                  <a href={`mailto:${settings.contactEmail}`} className="flex items-center gap-2 text-sm text-gray-500 hover:text-emerald-600 transition-colors">
                    <Mail className="h-3.5 w-3.5 shrink-0" />
                    {settings.contactEmail}
                  </a>
                </li>
              )}
              {settings?.contactPhone && (
                <li>
                  <a href={`tel:${settings.contactPhone}`} className="flex items-center gap-2 text-sm text-gray-500 hover:text-emerald-600 transition-colors">
                    <Phone className="h-3.5 w-3.5 shrink-0" />
                    {settings.contactPhone}
                  </a>
                </li>
              )}
              {settings?.contactAddress && (
                <li className="flex items-start gap-2 text-sm text-gray-500">
                  <MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  {settings.contactAddress}
                </li>
              )}
            </ul>
            
            {/* Social Links */}
            {socialLinks.length > 0 && (
              <div className="mt-4">
                <h4 className="text-sm font-semibold text-gray-900 mb-3">Follow Us</h4>
                <div className="flex gap-3">
                  {socialLinks.map((link) => {
                    const Icon = link.icon;
                    return (
                      <a
                        key={link.platform}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-emerald-100 hover:text-emerald-600 transition-colors"
                        aria-label={`Follow us on ${link.platform}`}
                      >
                        <Icon className="h-4 w-4" />
                      </a>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <Separator />
      <div className="max-w-6xl mx-auto px-4 py-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-gray-400">
          <span>&copy; {year} {siteName}. All rights reserved.</span>
          <span>{FOOTER_CREDITS_TEXT}</span>
        </div>
      </div>
    </footer>
  );
}

export function PublicLayout({ children }: PublicLayoutProps) {
  const pathname = usePathname();
  const [settings, setSettings] = useState<PlatformSettings | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(true);

  // Fetch platform settings
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await fetch('/api/platform/settings');
        const json = await res.json();
        if (json.success) setSettings(json.data);
      } catch {
        // Use defaults
      } finally {
        setSettingsLoading(false);
      }
    };
    fetchSettings();
  }, []);

  // Loading skeleton for header/footer while settings load
  if (settingsLoading) {
    return (
      <div className="min-h-screen flex flex-col bg-gray-50">
        <header className="sticky top-0 z-50 bg-white border-b">
          <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Skeleton className="h-9 w-9 rounded-xl" />
              <Skeleton className="h-6 w-20" />
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="h-8 w-16" />
              <Skeleton className="h-8 w-16" />
              <Skeleton className="h-8 w-20" />
            </div>
          </div>
        </header>
        <div className="flex-1">
          {children}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <PublicHeader settings={settings} pathname={pathname} />
      <main className="flex-1">
        {children}
      </main>
      <PublicFooter settings={settings} />
    </div>
  );
}
