'use client';

import { SchoolProfile } from '@/lib/school-cache';

export function SchoolAbout({ school, images }: { school: SchoolProfile; images: string[] }) {
  return (
    <div className="min-h-screen py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-4xl font-bold mb-8">
          {school.aboutTitle || `About ${school.name}`}
        </h1>

        {images.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12">
            {images.map((img, i) => (
              <img
                key={i}
                src={img}
                alt={`${school.name} - Image ${i + 1}`}
                className="rounded-xl object-cover h-64 w-full"
              />
            ))}
          </div>
        )}

        {school.aboutContent ? (
          <div className="prose prose-lg max-w-none">
            <div dangerouslySetInnerHTML={{ __html: school.aboutContent }} />
          </div>
        ) : (
          <div className="text-center py-20 text-gray-500">
            <p>About page content coming soon.</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-16">
          {school.motto && (
            <div className="p-6 rounded-xl bg-gray-50">
              <h3 className="font-semibold mb-2">Our Motto</h3>
              <p className="text-gray-600 italic">{school.motto}</p>
            </div>
          )}
          {school.foundedDate && (
            <div className="p-6 rounded-xl bg-gray-50">
              <h3 className="font-semibold mb-2">Founded</h3>
              <p className="text-gray-600">
                {new Date(school.foundedDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            </div>
          )}
          {school.schoolType && (
            <div className="p-6 rounded-xl bg-gray-50">
              <h3 className="font-semibold mb-2">School Type</h3>
              <p className="text-gray-600 capitalize">{school.schoolType.replace(/_/g, ' ')}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
