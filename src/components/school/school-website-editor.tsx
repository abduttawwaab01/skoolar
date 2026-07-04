'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { Loader2, Globe, Eye, Save, Send, Image, Settings, FileText, Trash2 } from 'lucide-react';
import { getSchoolDomain } from '@/lib/school-utils';

interface SchoolData {
  id: string;
  name: string;
  slug: string;
  logo: string | null;
  primaryColor: string;
  secondaryColor: string;
  motto: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  foundedDate: string | null;
  schoolType: string | null;
  publicPage: {
    heroTitle: string | null;
    heroSubtitle: string | null;
    heroImageUrl: string | null;
    heroVideoUrl: string | null;
    aboutTitle: string | null;
    aboutContent: string | null;
    aboutImages: string | null;
    admissionsTitle: string | null;
    admissionsContent: string | null;
    contactEmail: string | null;
    contactPhone: string | null;
    contactAddress: string | null;
    socialLinks: string | null;
    metaTitle: string | null;
    metaDescription: string | null;
    customCss: string | null;
    extraSections: string | null;
    isPublished: boolean;
    publishedAt: string | null;
  } | null;
}

const defaultSocialLinks = JSON.stringify({
  twitter: '',
  facebook: '',
  instagram: '',
  linkedin: '',
  youtube: '',
}, null, 2);

