'use client';

import * as React from 'react';
import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Upload, Save, Palette, AlertTriangle } from 'lucide-react';
import { useAppStore } from '@/store/app-store';
import { toast } from 'sonner';

interface SchoolData {
  id: string;
  name: string;
  motto: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  logo: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
}

interface StudentData {
  id: string;
  name: string;
  admissionNo: string;
  className: string;
}

export function BrandingView() {
  const { selectedSchoolId } = useAppStore();
  const [primaryColor, setPrimaryColor] = useState('#059669');
  const [secondaryColor, setSecondaryColor] = useState('#10B981');
  const [footerText, setFooterText] = useState('');
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [school, setSchool] = useState<SchoolData | null>(null);
  const [MOCK_SAMPLE_STUDENT, setMOCK_SAMPLE_STUDENT] = useState<StudentData | null>(null);

  // Fetch school data
  useEffect(() => {
    if (!selectedSchoolId) return;
    setLoading(true);
    Promise.all([
      fetch(`/api/schools/${selectedSchoolId}`).then(res => res.json()),
      fetch(`/api/students?schoolId=${selectedSchoolId}&limit=1`).then(res => res.json()),
    ])
      .then(([schoolJson, studentsJson]) => {
        const schoolData = schoolJson.data || null;
        const studentData = (studentsJson.data || [])[0] || null;
        if (schoolData) {
          setSchool(schoolData);
          setPrimaryColor(schoolData.primaryColor || '#059669');
          setSecondaryColor(schoolData.secondaryColor || '#10B981');
          setFooterText(`© ${new Date().getFullYear()} ${schoolData.name}. All rights reserved.`);
        }
        if (studentData) {
          setMOCK_SAMPLE_STUDENT({
            id: studentData.id,
            name: studentData.user?.name || 'Student Name',
            admissionNo: studentData.admissionNo || 'N/A',
            className: studentData.class?.name || 'N/A',
          });
        }
      })
      .catch(() => toast.error('Failed to load school data'))
      .finally(() => setLoading(false));
  }, [selectedSchoolId]);

  const handleSave = async () => {
    if (!selectedSchoolId) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/schools/${selectedSchoolId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          primaryColor,
          secondaryColor,
        }),
      });
      const json = await res.json();
      if (res.ok) {
        setSaved(true);
        toast.success('Branding saved successfully');
        setTimeout(() => setSaved(false), 2000);
      } else {
        toast.error(json.error || 'Failed to save branding');
      }
    } catch {
      toast.error('Failed to save branding');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-6">
            <Skeleton className="h-48 rounded-lg" />
            <Skeleton className="h-40 rounded-lg" />
            <Skeleton className="h-36 rounded-lg" />
          </div>
          <div className="space-y-6">
            <Skeleton className="h-72 rounded-lg" />
            <Skeleton className="h-64 rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  if (!selectedSchoolId) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <AlertTriangle className="size-10 opacity-40 mb-3" />
        <p className="text-sm">Please select a school to manage branding</p>
      </div>
    );
  }

  const schoolName = school?.name || 'School Name';
  const schoolMotto = school?.motto || 'School Motto';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Palette className="size-5" />
            Branding
          </h2>
          <p className="text-sm text-muted-foreground">Customize your school&apos;s visual identity</p>
        </div>
        <Button className="gap-2" onClick={handleSave} disabled={saving}>
          <Save className="size-4" />
          {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Changes'}
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">School Colors</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Primary Color</Label>
                  <div className="flex items-center gap-3">
                    <Input
                      type="color"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      className="w-12 h-10 p-1 cursor-pointer rounded-lg border"
                    />
                    <Input
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      className="flex-1 font-mono text-sm"
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label>Secondary Color</Label>
                  <div className="flex items-center gap-3">
                    <Input
                      type="color"
                      value={secondaryColor}
                      onChange={(e) => setSecondaryColor(e.target.value)}
                      className="w-12 h-10 p-1 cursor-pointer rounded-lg border"
                    />
                    <Input
                      value={secondaryColor}
                      onChange={(e) => setSecondaryColor(e.target.value)}
                      className="flex-1 font-mono text-sm"
                    />
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg border">
                <div className="flex gap-1">
                  <div className="w-8 h-8 rounded" style={{ backgroundColor: primaryColor }} />
                  <div className="w-8 h-8 rounded" style={{ backgroundColor: secondaryColor }} />
                </div>
                <div className="text-xs text-muted-foreground">Color preview</div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Logo Upload</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-8 hover:border-muted-foreground/50 transition-colors cursor-pointer">
                <Upload className="size-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground mt-2">Click or drag to upload logo</p>
                <p className="text-xs text-muted-foreground mt-1">PNG, JPG, SVG (max 2MB)</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Custom Footer Text</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={footerText}
                onChange={(e) => setFooterText(e.target.value)}
                rows={3}
                placeholder="Enter custom footer text..."
              />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Report Card Preview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg overflow-hidden">
                <div
                  className="p-4 text-white"
                  style={{ backgroundColor: primaryColor }}
                >
                  <h4 className="font-bold text-sm">{schoolName}</h4>
                  <p className="text-xs opacity-80">{schoolMotto}</p>
                </div>
                <div className="p-4 space-y-3">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-muted-foreground">Student:</span>
                      <p className="font-medium">{MOCK_SAMPLE_STUDENT?.name || 'Student Name'}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Admission No:</span>
                      <p className="font-medium font-mono">{MOCK_SAMPLE_STUDENT?.admissionNo || 'N/A'}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Class:</span>
                      <p className="font-medium">{MOCK_SAMPLE_STUDENT?.className || 'N/A'}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Term:</span>
                      <p className="font-medium">Current Term</p>
                    </div>
                  </div>
                  <Separator />
                  <div className="space-y-1.5">
                    {['Mathematics', 'English', 'Physics'].map((subj) => (
                      <div key={subj} className="flex justify-between text-xs">
                        <span>{subj}</span>
                        <div className="flex gap-4">
                          <span className="w-8 text-center">{Math.floor(Math.random() * 30 + 65)}</span>
                          <Badge className="text-xs" style={{ backgroundColor: secondaryColor, color: '#fff' }}>
                            {['A', 'B', 'A'][Math.floor(Math.random() * 3)]}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                  <Separator />
                  <p className="text-[10px] text-muted-foreground text-center">{footerText}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">ID Card Preview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg overflow-hidden max-w-[220px] mx-auto">
                <div
                  className="h-8"
                  style={{ backgroundColor: primaryColor }}
                />
                <div className="p-3 flex flex-col items-center">
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-sm"
                    style={{ backgroundColor: secondaryColor }}
                  >
                    {MOCK_SAMPLE_STUDENT?.name?.split(' ').map(n => n[0]).join('').slice(0, 2) || 'ID'}
                  </div>
                  <h5 className="font-semibold text-xs mt-2">{schoolName}</h5>
                  <p className="text-[10px] text-muted-foreground">Student ID Card</p>
                  <Separator className="my-2 w-full" />
                  <div className="w-full space-y-1 text-[10px]">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Name:</span>
                      <span className="font-medium">{MOCK_SAMPLE_STUDENT?.name || 'Student Name'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Class:</span>
                      <span className="font-medium">{MOCK_SAMPLE_STUDENT?.className || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">ID:</span>
                      <span className="font-medium font-mono">{MOCK_SAMPLE_STUDENT?.admissionNo || 'N/A'}</span>
                    </div>
                  </div>
                </div>
                <div
                  className="h-1"
                  style={{ backgroundColor: secondaryColor }}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
