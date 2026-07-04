'use client';

import { SchoolProfile } from '@/lib/school-cache';

export function SchoolAdmissions({ school }: { school: SchoolProfile }) {
  return (
    <div className="min-h-screen py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl">
          <h1 className="text-4xl font-bold mb-8">
            {school.admissionsTitle || 'Admissions'}
          </h1>

          {school.admissionsContent ? (
            <div className="prose prose-lg">
              <div dangerouslySetInnerHTML={{ __html: school.admissionsContent }} />
            </div>
          ) : (
            <div className="space-y-6">
              <p className="text-lg text-gray-600">
                Thank you for your interest in {school.name}. We are excited to welcome new students to our community.
              </p>

              <div className="p-6 rounded-xl bg-gray-50 border">
                <h2 className="text-xl font-semibold mb-4">Admissions Process</h2>
                <ol className="space-y-3 list-decimal list-inside text-gray-600">
                  <li>Submit an online application form</li>
                  <li>Provide previous academic records</li>
                  <li>Schedule an entrance assessment/interview</li>
                  <li>Receive admission decision</li>
                  <li>Complete enrollment and fee payment</li>
                </ol>
              </div>

              <div className="p-6 rounded-xl bg-gray-50 border">
                <h2 className="text-xl font-semibold mb-4">Requirements</h2>
                <ul className="space-y-2 list-disc list-inside text-gray-600">
                  <li>Completed application form</li>
                  <li>Previous school reports (last 2 terms)</li>
                  <li>Birth certificate or equivalent</li>
                  <li>Passport photographs (2 copies)</li>
                  <li>Medical/health records</li>
                </ul>
              </div>

              <p className="text-gray-600 mt-8">
                For more information about admissions, please contact us at{' '}
                <strong>{school.contactEmail || school.email || 'the school office'}</strong>.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
