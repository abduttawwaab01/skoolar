'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FileUploader } from '@/components/ui/file-uploader';
import { ThemePicker } from './theme-picker';
import { WysiwygEditor } from './wysiwyg-editor';
import { X, ChevronLeft, ChevronRight, Check, Wand2 } from 'lucide-react';

interface SetupWizardProps {
  form: Record<string, any>;
  updateField: (key: string, value: any) => void;
  onComplete: () => void;
  onDismiss: () => void;
}

const STEPS = [
  { id: 'branding', title: 'Branding', description: 'Set your school name, logo, and theme colors' },
  { id: 'hero', title: 'Hero Section', description: 'The main banner on your landing page' },
  { id: 'about', title: 'About', description: 'Tell visitors about your school' },
  { id: 'contact-publish', title: 'Contact & Publish', description: 'Add contact info and publish your site' },
];

export function SetupWizard({ form, updateField, onComplete, onDismiss }: SetupWizardProps) {
  const [step, setStep] = useState(0);

  const current = STEPS[step];
  const isFirst = step === 0;
  const isLast = step === STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-2">
            <Wand2 className="h-5 w-5 text-emerald-600" />
            <h2 className="text-lg font-bold">Quick Setup Wizard</h2>
          </div>
          <Button variant="ghost" size="sm" onClick={onDismiss}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex px-6 pt-4 gap-1">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex-1">
              <div className={`h-1.5 rounded-full ${i <= step ? 'bg-emerald-500' : 'bg-gray-200'}`} />
              <p className={`text-xs mt-1 ${i <= step ? 'text-emerald-700 font-medium' : 'text-gray-400'}`}>
                {s.title}
              </p>
            </div>
          ))}
        </div>

        <div className="p-6">
          <h3 className="text-xl font-bold mb-1">{current.title}</h3>
          <p className="text-sm text-gray-500 mb-6">{current.description}</p>

          {current.id === 'branding' && (
            <div className="space-y-4">
              <div>
                <Label>School Name</Label>
                <Input value={form.name || ''} onChange={e => updateField('name', e.target.value)} placeholder="Greenville High School" />
              </div>
              <div>
                <Label>School Logo</Label>
                <FileUploader value={form.logo || ''} onChange={v => updateField('logo', v)} folder="school-logos" variant="avatar" compress />
              </div>
              <div>
                <Label>Choose a Theme</Label>
                <ThemePicker
                  value={form.themePreset || 'emerald'}
                  onChange={v => updateField('themePreset', v)}
                  onColorsChange={(p, s) => {
                    updateField('primaryColor', p);
                    updateField('secondaryColor', s);
                  }}
                />
              </div>
            </div>
          )}

          {current.id === 'hero' && (
            <div className="space-y-4">
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
            </div>
          )}

          {current.id === 'about' && (
            <div className="space-y-4">
              <div>
                <Label>About Page Title</Label>
                <Input value={form.aboutTitle || ''} onChange={e => updateField('aboutTitle', e.target.value)} placeholder="About Our School" />
              </div>
              <div>
                <Label>About Content</Label>
                <WysiwygEditor value={form.aboutContent || ''} onChange={v => updateField('aboutContent', v)} placeholder="Tell visitors about your school's history, mission, and values..." />
              </div>
            </div>
          )}

          {current.id === 'contact-publish' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Contact Email</Label>
                  <Input value={form.contactEmail || ''} onChange={e => updateField('contactEmail', e.target.value)} placeholder="admin@school.com" />
                </div>
                <div>
                  <Label>Contact Phone</Label>
                  <Input value={form.contactPhone || ''} onChange={e => updateField('contactPhone', e.target.value)} placeholder="+234 800 000 0000" />
                </div>
              </div>
              <div>
                <Label>School Address</Label>
                <Input value={form.address || ''} onChange={e => updateField('address', e.target.value)} placeholder="123 Education Avenue" />
              </div>
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                <p className="text-sm text-emerald-800">
                  You can now publish your website or continue editing in the full editor. Your changes are saved as you go.
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between p-6 border-t bg-gray-50 rounded-b-xl">
          <Button variant="ghost" size="sm" onClick={onDismiss}>
            Skip wizard
          </Button>
          <div className="flex items-center gap-2">
            {!isFirst && (
              <Button variant="outline" size="sm" onClick={() => setStep(step - 1)}>
                <ChevronLeft className="h-4 w-4 mr-1" /> Back
              </Button>
            )}
            {isLast ? (
              <Button size="sm" onClick={onComplete} className="bg-emerald-600 hover:bg-emerald-700">
                <Check className="h-4 w-4 mr-1" /> Finish
              </Button>
            ) : (
              <Button size="sm" onClick={() => setStep(step + 1)}>
                Next <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
