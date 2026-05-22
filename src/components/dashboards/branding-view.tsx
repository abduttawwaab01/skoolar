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
import { Upload, Save, Palette, AlertTriangle, QrCode, Download, Printer, RefreshCw, Image } from 'lucide-react';
import { useAppStore } from '@/store/app-store';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

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
  const { selectedSchoolId, currentUser } = useAppStore();
  const schoolId = currentUser.schoolId || selectedSchoolId || '';
  const [primaryColor, setPrimaryColor] = useState('#059669');
  const [secondaryColor, setSecondaryColor] = useState('#10B981');
  const [footerText, setFooterText] = useState('');
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [school, setSchool] = useState<SchoolData | null>(null);
  const [sampleStudent, setSampleStudent] = useState<StudentData | null>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [qrLabel, setQrLabel] = useState('Scan to mark attendance at school entrance');
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  // Fetch school data
  useEffect(() => {
    if (!schoolId) return;
    setLoading(true);
    Promise.all([
      fetch(`/api/schools/${schoolId}`).then(res => res.json()),
      fetch(`/api/students?schoolId=${schoolId}&limit=1`).then(res => res.json()),
    ])
      .then(([schoolJson, studentsJson]) => {
        const schoolData = schoolJson.data || null;
        const studentData = (studentsJson.data || [])[0] || null;
        if (schoolData) {
          setSchool(schoolData);
          setPrimaryColor(schoolData.primaryColor || '#059669');
          setSecondaryColor(schoolData.secondaryColor || '#10B981');
          setFooterText(`© ${new Date().getFullYear()} ${schoolData.name}. All rights reserved.`);
          setQrCodeUrl(`/api/school/qr?schoolId=${schoolId}&t=${Date.now()}`);
          if (schoolData.logo) setLogoPreview(schoolData.logo);
        }
        if (studentData) {
          setSampleStudent({
            id: studentData.id,
            name: studentData.user?.name || 'Student Name',
            admissionNo: studentData.admissionNo || 'N/A',
            className: studentData.class?.name || 'N/A',
          });
        }
      })
      .catch(() => toast.error('Failed to load school data'))
      .finally(() => setLoading(false));
  }, [schoolId]);

  const handleSave = async () => {
    if (!schoolId) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/schools/${schoolId}`, {
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

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast.error('File too large (max 2MB)'); return; }
    const allowedTypes = ['image/png', 'image/jpeg', 'image/svg+xml'];
    if (!allowedTypes.includes(file.type)) { toast.error('Invalid file type'); return; }
    
    setUploadingLogo(true);
    try {
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const base64 = ev.target?.result as string;
        setLogoPreview(base64);
        // Save to school
        const res = await fetch(`/api/schools/${schoolId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ logo: base64 }),
        });
        const json = await res.json();
        if (json.data) {
          setSchool(prev => prev ? { ...prev, logo: base64 } : null);
          toast.success('Logo updated');
        } else {
          toast.error(json.error || 'Failed to save logo');
        }
        setUploadingLogo(false);
      };
      reader.readAsDataURL(file);
    } catch {
      toast.error('Failed to upload logo');
      setUploadingLogo(false);
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

  if (!schoolId) {
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
              <div className="flex flex-col items-center justify-center">
                {(logoPreview || school?.logo) && (
                  <div className="mb-4">
                    <img 
                      src={logoPreview || school?.logo || ''} 
                      alt="School Logo" 
                      className="h-20 w-20 object-contain rounded-lg border"
                    />
                  </div>
                )}
                <label className="flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-6 hover:border-muted-foreground/50 transition-colors cursor-pointer w-full">
                  <input 
                    type="file" 
                    accept="image/png,image/jpeg,image/svg+xml"
                    onChange={handleLogoUpload}
                    className="hidden"
                    disabled={uploadingLogo}
                  />
                  {uploadingLogo ? (
                    <RefreshCw className="size-8 text-muted-foreground animate-spin" />
                  ) : (
                    <>
                      <Upload className="size-8 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground mt-2">Click or drag to upload logo</p>
                      <p className="text-xs text-muted-foreground mt-1">PNG, JPG, SVG (max 2MB)</p>
                    </>
                  )}
                </label>
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
                      <p className="font-medium">{sampleStudent?.name || 'Student Name'}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Admission No:</span>
                      <p className="font-medium font-mono">{sampleStudent?.admissionNo || 'N/A'}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Class:</span>
                      <p className="font-medium">{sampleStudent?.className || 'N/A'}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Term:</span>
                      <p className="font-medium">Current Term</p>
                    </div>
                  </div>
                  <Separator />
                  <div className="space-y-1.5">
                    {['Mathematics', 'English', 'Physics'].map((subj, idx) => (
                      <div key={subj} className="flex justify-between text-xs">
                        <span>{subj}</span>
                        <div className="flex gap-4">
                          <span className="w-8 text-center">{[78, 85, 72][idx]}</span>
                          <Badge className="text-xs" style={{ backgroundColor: secondaryColor, color: '#fff' }}>
                            {['A', 'B', 'A'][idx]}
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
                    {sampleStudent?.name?.split(' ').map(n => n[0]).join('').slice(0, 2) || 'ID'}
                  </div>
                  <h5 className="font-semibold text-xs mt-2">{schoolName}</h5>
                  <p className="text-[10px] text-muted-foreground">Student ID Card</p>
                  <Separator className="my-2 w-full" />
                  <div className="w-full space-y-1 text-[10px]">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Name:</span>
                      <span className="font-medium">{sampleStudent?.name || 'Student Name'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Class:</span>
                      <span className="font-medium">{sampleStudent?.className || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">ID:</span>
                      <span className="font-medium font-mono">{sampleStudent?.admissionNo || 'N/A'}</span>
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

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <QrCode className="size-4" />
                School Entrance QR Code
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-xs text-muted-foreground">
                Print this QR code and paste at the school entrance. Staff can scan it to mark their attendance.
              </p>
              <div className="flex justify-center">
                {qrCodeUrl ? (
                  <div className="bg-white p-3 border-2 border-emerald-500 rounded-lg inline-block">
                    <img src={qrCodeUrl} alt="School QR Code" className="w-40 h-40" />
                  </div>
                ) : (
                  <div className="w-40 h-40 bg-gray-100 rounded-lg flex items-center justify-center text-muted-foreground text-sm">
                    Loading...
                  </div>
                )}
              </div>
              <div className="grid gap-2">
                <Label>QR Code Label</Label>
                <Input
                  value={qrLabel}
                  onChange={(e) => setQrLabel(e.target.value)}
                  placeholder="Enter a label for the QR code"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1 gap-2"
                  onClick={() => {
                    if (!qrCodeUrl) return;
                    const link = document.createElement('a');
                    link.href = qrCodeUrl;
                    link.download = `attendance-qr-${school?.name?.replace(/\s+/g, '-').toLowerCase() || 'download'}.png`;
                    link.click();
                  }}
                  disabled={!qrCodeUrl}
                >
                  <Download className="size-4" />
                  Download
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 gap-2"
                  onClick={() => window.print()}
                  disabled={!qrCodeUrl}
                >
                  <Printer className="size-4" />
                  Print
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    setQrCodeUrl(`/api/school/qr?schoolId=${schoolId}&t=${Date.now()}`);
                  }}
                  disabled={!schoolId}
                  title="Regenerate QR code"
                >
                  <RefreshCw className="size-4" />
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground text-center">
                Staff scans this QR using the &ldquo;My Attendance&rdquo; feature in their dashboard
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
      {/* Print watermark */}
      <div className="print-only fixed bottom-4 right-4 text-[8px] text-gray-300 opacity-40" style={{ display: 'none' }}>
        Skoolar - Odebunmi Tawwāb
      </div>
      <style>{`@media print{.print-only{display:block!important;position:fixed;bottom:4px;right:4px;font-size:8px;color:#ccc;opacity:.4;z-index:9999}}`}</style>
    </div>
  );
}
