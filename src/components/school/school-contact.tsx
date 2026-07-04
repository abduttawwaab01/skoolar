'use client';

import { SchoolProfile } from '@/lib/school-cache';
import { Mail, Phone, MapPin, Send } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

export function SchoolContact({ school }: { school: SchoolProfile }) {
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    const form = e.currentTarget;
    const data = new FormData(form);

    try {
      const res = await fetch('/api/public/school-contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolId: school.id,
          name: data.get('name'),
          email: data.get('email'),
          phone: data.get('phone'),
          message: data.get('message'),
        }),
      });

      if (res.ok) {
        toast.success('Message sent successfully!');
        form.reset();
      } else {
        toast.error('Failed to send message. Please try again.');
      }
    } catch {
      toast.error('An error occurred. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-4xl font-bold mb-8">Contact Us</h1>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          <div>
            <div className="space-y-6">
              {(school.contactEmail || school.email) && (
                <div className="flex items-start gap-4">
                  <Mail className="h-6 w-6 mt-1" style={{ color: 'var(--school-primary)' }} />
                  <div>
                    <h3 className="font-semibold">Email</h3>
                    <p className="text-gray-600">{school.contactEmail || school.email}</p>
                  </div>
                </div>
              )}
              {(school.contactPhone || school.phone) && (
                <div className="flex items-start gap-4">
                  <Phone className="h-6 w-6 mt-1" style={{ color: 'var(--school-primary)' }} />
                  <div>
                    <h3 className="font-semibold">Phone</h3>
                    <p className="text-gray-600">{school.contactPhone || school.phone}</p>
                  </div>
                </div>
              )}
              {(school.contactAddress || school.address) && (
                <div className="flex items-start gap-4">
                  <MapPin className="h-6 w-6 mt-1" style={{ color: 'var(--school-primary)' }} />
                  <div>
                    <h3 className="font-semibold">Address</h3>
                    <p className="text-gray-600">{school.contactAddress || school.address}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  name="name"
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:outline-none"
                  style={{ focusRingColor: 'var(--school-primary)' }}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  name="email"
                  type="email"
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone (optional)</label>
                <input
                  name="phone"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
                <textarea
                  name="message"
                  required
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:outline-none resize-none"
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg text-white font-semibold transition-all hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: 'var(--school-primary)' }}
              >
                {submitting ? 'Sending...' : 'Send Message'}
                <Send className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
