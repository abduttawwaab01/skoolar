'use client';

import { SchoolProfile } from '@/lib/school-cache';
import { SchoolHeader } from './school-header';
import { SchoolFooter } from './school-footer';

const brandColors = (school: SchoolProfile) => ({
  '--school-primary': school.primaryColor,
  '--school-secondary': school.secondaryColor,
  '--school-primary-light': `${school.primaryColor}20`,
  '--school-secondary-light': `${school.secondaryColor}20`,
} as React.CSSProperties);

export function SchoolTemplate({
  school,
  children,
}: {
  school: SchoolProfile;
  children: React.ReactNode;
}) {
  return (
    <div
      className="min-h-screen flex flex-col"
      style={brandColors(school)}
    >
      <SchoolHeader school={school} />
      <main className="flex-1">
        {children}
      </main>
      <SchoolFooter school={school} />

      {school.customCss && (
        <style dangerouslySetInnerHTML={{ __html: school.customCss }} />
      )}
    </div>
  );
}
