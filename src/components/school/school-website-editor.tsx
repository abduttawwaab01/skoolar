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
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { toast } from 'sonner';
import {
  Loader2, Globe, Eye, EyeOff, Save, Send, Settings, FileText, Trash2,
  Monitor, Palette, Layers, ToggleLeft, Sparkles, Wand2,
} from 'lucide-react';
import { getSchoolDomain } from '@/lib/school-utils';
import { getWebsiteTemplate } from '@/lib/school-website-templates';

import { FileUploader } from '@/components/ui/file-uploader';
import { SocialLinksForm } from './social-links-form';
import { WysiwygEditor } from './wysiwyg-editor';
import { ThemePicker } from './theme-picker';
import { FeatureCardsEditor } from './feature-cards-editor';
import { SectionVisibilityForm } from './section-visibility-form';
import { ExtraSectionsEditor } from './extra-sections-editor';
import { SchoolWebsitePreview } from './school-website-preview';
import { SetupWizard } from './setup-wizard';

const WIZARD_DISMISSED_KEY = 'skoolar-website-wizard-dismissed';

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
    featureCards: string | null;
    sectionVisibility: string | null;
    themePreset: string | null;
    isPublished: boolean;
    publishedAt: string | null;
  } | null;
}

const defaultSocialLinks = JSON.stringify({
  twitter: '', facebook: '', instagram: '', linkedin: '', youtube: '',
}, null, 2);

const defaultSectionVisibility = JSON.stringify({
  hero: true, about: true, admissions: true, contact: true,
  featureCards: true, entranceExam: true, extraSections: true,
});

const defaultFeatureCards = JSON.stringify([
  { icon: 'GraduationCap', title: 'Students', description: 'Excellence' },
  { icon: 'Users', title: 'Community', description: 'Together We Grow' },
  { icon: 'BookOpen', title: 'Curriculum', description: 'Comprehensive' },
  { icon: 'Award', title: 'Achievement', description: 'Recognition' },
]);

function isFormEmpty(form: Record<string, any>): boolean {
  return !form.heroTitle && !form.aboutContent && !form.contactEmail && !form.name;
}

