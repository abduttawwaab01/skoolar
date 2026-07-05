'use client';

import { useState, useMemo } from 'react';
import { SchoolProfile } from '@/lib/school-cache';
import { parseAboutImages, parseSectionVisibility, buildPreviewProfile } from '@/lib/school-utils';
import { SchoolLanding } from '@/components/school/school-landing';
import { SchoolAbout } from '@/components/school/school-about';
import { SchoolAdmissions } from '@/components/school/school-admissions';
import { SchoolContact } from '@/components/school/school-contact';
import { Monitor, Tablet, Smartphone } from 'lucide-react';

type PreviewPage = 'home' | 'about' | 'admissions' | 'contact';
type Device = 'desktop' | 'tablet' | 'mobile';

interface SchoolWebsitePreviewProps {
  form: Record<string, any>;
  slug: string;
}

const deviceWidths: Record<Device, string> = {
  desktop: 'w-full',
  tablet: 'max-w-[768px]',
  mobile: 'max-w-[375px]',
};

export function SchoolWebsitePreview({ form, slug }: SchoolWebsitePreviewProps) {
  const [page, setPage] = useState<PreviewPage>('home');
  const [device, setDevice] = useState<Device>('desktop');

  const profile = useMemo(() => buildPreviewProfile(form, slug) as SchoolProfile, [form, slug]);

  const visibility = parseSectionVisibility(profile.sectionVisibility);
  const images = parseAboutImages(profile.aboutImages);

  const brandColors = {
    '--school-primary': profile.primaryColor,
    '--school-secondary': profile.secondaryColor,
    '--school-primary-light': `${profile.primaryColor}20`,
    '--school-secondary-light': `${profile.secondaryColor}20`,
  } as React.CSSProperties;

  const pages: Array<{ key: PreviewPage; label: string }> = [
    { key: 'home', label: 'Home' },
    { key: 'about', label: 'About' },
    { key: 'admissions', label: 'Admissions' },
    { key: 'contact', label: 'Contact' },
  ];

  return (
    <div className="border rounded-lg bg-gray-100 overflow-hidden">
      <div className="flex items-center justify-between p-2 bg-white border-b">
        <div className="flex items-center gap-1">
          {pages.map(p => (
            <button
              key={p.key}
              onClick={() => setPage(p.key)}
              className={`px-3 py-1 text-xs rounded-md font-medium transition-colors ${
                page === p.key ? 'bg-emerald-100 text-emerald-700' : 'text-gray-500 hover:bg-gray-100'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          {([['desktop', Monitor], ['tablet', Tablet], ['mobile', Smartphone]] as const).map(([d, Icon]) => (
            <button
              key={d}
              onClick={() => setDevice(d)}
              className={`p-1.5 rounded-md transition-colors ${
                device === d ? 'bg-gray-200 text-gray-700' : 'text-gray-400 hover:text-gray-600'
              }`}
              title={d.charAt(0).toUpperCase() + d.slice(1)}
            >
              <Icon className="h-3.5 w-3.5" />
            </button>
          ))}
        </div>
      </div>

      <div className="flex justify-center p-4">
        <div
          className={`${deviceWidths[device]} bg-white rounded-lg shadow-sm overflow-hidden transition-all`}
          style={brandColors}
        >
          {!visibility.hero && !visibility.about && !visibility.admissions && !visibility.contact && !visibility.featureCards && (
            <div className="flex items-center justify-center h-32 text-gray-400 text-sm">
              All sections are hidden. Enable them in the Section Visibility tab.
            </div>
          )}

          {page === 'home' && <SchoolLanding school={profile} />}
          {page === 'about' && visibility.about && <SchoolAbout school={profile} images={images} />}
          {page === 'admissions' && visibility.admissions && <SchoolAdmissions school={profile} />}
          {page === 'contact' && visibility.contact && <SchoolContact school={profile} />}

          {page === 'home' && !visibility.hero && !visibility.featureCards && !visibility.about && !visibility.admissions && (
            <div className="text-center py-12 text-gray-400">All home page sections are hidden.</div>
          )}
        </div>
      </div>
    </div>
  );
}
