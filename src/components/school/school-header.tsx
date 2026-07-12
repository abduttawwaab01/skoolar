'use client';

import Link from 'next/link';
import { SchoolProfile } from '@/lib/school-cache';
import { getSchoolDomain, parseSocialLinks, parseSectionVisibility } from '@/lib/school-utils';
import { Menu, X } from 'lucide-react';
import { useState } from 'react';

export function SchoolHeader({ school }: { school: SchoolProfile }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const domain = getSchoolDomain(school.slug);
  const visibility = parseSectionVisibility(school.sectionVisibility);

  const navItems = [
    { label: 'Home', href: `https://${domain}` },
    ...(visibility.about ? [{ label: 'About', href: `https://${domain}/about` }] : []),
    ...(visibility.admissions ? [{ label: 'Admissions', href: `https://${domain}/admissions` }] : []),
    ...(visibility.entranceExam ? [{ label: 'Entrance Exam', href: `https://${domain}/entrance` }] : []),
    ...(visibility.contact ? [{ label: 'Contact', href: `https://${domain}/contact` }] : []),
  ];

  return (
    <header
      className="sticky top-0 z-50 backdrop-blur-md bg-white/90 border-b"
      style={{ borderColor: 'var(--school-primary-light)' }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href={`https://${domain}`} className="flex items-center gap-3">
            {school.logo ? (
              <img src={school.logo} alt={school.name} className="h-10 w-10 rounded-lg object-cover" />
            ) : (
              <div
                className="h-10 w-10 rounded-lg flex items-center justify-center text-white font-bold text-lg"
                style={{ backgroundColor: 'var(--school-primary)' }}
              >
                {school.name.charAt(0)}
              </div>
            )}
            <span className="font-bold text-lg">{school.name}</span>
          </Link>

          <nav className="hidden md:flex items-center gap-6">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
              >
                {item.label}
              </Link>
            ))}
            <Link
              href="/login"
              className="text-sm font-medium px-4 py-2 rounded-lg text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: 'var(--school-primary)' }}
            >
              Portal Login
            </Link>
          </nav>

          <button
            className="md:hidden p-2"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Toggle menu"
          >
            {menuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {menuOpen && (
        <div className="md:hidden border-t bg-white">
          <div className="px-4 py-4 space-y-3">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="block text-sm font-medium text-gray-700 py-2"
                onClick={() => setMenuOpen(false)}
              >
                {item.label}
              </Link>
            ))}
            <Link
              href="/login"
              className="block text-sm font-medium text-white px-4 py-2 rounded-lg text-center"
              style={{ backgroundColor: 'var(--school-primary)' }}
              onClick={() => setMenuOpen(false)}
            >
              Portal Login
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
