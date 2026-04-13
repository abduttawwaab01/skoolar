'use client';

import React, { useState, useEffect } from 'react';
import { Shield } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { PublicLayout } from '@/components/layout/public-layout';
import { handleSilentError } from '@/lib/error-handler';

export default function PrivacyPage() {
  const [privacyContent, setPrivacyContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<any>(null);

  useEffect(() => {
    const fetchPrivacy = async () => {
      try {
        const res = await fetch('/api/platform/privacy');
        const json = await res.json();
        if (json.success) setPrivacyContent(json.data?.privacyPolicy || '');
      } catch { /* */ } finally { setLoading(false); }
    };
    const fetchSettings = async () => {
      try {
        const res = await fetch('/api/platform/settings');
        const json = await res.json();
        if (json.success) setSettings(json.data);
      } catch { /* */ }
    };
    fetchPrivacy();
    fetchSettings();
  }, []);

  const defaultPrivacy = `<h2>Privacy Policy for ${settings?.siteName || 'Skoolar'}</h2>
<p><em>Last updated: ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</em></p>

<h3>1. Introduction</h3>
<p>Welcome to ${settings?.siteName || 'Skoolar'}. We are committed to protecting your privacy and ensuring the security of your personal information. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit our platform, including our website, mobile applications, and related services (collectively, the "Service"). Please read this policy carefully. If you do not agree with the terms of this Privacy Policy, please do not access the Service.</p>

<h3>2. Information We Collect</h3>
<p>We may collect information about you in a variety of ways. The information we may collect on the Service includes:</p>
<p><strong>Personal Data:</strong> Personally identifiable information, such as your name, shipping address, email address, and telephone number, and other information that you voluntarily give to us when you register with the Service, place an order, subscribe to our newsletter, or otherwise contact us.</p>
<p><strong>Derivative Data:</strong> Information our servers automatically collect when you access the Service, such as your IP address, your browser type, your operating system, your access times, and the pages you have viewed directly before and after accessing the Service.</p>
<p><strong>Financial Data:</strong> Financial information related to your payment methods, including credit card numbers and bank account information, is collected when you purchase our products or services.</p>
<p><strong>Student Data:</strong> Information related to students, including academic records, attendance data, grades, health records, and behavioral reports. This data is collected and managed by authorized school administrators and teachers.</p>

<h3>3. How We Use Your Information</h3>
<p>We use the information we collect about you for the following purposes:</p>
<ul>
<li>To create and manage your account on the platform</li>
<li>To process and manage school-related operations</li>
<li>To provide, maintain, and improve our educational services</li>
<li>To send you important updates about the platform</li>
<li>To respond to your inquiries and support requests</li>
<li>To monitor and analyze usage patterns and trends</li>
<li>To protect against unauthorized access and legal liability</li>
<li>To comply with applicable laws and regulations</li>
</ul>

<h3>4. Data Sharing and Disclosure</h3>
<p>We do not sell, trade, or rent your personal identification information to others. We may share generic aggregated demographic information not linked to any personal identification information with our business partners and advertisers for the purposes outlined above. We may share your information with:</p>
<ul>
<li>School administrators within your school for academic management purposes</li>
<li>Service providers who assist us in operating our platform</li>
<li>Law enforcement agencies when required by law</li>
<li>Third parties with your explicit consent</li>
</ul>

<h3>5. Data Security</h3>
<p>We use administrative, technical, and physical security measures to help protect your personal information, including encryption, access controls, and secure data storage. While we have taken reasonable steps to secure the personal information you provide to us, please be aware that despite our efforts, no security measures are perfect or impenetrable, and any method of transmitting data over the internet cannot be guaranteed against any interception or other types of misuse.</p>

<h3>6. Children&apos;s Privacy</h3>
<p>Our Service is designed for educational institutions and may collect information from minors. We take special precautions to protect children&apos;s information. We ensure that data collection from minors is done with appropriate parental consent and oversight through school administration. Parents and guardians may review, modify, or delete their child&apos;s information by contacting us.</p>

<h3>7. Your Rights</h3>
<p>You have the right to access, update, or delete your personal information at any time. You can manage your account settings through your dashboard or contact our support team. If you wish to have your personal data deleted, please contact us and we will respond to your request within 30 days.</p>

<h3>8. Changes to This Policy</h3>
<p>We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Last Updated" date. You are advised to review this Privacy Policy periodically for any changes.</p>

<h3>9. Contact Us</h3>
<p>If you have any questions about this Privacy Policy, please contact us at:</p>
<p><strong>Email:</strong> ${settings?.contactEmail || 'privacy@skoolar.com'}</p>
<p><strong>Phone:</strong> ${settings?.contactPhone || 'N/A'}</p>
<p><strong>Address:</strong> ${settings?.contactAddress || 'N/A'}</p>`;

  const content = privacyContent || defaultPrivacy;

  return (
    <PublicLayout>
      {/* Hero Banner */}
      <div className="bg-gradient-to-br from-emerald-600 to-teal-700 text-white py-12 px-4">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <Shield className="h-8 w-8" />
          <div>
            <h1 className="text-3xl font-bold">Privacy Policy</h1>
            <p className="text-emerald-100">How we protect and handle your data</p>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-8 w-1/2" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        ) : (
          <div
            className="prose prose-lg max-w-none prose-headings:text-gray-900 prose-p:text-gray-700 prose-a:text-emerald-600"
            dangerouslySetInnerHTML={{ __html: content }}
          />
        )}
      </div>
    </PublicLayout>
  );
}