export function SchoolWebsiteEditor() {
  const { data: session } = useSession();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [data, setData] = useState<SchoolData | null>(null);
  const [form, setForm] = useState<Record<string, any>>({});

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      const res = await fetch('/api/school/website');
      if (!res.ok) throw new Error('Failed to fetch');
      const result = await res.json();
      setData(result.school);
      const page = result.school.publicPage || {};
      setForm({
        name: result.school.name || '',
        logo: result.school.logo || '',
        primaryColor: result.school.primaryColor || '#059669',
        secondaryColor: result.school.secondaryColor || '#10B981',
        motto: result.school.motto || '',
        address: result.school.address || '',
        phone: result.school.phone || '',
        email: result.school.email || '',
        website: result.school.website || '',
        schoolType: result.school.schoolType || '',
        foundedDate: result.school.foundedDate ? result.school.foundedDate.split('T')[0] : '',
        heroTitle: page.heroTitle || '',
        heroSubtitle: page.heroSubtitle || '',
        heroImageUrl: page.heroImageUrl || '',
        aboutTitle: page.aboutTitle || '',
        aboutContent: page.aboutContent || '',
        aboutImages: page.aboutImages || '[]',
        admissionsTitle: page.admissionsTitle || '',
        admissionsContent: page.admissionsContent || '',
        contactEmail: page.contactEmail || '',
        contactPhone: page.contactPhone || '',
        contactAddress: page.contactAddress || '',
        socialLinks: page.socialLinks || defaultSocialLinks,
        metaTitle: page.metaTitle || '',
        metaDescription: page.metaDescription || '',
        customCss: page.customCss || '',
      });
    } catch (err) {
      toast.error('Failed to load school data');
    } finally {
      setLoading(false);
    }
  }

  function updateField(key: string, value: any) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      const payload: Record<string, any> = {};

      const schoolFields = ['name', 'logo', 'primaryColor', 'secondaryColor', 'motto', 'address', 'phone', 'email', 'website', 'schoolType'];
      for (const f of schoolFields) {
        if (form[f] !== undefined) payload[f] = form[f];
      }
      if (form.foundedDate) payload.foundedDate = new Date(form.foundedDate).toISOString();

      const pageFields = [
        'heroTitle', 'heroSubtitle', 'heroImageUrl',
        'aboutTitle', 'aboutContent', 'aboutImages',
        'admissionsTitle', 'admissionsContent',
        'contactEmail', 'contactPhone', 'contactAddress',
        'socialLinks', 'metaTitle', 'metaDescription',
        'customCss',
      ];
      for (const f of pageFields) {
        if (form[f] !== undefined) payload[f] = form[f];
      }

      const res = await fetch('/api/school/website', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error('Failed to save');
      toast.success('Changes saved');
    } catch {
      toast.error('Failed to save changes');
    } finally {
      setSaving(false);
    }
  }

  async function handlePublish() {
    setPublishing(true);
    try {
      await handleSave();
      const res = await fetch('/api/school/website/publish', { method: 'POST' });
      if (!res.ok) throw new Error('Failed to publish');
      const result = await res.json();
      toast.success('Website published!');
      setData(prev => prev ? { ...prev, publicPage: prev.publicPage ? { ...prev.publicPage, isPublished: true } : null } : prev);
    } catch {
      toast.error('Failed to publish');
    } finally {
      setPublishing(false);
    }
  }

  async function handleUnpublish() {
    try {
      const res = await fetch('/api/school/website/publish', { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to unpublish');
      toast.success('Website unpublished');
      setData(prev => prev ? { ...prev, publicPage: prev.publicPage ? { ...prev.publicPage, isPublished: false } : null } : prev);
    } catch {
      toast.error('Failed to unpublish');
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  const domain = data ? getSchoolDomain(data.slug) : '';
  const isPublished = data?.publicPage?.isPublished ?? false;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Globe className="h-6 w-6" />
            School Website
          </h1>
          {data && (
            <p className="text-sm text-gray-500 mt-1">
              Your school&apos;s public website: <a href={`https://${domain}`} target="_blank" rel="noopener noreferrer" className="text-emerald-600 hover:underline font-medium">{domain}</a>
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isPublished && (
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
              <span className="w-2 h-2 rounded-full bg-green-500" />
              Published
            </span>
          )}
          <Button variant="outline" size="sm" onClick={fetchData}>
            <Loader2 className="h-4 w-4 mr-1" />
            Refresh
          </Button>
        </div>
      </div>

      <Tabs defaultValue="hero">
        <TabsList className="grid grid-cols-3 md:grid-cols-6 gap-0">
          <TabsTrigger value="hero">Hero</TabsTrigger>
          <TabsTrigger value="about">About</TabsTrigger>
          <TabsTrigger value="admissions">Admissions</TabsTrigger>
          <TabsTrigger value="contact">Contact</TabsTrigger>
          <TabsTrigger value="seo">SEO</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="hero" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Hero Section</CardTitle>
              <CardDescription>The main banner on your school&apos;s landing page</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Hero Title</Label>
                <Input value={form.heroTitle || ''} onChange={e => updateField('heroTitle', e.target.value)} placeholder="Welcome to Our School" />
              </div>
              <div>
                <Label>Hero Subtitle</Label>
                <Textarea value={form.heroSubtitle || ''} onChange={e => updateField('heroSubtitle', e.target.value)} placeholder="Building the future through quality education" rows={2} />
              </div>
              <div>
                <Label>Hero Background Image URL</Label>
                <Input value={form.heroImageUrl || ''} onChange={e => updateField('heroImageUrl', e.target.value)} placeholder="https://cdn.skoolar.org/hero.jpg" />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="about" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>About Page</CardTitle>
              <CardDescription>Tell visitors about your school</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>About Page Title</Label>
                <Input value={form.aboutTitle || ''} onChange={e => updateField('aboutTitle', e.target.value)} placeholder="About Our School" />
              </div>
              <div>
                <Label>About Content (HTML supported)</Label>
                <Textarea value={form.aboutContent || ''} onChange={e => updateField('aboutContent', e.target.value)} rows={10} />
              </div>
              <div>
                <Label>About Images (JSON array of URLs)</Label>
                <Textarea value={form.aboutImages || '[]'} onChange={e => updateField('aboutImages', e.target.value)} rows={3} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="admissions" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Admissions Page</CardTitle>
              <CardDescription>Admissions information and process</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Admissions Page Title</Label>
                <Input value={form.admissionsTitle || ''} onChange={e => updateField('admissionsTitle', e.target.value)} placeholder="Admissions" />
              </div>
              <div>
                <Label>Admissions Content (HTML supported)</Label>
                <Textarea value={form.admissionsContent || ''} onChange={e => updateField('admissionsContent', e.target.value)} rows={10} placeholder="Describe your admissions process, requirements, deadlines, etc." />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contact" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Contact Information</CardTitle>
              <CardDescription>How visitors can reach your school</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Contact Email</Label>
                <Input value={form.contactEmail || ''} onChange={e => updateField('contactEmail', e.target.value)} placeholder="admissions@school.com" />
              </div>
              <div>
                <Label>Contact Phone</Label>
                <Input value={form.contactPhone || ''} onChange={e => updateField('contactPhone', e.target.value)} placeholder="+234 800 000 0000" />
              </div>
              <div>
                <Label>Contact Address</Label>
                <Textarea value={form.contactAddress || ''} onChange={e => updateField('contactAddress', e.target.value)} rows={2} />
              </div>
              <Separator />
              <div>
                <Label>Social Media Links (JSON)</Label>
                <Textarea value={form.socialLinks || defaultSocialLinks} onChange={e => updateField('socialLinks', e.target.value)} rows={6} className="font-mono text-xs" />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="seo" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>SEO Settings</CardTitle>
              <CardDescription>Control how your school site appears in search results</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Meta Title</Label>
                <Input value={form.metaTitle || ''} onChange={e => updateField('metaTitle', e.target.value)} placeholder="School Name | Skoolar" />
              </div>
              <div>
                <Label>Meta Description</Label>
                <Textarea value={form.metaDescription || ''} onChange={e => updateField('metaDescription', e.target.value)} rows={3} placeholder="A brief description of your school for search engines" />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>School Settings</CardTitle>
              <CardDescription>Basic school information used across your public site</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>School Name</Label>
                  <Input value={form.name || ''} onChange={e => updateField('name', e.target.value)} />
                </div>
                <div>
                  <Label>School Logo URL</Label>
                  <Input value={form.logo || ''} onChange={e => updateField('logo', e.target.value)} />
                </div>
                <div>
                  <Label>Primary Color</Label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={form.primaryColor || '#059669'} onChange={e => updateField('primaryColor', e.target.value)} className="h-9 w-9 rounded border cursor-pointer" />
                    <Input value={form.primaryColor || '#059669'} onChange={e => updateField('primaryColor', e.target.value)} />
                  </div>
                </div>
                <div>
                  <Label>Secondary Color</Label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={form.secondaryColor || '#10B981'} onChange={e => updateField('secondaryColor', e.target.value)} className="h-9 w-9 rounded border cursor-pointer" />
                    <Input value={form.secondaryColor || '#10B981'} onChange={e => updateField('secondaryColor', e.target.value)} />
                  </div>
                </div>
                <div>
                  <Label>School Motto</Label>
                  <Input value={form.motto || ''} onChange={e => updateField('motto', e.target.value)} />
                </div>
                <div>
                  <Label>School Type</Label>
                  <Input value={form.schoolType || ''} onChange={e => updateField('schoolType', e.target.value)} placeholder="primary / secondary / higher_institution" />
                </div>
                <div>
                  <Label>Founded Date</Label>
                  <Input type="date" value={form.foundedDate || ''} onChange={e => updateField('foundedDate', e.target.value)} />
                </div>
                <div>
                  <Label>School Email</Label>
                  <Input value={form.email || ''} onChange={e => updateField('email', e.target.value)} />
                </div>
                <div>
                  <Label>School Phone</Label>
                  <Input value={form.phone || ''} onChange={e => updateField('phone', e.target.value)} />
                </div>
              </div>
              <div>
                <Label>School Address</Label>
                <Textarea value={form.address || ''} onChange={e => updateField('address', e.target.value)} rows={2} />
              </div>
              <Separator />
              <div>
                <Label>Custom CSS</Label>
                <Textarea value={form.customCss || ''} onChange={e => updateField('customCss', e.target.value)} rows={6} className="font-mono text-xs" placeholder=".custom-class { color: var(--school-primary); }" />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border">
        <div className="text-sm text-gray-500">
          {data && (
            <span>
              Slug: <strong>{data.slug}</strong> &middot;
              URL: <a href={`https://${domain}`} target="_blank" rel="noopener noreferrer" className="text-emerald-600 hover:underline">{domain}</a>
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
            Save Draft
          </Button>
          {isPublished ? (
            <>
              <Button variant="outline" onClick={handleUnpublish}>
                <Trash2 className="h-4 w-4 mr-1" />
                Unpublish
              </Button>
              <Button variant="default" onClick={() => window.open(`https://${domain}`, '_blank')}>
                <Eye className="h-4 w-4 mr-1" />
                View Site
              </Button>
            </>
          ) : (
            <Button onClick={handlePublish} disabled={publishing} className="bg-emerald-600 hover:bg-emerald-700">
              {publishing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Send className="h-4 w-4 mr-1" />}
              Publish
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
