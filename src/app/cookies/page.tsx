'use client';

import React, { useState, useEffect } from 'react';
import { Cookie } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { PublicLayout } from '@/components/layout/public-layout';
import { handleSilentError } from '@/lib/error-handler';

export default function CookiesPage() {
  const [cookieContent, setCookieContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<any>(null);

  useEffect(() => {
    const fetchPrivacy = async () => {
      try {
        const res = await fetch('/api/platform/privacy');
        const json = await res.json();
        if (json.success) setCookieContent(json.data?.cookiePolicy || '');
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

  const defaultCookies = `<h2>Cookie Policy for ${settings?.siteName || 'Skoolar'}</h2>
<p><em>Last updated: ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</em></p>

<h3>1. What Are Cookies?</h3>
<p>Cookies are small text files that are placed on your computer or mobile device by websites you visit. They are widely used to make websites work more efficiently, to provide a better browsing experience, and to supply information to the owners of the site. Cookies allow websites to recognize your device and remember information about your visit, such as your preferred language and other settings.</p>

<h3>2. How We Use Cookies</h3>
<p>${settings?.siteName || 'Skoolar'} uses cookies and similar tracking technologies to track activity on our Service and hold certain information. Below is a comprehensive list of the types of cookies we use and their purposes:</p>

<h4>Essential Cookies</h4>
<p>These cookies are strictly necessary for the operation of our platform and cannot be disabled. They are typically set in response to actions you take, such as setting your privacy preferences, logging in, or filling in forms. You can set your browser to block or alert you about these cookies, but some parts of the Service may not work as a result.</p>
<ul>
<li><strong>Session Cookies:</strong> Used to maintain your session and keep you logged in while navigating the platform.</li>
<li><strong>Security Cookies:</strong> Used for authentication and security purposes to protect against cross-site request forgery.</li>
<li><strong>Preference Cookies:</strong> Used to remember your settings and preferences, such as language and theme selections.</li>
</ul>

<h4>Performance and Analytics Cookies</h4>
<p>These cookies allow us to count visits and traffic sources so we can measure and improve the performance of our Service. They help us to know which pages are the most and least popular and see how visitors move around the platform.</p>
<ul>
<li><strong>Google Analytics:</strong> We use Google Analytics to understand how visitors interact with our website. This helps us improve the user experience and provide better content.</li>
<li><strong>Platform Analytics:</strong> Internal analytics to track feature usage, performance metrics, and user engagement.</li>
</ul>

<h4>Functionality Cookies</h4>
<p>These cookies enable the website to provide enhanced functionality and personalization. They may be set by us or by third-party providers whose services we have added to our pages.</p>
<ul>
<li><strong>Authentication Cookies:</strong> Remember your login state across sessions.</li>
<li><strong>UI State Cookies:</strong> Remember your dashboard layout, sidebar state, and other UI preferences.</li>
</ul>

<h4>Targeting/Advertising Cookies</h4>
<p>These cookies may be set through our site by our advertising partners. They may be used by those companies to build a profile of your interests and show you relevant adverts on other sites. They do not store directly personal information but are based on uniquely identifying your browser and internet device.</p>

<h3>3. Third-Party Cookies</h3>
<p>In addition to our own cookies, we may use various third-party cookies to report usage statistics of the Service, deliver advertisements, and track user engagement. Third-party cookies include those from analytics services, advertising networks, and social media platforms.</p>

<h3>4. Managing Your Cookies</h3>
<p>You have the right to decide whether to accept or reject cookies. You can exercise your cookie rights by setting your preferences in the Cookie Consent Manager that appears when you first visit our platform. You can also set or amend your web browser controls to accept or refuse cookies.</p>
<p>Please note that if you choose to reject cookies, you may still use our Service, though your access to some functionality and areas may be restricted. Most web browsers allow some control of cookies through the browser settings. To find out more about cookies, including how to see what cookies have been set and how to manage and delete them, visit www.allaboutcookies.org.</p>

<h3>5. Updates to This Policy</h3>
<p>We may update this Cookie Policy from time to time to reflect changes in technology, legislation, or our data collection practices. We will notify you of any material changes by posting the updated policy on this page and updating the "Last Updated" date. We encourage you to review this Cookie Policy periodically to stay informed about our use of cookies.</p>

<h3>6. Contact Us</h3>
<p>If you have any questions about our use of cookies or this Cookie Policy, please contact us at:</p>
<p><strong>Email:</strong> ${settings?.contactEmail || 'privacy@skoolar.com'}</p>
<p><strong>Phone:</strong> ${settings?.contactPhone || 'N/A'}</p>`;

  const content = cookieContent || defaultCookies;

  return (
    <PublicLayout>
      {/* Hero Banner */}
      <div className="bg-gradient-to-br from-amber-500 to-orange-600 text-white py-12 px-4">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <Cookie className="h-8 w-8" />
          <div>
            <h1 className="text-3xl font-bold">Cookie Policy</h1>
            <p className="text-amber-100">How we use cookies on our platform</p>
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
            className="prose prose-lg max-w-none prose-headings:text-gray-900 prose-p:text-gray-700 prose-a:text-amber-600"
            dangerouslySetInnerHTML={{ __html: content }}
          />
        )}
      </div>
    </PublicLayout>
  );
}
