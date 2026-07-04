'use client';

import Link from 'next/link';
import { SchoolProfile } from '@/lib/school-cache';
import { getSchoolDomain } from '@/lib/school-utils';
import { ArrowRight, GraduationCap, Users, BookOpen, Award } from 'lucide-react';

export function SchoolLanding({ school }: { school: SchoolProfile }) {
  const domain = getSchoolDomain(school.slug);

  const heroSection = {
    backgroundImage: school.heroImageUrl ? `url(${school.heroImageUrl})` : undefined,
    backgroundColor: school.heroImageUrl ? undefined : school.primaryColor,
  };

  return (
    <div className="min-h-screen">
      <section
        className="relative py-24 md:py-32 bg-cover bg-center"
        style={heroSection}
      >
        <div className="absolute inset-0 bg-black/50" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-6">
            {school.heroTitle || `Welcome to ${school.name}`}
          </h1>
          <p className="text-xl md:text-2xl text-gray-200 mb-8 max-w-3xl mx-auto">
            {school.heroSubtitle || (school.motto ? school.motto : 'Building the future through quality education')}
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link
              href={`https://${domain}/about`}
              className="inline-flex items-center gap-2 px-8 py-3 rounded-lg text-white font-semibold transition-all hover:opacity-90"
              style={{ backgroundColor: 'var(--school-primary)' }}
            >
              Learn More <ArrowRight className="h-5 w-5" />
            </Link>
            <Link
              href={`https://${domain}/admissions`}
              className="inline-flex items-center gap-2 px-8 py-3 rounded-lg bg-white text-gray-900 font-semibold hover:bg-gray-100 transition-colors"
            >
              Apply Now
            </Link>
          </div>
        </div>
      </section>

      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {[
              { icon: GraduationCap, label: 'Students', value: 'Excellence' },
              { icon: Users, label: 'Community', value: 'Together We Grow' },
              { icon: BookOpen, label: 'Curriculum', value: 'Comprehensive' },
              { icon: Award, label: 'Achievement', value: 'Recognition' },
            ].map((item) => (
              <div key={item.label} className="text-center p-6 bg-white rounded-xl shadow-sm">
                <div
                  className="w-12 h-12 rounded-lg flex items-center justify-center mx-auto mb-4"
                  style={{ backgroundColor: 'var(--school-primary-light)', color: 'var(--school-primary)' }}
                >
                  <item.icon className="h-6 w-6" />
                </div>
                <h3 className="font-semibold text-gray-900">{item.label}</h3>
                <p className="text-sm text-gray-600 mt-1">{item.value}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {school.aboutContent && (
        <section className="py-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl font-bold text-center mb-8">
              {school.aboutTitle || `About ${school.name}`}
            </h2>
            <div className="prose prose-lg max-w-4xl mx-auto text-gray-600 text-center">
              <div dangerouslySetInnerHTML={{ __html: school.aboutContent.substring(0, 500) }} />
            </div>
            {school.aboutContent.length > 500 && (
              <div className="text-center mt-6">
                <Link
                  href={`https://${domain}/about`}
                  className="inline-flex items-center gap-2 font-semibold hover:underline"
                  style={{ color: 'var(--school-primary)' }}
                >
                  Read More <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            )}
          </div>
        </section>
      )}

      {school.admissionsContent && (
        <section className="py-20 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-3xl font-bold mb-4">
              {school.admissionsTitle || 'Admissions Open'}
            </h2>
            <p className="text-gray-600 mb-8 max-w-2xl mx-auto">
              Join our community of learners. Applications are now being accepted.
            </p>
            <Link
              href={`https://${domain}/admissions`}
              className="inline-flex items-center gap-2 px-8 py-3 rounded-lg text-white font-semibold transition-all hover:opacity-90"
              style={{ backgroundColor: 'var(--school-primary)' }}
            >
              Apply Now <ArrowRight className="h-5 w-5" />
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}