export function SchoolWebsiteEditor() {
  const { data: session } = useSession();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [data, setData] = useState<SchoolData | null>(null);
  const [form, setForm] = useState<Record<string, any>>({});
  const [previewOpen, setPreviewOpen] = useState(true);
  const [showWizard, setShowWizard] = useState(false);
  const [originalSlug, setOriginalSlug] = useState('');
  const [slugStatus, setSlugStatus] = useState<'valid' | 'invalid' | 'taken' | 'unchanged'>('unchanged');

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (!loading && data) {
      const dismissed = localStorage.getItem(WIZARD_DISMISSED_KEY) === 'true';
      if (!dismissed && isFormEmpty(form)) {
        setShowWizard(true);
      }
    }
  }, [loading, data]);

  async function fetchData() {
    try {
      const res = await fetch('/api/school/website');
      if (!res.ok) throw new Error('Failed to fetch');
      const result = await res.json();
      setData(result.school);
      setOriginalSlug(result.school.slug || '');
      const page = result.school.publicPage || {};
      setForm({
        name: result.school.name || '',
        slug: result.school.slug || '',
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
        featureCards: page.featureCards || defaultFeatureCards,
        sectionVisibility: page.sectionVisibility || defaultSectionVisibility,
        themePreset: page.themePreset || '',
        extraSections: page.extraSections || '',
      });
    } catch {
      toast.error('Failed to load school data');
    } finally {
      setLoading(false);
    }
  }

  function updateField(key: string, value: any) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

  async function handleSlugChange(newSlug: string) {
    const slug = newSlug.toLowerCase().replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-').replace(/^-|-$/g, '');
    updateField('slug', slug);
    if (!slug || slug === originalSlug) {
      setSlugStatus('unchanged');
      return;
    }
    if (!slugRegex.test(slug) || slug.length < 2) {
      setSlugStatus('invalid');
      return;
    }
    try {
      const res = await fetch(`/api/school/website/check-slug?slug=${encodeURIComponent(slug)}`);
      const json = await res.json();
      setSlugStatus(json.available ? 'valid' : 'taken');
    } catch {
      setSlugStatus('valid');
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const payload: Record<string, any> = {};
      const schoolFields = ['name', 'slug', 'logo', 'primaryColor', 'secondaryColor', 'motto', 'address', 'phone', 'email', 'website', 'schoolType'];
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
        'customCss', 'extraSections', 'featureCards',
        'sectionVisibility', 'themePreset',
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
      const res = await fetch('/api/school/website/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldSlug: originalSlug }),
      });
      if (!res.ok) throw new Error('Failed to publish');
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

  function handleWizardDismiss() {
    localStorage.setItem(WIZARD_DISMISSED_KEY, 'true');
    setShowWizard(false);
  }

  function handleWizardComplete() {
    localStorage.setItem(WIZARD_DISMISSED_KEY, 'true');
    setShowWizard(false);
    handleSave();
    toast.success('Setup complete! You can continue editing below.');
  }

  function handleRestartWizard() {
    localStorage.removeItem(WIZARD_DISMISSED_KEY);
    setShowWizard(true);
  }

  async function handleGenerateContent() {
    const schoolType = form.schoolType?.trim().toLowerCase();
    if (!schoolType) {
      toast.error('School type not set', {
        description: 'Please select your School Type from the dropdown in the Settings tab first.',
      });
      return;
    }

    const validTypes = ['primary', 'secondary', 'primary_secondary', 'higher_institution'];
    if (!validTypes.includes(schoolType)) {
      toast.error('Unrecognized school type', {
        description: `"${schoolType}" is not recognized. Please select a valid school type from the Settings tab.`,
      });
      return;
    }

    const confirmed = window.confirm(
      'This will replace all existing website content with auto-generated content based on your school type. Any custom content you have written will be overwritten. Continue?'
    );
    if (!confirmed) return;

    setGenerating(true);
    try {
      const template = getWebsiteTemplate(schoolType, form.name, form.motto);

      setForm(prev => ({
        ...prev,
        heroTitle: template.heroTitle,
        heroSubtitle: template.heroSubtitle,
        aboutTitle: template.aboutTitle,
        aboutContent: template.aboutContent,
        admissionsTitle: template.admissionsTitle,
        admissionsContent: template.admissionsContent,
        featureCards: template.featureCards,
        extraSections: template.extraSections,
        sectionVisibility: template.sectionVisibility,
        themePreset: template.themePreset,
        metaTitle: template.metaTitle,
        metaDescription: template.metaDescription,
      }));

      toast.success('Content generated!', {
        description: `Website content for "${schoolType}" school has been populated. Review each tab, make any adjustments, and publish when ready.`,
        duration: 5000,
      });
    } catch (err) {
      toast.error('Failed to generate content', {
        description: 'An unexpected error occurred. Please try again.',
      });
    } finally {
      setGenerating(false);
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
    <>
      {showWizard && (
        <SetupWizard
          form={form}
          updateField={updateField}
          onComplete={handleWizardComplete}
          onDismiss={handleWizardDismiss}
        />
      )}

      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Globe className="h-6 w-6" />
              School Website
            </h1>
            {data && (
              <p className="text-sm text-gray-500 mt-1">
                Your school&apos;s public website:{' '}
                <a href={`https://${domain}`} target="_blank" rel="noopener noreferrer" className="text-emerald-600 hover:underline font-medium">
                  {domain}
                </a>
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {isPublished && (
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                <span className="w-2 h-2 rounded-full bg-green-500" />
                Published
              </span>
            )}
            <Button variant="ghost" size="sm" onClick={handleRestartWizard} title="Open setup wizard">
              <Wand2 className="h-4 w-4 mr-1" /> Setup
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPreviewOpen(!previewOpen)}>
              {previewOpen ? <EyeOff className="h-4 w-4 mr-1" /> : <Eye className="h-4 w-4 mr-1" />}
              {previewOpen ? 'Hide Preview' : 'Show Preview'}
            </Button>
            <Button variant="outline" size="sm" onClick={fetchData}>
              <Loader2 className="h-4 w-4 mr-1" />
              Refresh
            </Button>
          </div>
        </div>

        <div className={`grid ${previewOpen ? 'grid-cols-1 xl:grid-cols-2 gap-4' : 'grid-cols-1'}`}>
          <div className="space-y-4 min-w-0">
            <Tabs defaultValue="hero">
              <TabsList className="grid grid-cols-4 md:grid-cols-8 gap-0 h-auto">
                <TabsTrigger value="hero">Hero</TabsTrigger>
                <TabsTrigger value="about">About</TabsTrigger>
                <TabsTrigger value="admissions">Admissions</TabsTrigger>
                <TabsTrigger value="contact">Contact</TabsTrigger>
                <TabsTrigger value="sections">
                  <span className="hidden md:inline">Sections</span>
                  <Layers className="h-4 w-4 md:hidden" />
                </TabsTrigger>
                <TabsTrigger value="visibility">
                  <span className="hidden md:inline">Visibility</span>
                  <ToggleLeft className="h-4 w-4 md:hidden" />
                </TabsTrigger>
                <TabsTrigger value="seo">SEO</TabsTrigger>
                <TabsTrigger value="settings">
                  <Settings className="h-4 w-4 md:hidden" />
                  <span className="hidden md:inline">Settings</span>
                </TabsTrigger>
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
                      <Input value={form.heroSubtitle || ''} onChange={e => updateField('heroSubtitle', e.target.value)} placeholder="Building the future through quality education" />
                    </div>
                    <div>
                      <Label>Hero Background Image</Label>
                      <FileUploader value={form.heroImageUrl || ''} onChange={v => updateField('heroImageUrl', v)} folder="schools" previewAspect="16/9" />
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
                      <Label>About Content</Label>
                      <WysiwygEditor value={form.aboutContent || ''} onChange={v => updateField('aboutContent', v)} placeholder="Tell visitors about your school's history, mission, and values..." />
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
                      <Label>Admissions Content</Label>
                      <WysiwygEditor value={form.admissionsContent || ''} onChange={v => updateField('admissionsContent', v)} placeholder="Describe your admissions process, requirements, deadlines, etc." />
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
                      <Label>Social Media Links</Label>
                      <SocialLinksForm value={form.socialLinks || defaultSocialLinks} onChange={v => updateField('socialLinks', v)} />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="sections" className="space-y-4 mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Feature Cards</CardTitle>
                    <CardDescription>Icon cards on your landing page below the hero</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <FeatureCardsEditor value={form.featureCards || defaultFeatureCards} onChange={v => updateField('featureCards', v)} />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Extra Content Blocks</CardTitle>
                    <CardDescription>Add custom sections to your landing page</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ExtraSectionsEditor value={form.extraSections || ''} onChange={v => updateField('extraSections', v)} />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="visibility" className="space-y-4 mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Section Visibility</CardTitle>
                    <CardDescription>Show or hide sections on your public website</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <SectionVisibilityForm value={form.sectionVisibility || defaultSectionVisibility} onChange={v => updateField('sectionVisibility', v)} />
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
                    <CardTitle>Theme</CardTitle>
                    <CardDescription>Choose a color theme for your school website</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ThemePicker
                      value={form.themePreset || 'emerald'}
                      onChange={v => updateField('themePreset', v)}
                      onColorsChange={(p, s) => {
                        updateField('primaryColor', p);
                        updateField('secondaryColor', s);
                      }}
                    />
                  </CardContent>
                </Card>

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
                        <Label>Website Slug</Label>
                        <div className="flex items-center gap-2">
                          <Input
                            value={form.slug || ''}
                            onChange={e => handleSlugChange(e.target.value)}
                            className={slugStatus === 'taken' ? 'border-red-500' : slugStatus === 'valid' ? 'border-green-500' : ''}
                          />
                          {slugStatus === 'valid' && <span className="text-green-600 text-xs shrink-0">Available</span>}
                          {slugStatus === 'taken' && <span className="text-red-600 text-xs shrink-0">Taken</span>}
                          {slugStatus === 'invalid' && <span className="text-red-600 text-xs shrink-0">Invalid format</span>}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Your URL: <strong>{form.slug ? getSchoolDomain(form.slug) : '...'}</strong>
                          {form.slug && form.slug !== originalSlug && (
                            <span className="text-amber-600 block mt-0.5">
                              Changing the slug will change your website URL. Old links will break.
                            </span>
                          )}
                        </p>
                      </div>
                      <div>
                        <Label>School Logo</Label>
                        <FileUploader value={form.logo || ''} onChange={v => updateField('logo', v)} folder="logos" variant="avatar" />
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
                        <select
                          value={form.schoolType || ''}
                          onChange={e => updateField('schoolType', e.target.value)}
                          className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        >
                          <option value="">Select school type...</option>
                          <option value="primary">Nursery &amp; Primary</option>
                          <option value="secondary">Secondary Only</option>
                          <option value="primary_secondary">Primary &amp; Secondary</option>
                          <option value="higher_institution">Higher Institution</option>
                        </select>
                        <p className="text-xs text-muted-foreground mt-1">
                          This determines which content template is used when you click <strong>Generate Content</strong>.
                        </p>
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
                    <Accordion type="single" collapsible>
                      <AccordionItem value="advanced">
                        <AccordionTrigger className="text-sm font-medium text-gray-500">
                          Advanced Settings
                        </AccordionTrigger>
                        <AccordionContent className="space-y-4 pt-4">
                          <div>
                            <Label>Custom CSS</Label>
                            <Textarea value={form.customCss || ''} onChange={e => updateField('customCss', e.target.value)} rows={6} className="font-mono text-xs" placeholder=".custom-class { color: var(--school-primary); }" />
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
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
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleGenerateContent}
                  disabled={generating}
                  title="Auto-generate website content based on your school type"
                  className="border-amber-300 text-amber-700 hover:bg-amber-50 hover:border-amber-400"
                >
                  {generating ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  ) : (
                    <Sparkles className="h-4 w-4 mr-1" />
                  )}
                  {generating ? 'Generating...' : 'Generate Content'}
                </Button>
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

          {previewOpen && (
            <div className="min-w-0 sticky top-4 self-start">
              <SchoolWebsitePreview form={form} slug={data?.slug || ''} />
            </div>
          )}
        </div>
      </div>
    </>
  );
}
