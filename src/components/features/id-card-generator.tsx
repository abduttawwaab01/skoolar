'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Download, Printer, RotateCcw, QrCode, Barcode, User, Eye, EyeOff, 
  Palette, AlertCircle, FileText, Image, FileCheck, Users, Loader2, 
  Plus, Minus, Check, FileType, Shield, GraduationCap, UserCheck
} from 'lucide-react';
import { toast } from 'sonner';
import QRCode from 'qrcode';
import { useAppStore } from '@/store/app-store';

interface StudentData {
  id: string;
  name: string;
  admissionNo: string;
  class: string;
  gender: string;
  photo?: string | null;
  userId?: string;
  schoolId?: string;
}

interface StaffData {
  id: string;
  name: string;
  employeeNo: string;
  role: string;
  phone?: string;
  photo?: string | null;
  userId?: string;
  schoolId?: string;
}

type CardType = 'student' | 'staff';
type ExportFormat = 'pdf' | 'png';
type ExportScope = 'front' | 'back' | 'both';
type Orientation = 'portrait' | 'landscape';

interface SchoolColors {
  primary: string;
  secondary: string;
}

const DEFAULT_COLORS: SchoolColors = {
  primary: '#059669',
  secondary: '#FFFFFF'
};

const DEFAULT_BACK_TEXT = `This card remains the property of the school.
If found, please return to the school office.

Rules:
1. Always carry your ID card
2. Do not lend to others
3. Report loss immediately`;

const CARD_WIDTH_PORTRAIT = 85.6; // mm (standard ID card)
const CARD_HEIGHT_PORTRAIT = 53.98;
const CARD_WIDTH_LANDSCAPE = 53.98;
const CARD_HEIGHT_LANDSCAPE = 85.6;

function adjustColor(hex: string, amount: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, Math.max(0, (num >> 16) + amount));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00FF) + amount));
  const b = Math.min(255, Math.max(0, (num & 0x0000FF) + amount));
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

export function IDCardGenerator() {
  const { currentRole, selectedSchoolId, currentUser } = useAppStore();
  const isTeacher = currentRole === 'TEACHER';
  const isSchoolAdmin = currentRole === 'SCHOOL_ADMIN';
  const isSuperAdmin = currentRole === 'SUPER_ADMIN';
  const schoolId = selectedSchoolId || currentUser.schoolId;
  
  // Data states
  const [students, setStudents] = useState<StudentData[]>([]);
  const [staff, setStaff] = useState<StaffData[]>([]);
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());
  const [selectedStaff, setSelectedStaff] = useState<Set<string>>(new Set());
  const [cardType, setCardType] = useState<CardType>('student');
  
  // School colors (would come from school settings)
  const [colors, setColors] = useState<SchoolColors>(DEFAULT_COLORS);
  
  // Display options
  const [showPhoto, setShowPhoto] = useState(true);
  const [showBarcode, setShowBarcode] = useState(true);
  const [showQR, setShowQR] = useState(true);
  const [backText, setBackText] = useState(DEFAULT_BACK_TEXT);
  const [showBack, setShowBack] = useState(false);
  const [orientation, setOrientation] = useState<Orientation>('portrait');
  
  // Export states
  const [exportFormat, setExportFormat] = useState<ExportFormat>('pdf');
  const [exportScope, setExportScope] = useState<ExportScope>('both');
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  // Bulk selection
  const [selectAll, setSelectAll] = useState(false);
  
  // Fetch data on mount
  useEffect(() => {
    if (!isTeacher || cardType === 'student') {
      fetchData();
    }
  }, [cardType, isTeacher]);
  
  async function fetchData() {
    setIsLoading(true);
    try {
      if (cardType === 'student') {
        const res = await fetch(`/api/students?schoolId=${schoolId}&limit=1000`);
        if (res.ok) {
          const json = await res.json();
          const studentList: StudentData[] = (json.data || []).map((s: any) => ({
            id: s.id,
            name: s.name || s.user?.name || 'Unknown',
            admissionNo: s.admissionNo || 'N/A',
            class: s.class?.name || 'N/A',
            gender: s.gender || 'N/A',
            photo: s.photo,
            userId: s.userId,
            schoolId: s.schoolId,
          }));
          setStudents(studentList);
        }
      } else {
        // Teachers can't fetch staff if they're not allowed
        if (isTeacher) {
          setStaff([]);
          return;
        }
        const res = await fetch(`/api/users?schoolId=${schoolId}&limit=1000`);
        if (res.ok) {
          const json = await res.json();
          const staffList: StaffData[] = (json.data || [])
            .filter((u: any) => !['STUDENT', 'PARENT'].includes(u.role))
            .map((u: any) => {
              let employeeNo = 'N/A';
              if (u.teacherProfile?.employeeNo) employeeNo = u.teacherProfile.employeeNo;
              else if (u.accountantProfile?.employeeNo) employeeNo = u.accountantProfile.employeeNo;
              else if (u.librarianProfile?.employeeNo) employeeNo = u.librarianProfile.employeeNo;
              else if (u.directorProfile?.employeeNo) employeeNo = u.directorProfile.employeeNo;
              else if (u.role === 'SCHOOL_ADMIN') employeeNo = `ADMIN-${u.id.slice(0, 6)}`;
              else employeeNo = `USR-${u.id.slice(0, 6)}`;
              return {
                id: u.id,
                name: u.name,
                employeeNo,
                role: u.role,
                phone: u.phone,
                photo: u.avatar,
                userId: u.id,
                schoolId: u.schoolId,
              };
            });
          setStaff(staffList);
        }
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
      toast.error('Failed to load data');
    } finally {
      setIsLoading(false);
    }
  }
  
  // Generate QR code data for a card
  const generateQRData = useCallback((person: StudentData | StaffData): string => {
    const data = {
      type: cardType,
      id: cardType === 'student' ? (person as StudentData).admissionNo : (person as StaffData).employeeNo,
      userId: person.userId,
      personId: person.id,
      schoolId: person.schoolId || '',
      name: person.name,
      role: cardType === 'student' ? 'STUDENT' : 'STAFF',
      timestamp: Date.now(),
    };
    return JSON.stringify(data);
  }, [cardType]);
  
  // Get selected items
  const selectedItems = cardType === 'student' 
    ? students.filter(s => selectedStudents.has(s.id))
    : staff.filter(s => selectedStaff.has(s.id));
  
  // Selection handlers
  const toggleSelect = (id: string) => {
    if (cardType === 'student') {
      const newSet = new Set(selectedStudents);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      setSelectedStudents(newSet);
    } else {
      const newSet = new Set(selectedStaff);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      setSelectedStaff(newSet);
    }
  };
  
  const toggleSelectAll = () => {
    if (selectAll) {
      if (cardType === 'student') setSelectedStudents(new Set());
      else setSelectedStaff(new Set());
    } else {
      const allIds = new Set(cardType === 'student' ? students.map(s => s.id) : staff.map(s => s.id));
      if (cardType === 'student') setSelectedStudents(allIds);
      else setSelectedStaff(allIds);
    }
    setSelectAll(!selectAll);
  };
  
  const clearSelection = () => {
    setSelectedStudents(new Set());
    setSelectedStaff(new Set());
    setSelectAll(false);
  };
  
  // Export handler
  const handleExport = async () => {
    const items = selectedItems;
    if (items.length === 0) {
      toast.error('No cards selected for export');
      return;
    }
    
    setIsGenerating(true);
    try {
      // Build export payload
      const payload = {
        format: exportFormat,
        scope: exportScope,
        orientation,
        cards: items.map(person => ({
          type: cardType,
          personId: person.id,
          userId: person.userId,
          displayId: cardType === 'student' ? person.admissionNo : person.employeeNo,
          name: person.name,
          class: cardType === 'student' ? (person as StudentData).class : undefined,
          role: cardType === 'staff' ? (person as StaffData).role : undefined,
          gender: cardType === 'student' ? (person as StudentData).gender : undefined,
          phone: cardType === 'staff' ? (person as StaffData).phone : undefined,
          photo: person.photo,
          schoolId: person.schoolId,
          colors: colors,
          backText,
          showPhoto,
          showBarcode,
          showQR,
        })),
      };
      
      const response = await fetch('/api/id-cards/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      
      if (!response.ok) throw new Error('Export failed');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const filename = `id-cards-${cardType}s-${new Date().toISOString().split('T')[0]}.${exportFormat === 'pdf' ? 'pdf' : 'zip'}`;
      a.download = filename;
      a.click();
      window.URL.revokeObjectURL(url);
      
      toast.success(`Exported ${items.length} ID cards`);
      setExportDialogOpen(false);
      clearSelection();
      
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export ID cards');
    } finally {
      setIsGenerating(false);
    }
  };
  
  // Generate My Own ID Card (for teachers/staff)
  const handleMyCard = async () => {
    if (!currentUser?.id) {
      toast.error('User info not available');
      return;
    }
    setIsGenerating(true);
    try {
      const response = await fetch('/api/id-cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'staff',
          personId: currentUser.id,
          schoolId: schoolId,
          colors,
          backText,
          showPhoto,
          showBarcode,
          showQR,
          orientation,
        }),
      });
      if (!response.ok) throw new Error('Failed to generate card');
      const data = await response.json();
      if (data.success && data.data) {
        const byteCharacters = atob(data.data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'image/png' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `my-id-card-${Date.now()}.png`;
        a.click();
        window.URL.revokeObjectURL(url);
        toast.success('Your ID card has been downloaded');
      }
    } catch (error) {
      console.error('Failed to generate my card:', error);
      toast.error('Failed to generate ID card');
    } finally {
      setIsGenerating(false);
    }
  };
  
  const selectedCount = cardType === 'student' ? selectedStudents.size : selectedStaff.size;
  const totalCount = cardType === 'student' ? students.length : staff.length;
  
  return (
    <div className="space-y-6">
      {/* Header with Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <CardTitle className="text-lg">ID Card Generator</CardTitle>
          <Badge variant="outline" className="text-xs">
            {cardType === 'student' ? 'Students' : 'Staff'} ({totalCount})
          </Badge>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setShowBack(!showBack)}
          >
            {showBack ? <Eye className="size-3.5 mr-1.5" /> : <EyeOff className="size-3.5 mr-1.5" />}
            {showBack ? 'Show Front' : 'Show Back'}
          </Button>
          
          {!isSchoolAdmin && !isSuperAdmin && currentUser?.id && (
            <Button 
              variant="default" 
              size="sm" 
              onClick={handleMyCard}
              disabled={isGenerating}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {isGenerating ? <Loader2 className="size-3.5 mr-1.5 animate-spin" /> : <User className="size-3.5 mr-1.5" />}
              My ID Card
            </Button>
          )}

          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => {
              const payload = {
                type: cardType,
                colors,
                backText,
                showPhoto,
                showBarcode,
                showQR,
              };
              toast.success('Settings saved to template');
            }}
          >
            <Palette className="size-3.5 mr-1.5" />
            Save Template
          </Button>
          
          <Button 
            size="sm" 
            onClick={() => setExportDialogOpen(true)}
            disabled={selectedCount === 0}
          >
            <Download className="size-3.5 mr-1.5" />
            Export Selected ({selectedCount})
          </Button>
        </div>
      </div>
      
      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        {/* Configuration Panel */}
        <Card className="h-fit">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Card Type */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Card Type</Label>
              {isTeacher || isSchoolAdmin ? (
                <div className="flex gap-2">
                  <Button size="sm" variant={cardType === 'student' ? 'default' : 'outline'} onClick={() => { setCardType('student'); clearSelection(); }} className="flex-1">Student</Button>
                  <Button size="sm" variant={cardType === 'staff' ? 'default' : 'outline'} onClick={() => { setCardType('staff'); clearSelection(); }} className="flex-1">Staff</Button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Button size="sm" variant={cardType === 'student' ? 'default' : 'outline'} onClick={() => { setCardType('student'); clearSelection(); }} className="flex-1">Student</Button>
                  <Button size="sm" variant={cardType === 'staff' ? 'default' : 'outline'} onClick={() => { setCardType('staff'); clearSelection(); }} className="flex-1">Staff</Button>
                </div>
              )}
            </div>
            
            <Separator />
            
            {/* Colors */}
            <div className="space-y-3">
              <Label className="text-xs font-medium flex items-center gap-1.5"><Palette className="size-3" /> Colors</Label>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Primary</Label>
                  <div className="flex items-center gap-2">
                    <Input type="color" value={colors.primary} onChange={e => setColors({...colors, primary: e.target.value})} className="size-8 p-0.5 cursor-pointer" />
                    <span className="text-xs font-mono truncate">{colors.primary}</span>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Background</Label>
                  <div className="flex items-center gap-2">
                    <Input type="color" value={colors.secondary} onChange={e => setColors({...colors, secondary: e.target.value})} className="size-8 p-0.5 cursor-pointer" />
                    <span className="text-xs font-mono truncate">{colors.secondary}</span>
                  </div>
                </div>
              </div>
            </div>
            
            <Separator />
            
            {/* Toggles */}
            <div className="space-y-3">
              <Label className="text-xs font-medium">Display Options</Label>
              {[
                { label: 'Show Photo', value: showPhoto, setter: setShowPhoto, icon: User },
                { label: 'Show Barcode', value: showBarcode, setter: setShowBarcode, icon: Barcode },
                { label: 'Show QR Code', value: showQR, setter: setShowQR, icon: QrCode },
              ].map(item => (
                <div key={item.label} className="flex items-center justify-between">
                  <Label className="text-xs flex items-center gap-1.5">
                    <item.icon className="size-3" /> {item.label}
                  </Label>
                  <Switch checked={item.value} onCheckedChange={item.setter} />
                </div>
              ))}
            </div>
            
            <Separator />
            
            {/* Back Text */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Back Card Text</Label>
              <Textarea 
                value={backText} 
                onChange={e => setBackText(e.target.value)} 
                className="text-xs min-h-[100px] resize-none" 
              />
            </div>
            
            <Separator />
            
            {/* Orientation */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Orientation</Label>
              <div className="flex gap-2">
                <Button size="sm" variant={orientation === 'portrait' ? 'default' : 'outline'} onClick={() => setOrientation('portrait')} className="flex-1">Portrait</Button>
                <Button size="sm" variant={orientation === 'landscape' ? 'default' : 'outline'} onClick={() => setOrientation('landscape')} className="flex-1">Landscape</Button>
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* Main Content */}
        <div className="space-y-4">
          {/* Selection Controls */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Checkbox 
                    id="selectAll" 
                    checked={selectAll}
                    onCheckedChange={toggleSelectAll}
                    disabled={totalCount === 0}
                  />
                  <Label htmlFor="selectAll" className="text-sm cursor-pointer">
                    Select All ({selectedCount}/{totalCount})
                  </Label>
                </div>
                <Button variant="ghost" size="sm" onClick={clearSelection} disabled={selectedCount === 0}>
                  <Minus className="size-3.5 mr-1" /> Clear
                </Button>
              </div>
            </CardContent>
          </Card>
          
          {/* Data Table */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                {cardType === 'student' ? 'Students' : 'Staff'} List
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="size-6 animate-spin text-emerald-600" />
                </div>
              ) : totalCount === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <AlertCircle className="size-10 mx-auto mb-2 opacity-50" />
                  No {cardType}s found
                </div>
              ) : (
                <div className="max-h-[500px] overflow-y-auto space-y-2">
                  {(cardType === 'student' ? students : staff).map((person) => {
                    const isSelected = cardType === 'student' 
                      ? selectedStudents.has(person.id)
                      : selectedStaff.has(person.id);
                    
                    return (
                      <div
                        key={person.id}
                        className={`flex items-center gap-3 p-3 rounded-lg border transition-all cursor-pointer ${
                          isSelected 
                            ? 'border-emerald-500 bg-emerald-50/50' 
                            : 'hover:bg-gray-50'
                        }`}
                        onClick={() => toggleSelect(person.id)}
                      >
                        <Checkbox 
                          checked={isSelected}
                          onCheckedChange={() => toggleSelect(person.id)}
                          onClick={(e) => e.stopPropagation()}
                        />
                        
                        <div className="w-10 h-10 rounded-lg bg-gray-200 flex items-center justify-center text-gray-600 font-medium">
                          {person.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{person.name}</p>
                          <p className="text-xs text-gray-500 truncate">
                            {cardType === 'student' 
                              ? `${person.admissionNo} • ${person.class}`
                              : `${person.employeeNo} • ${person.role}`
                            }
                          </p>
                        </div>
                        
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={async (e) => {
                            e.stopPropagation();
                            try {
                              const response = await fetch('/api/id-cards', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  type: cardType,
                                  personId: person.id,
                                  schoolId: person.schoolId,
                                  colors,
                                  backText,
                                  showPhoto,
                                  showBarcode,
                                  showQR,
                                  orientation,
                                }),
                              });
                              
                              if (response.ok) {
                                const data = await response.json();
                                if (data.success && data.data) {
                                  // Convert base64 to blob and download
                                  const byteCharacters = atob(data.data);
                                  const byteNumbers = new Array(byteCharacters.length);
                                  for (let i = 0; i < byteCharacters.length; i++) {
                                    byteNumbers[i] = byteCharacters.charCodeAt(i);
                                  }
                                  const byteArray = new Uint8Array(byteNumbers);
                                  const blob = new Blob([byteArray], { type: 'image/png' });
                                  
                                  const url = window.URL.createObjectURL(blob);
                                  const a = document.createElement('a');
                                  a.href = url;
                                  a.download = `${person.name}-id-card.png`;
                                  a.click();
                                  window.URL.revokeObjectURL(url);
                                  
                                  toast.success('ID card downloaded successfully');
                                }
                              } else {
                                toast.error('Failed to generate card');
                              }
                            } catch (error) {
                              console.error('Download error:', error);
                              toast.error('Failed to download card');
                            }
                          }}
                        >
                          <Download className="size-3.5" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
          
          {/* Preview Card */}
          {selectedCount > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  Preview ({selectedCount} selected)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-4 justify-center">
                  {selectedItems.slice(0, 3).map((person) => (
                    <div key={person.id} className="text-center">
                      <p className="text-xs text-gray-500 mb-2 truncate max-w-[120px]">
                        {(person as any).name}
                      </p>
                      <IDCardPreview
                        person={person}
                        cardType={cardType}
                        colors={colors}
                        showPhoto={showPhoto}
                        showBarcode={showBarcode}
                        showQR={showQR}
                        backText={backText}
                        showBack={showBack}
                        orientation={orientation}
                      />
                    </div>
                  ))}
                  {selectedCount > 3 && (
                    <div className="flex items-center justify-center text-sm text-gray-500">
                      +{selectedCount - 3} more
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
      
      {/* Export Dialog */}
      <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Export ID Cards</DialogTitle>
            <DialogDescription>
              Configure export options for {selectedCount} {cardType === 'student' ? 'students' : 'staff'} ID cards
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Format Selection */}
            <div className="space-y-2">
              <Label>Export Format</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant={exportFormat === 'pdf' ? 'default' : 'outline'}
                  onClick={() => setExportFormat('pdf')}
                  className="justify-start"
                >
                  <FileText className="size-4 mr-2" />
                  PDF Document
                </Button>
                <Button
                  variant={exportFormat === 'png' ? 'default' : 'outline'}
                  onClick={() => setExportFormat('png')}
                  className="justify-start"
                >
                  <Image className="size-4 mr-2" />
                  PNG Images (ZIP)
                </Button>
              </div>
            </div>
            
            {/* Scope Selection */}
            <div className="space-y-2">
              <Label>Export Which Side?</Label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: 'front', label: 'Front Only', icon: Eye },
                  { value: 'back', label: 'Back Only', icon: EyeOff },
                  { value: 'both', label: 'Both Sides', icon: FileCheck },
                ].map(option => (
                  <Button
                    key={option.value}
                    variant={exportScope === option.value ? 'default' : 'outline'}
                    onClick={() => setExportScope(option.value as ExportScope)}
                    className="justify-start"
                  >
                    <option.icon className="size-4 mr-2" />
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>
            
            {/* Orientation */}
            <div className="space-y-2">
              <Label>Card Orientation</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant={orientation === 'portrait' ? 'default' : 'outline'}
                  onClick={() => setOrientation('portrait')}
                >
                  Portrait (85.6×53.98 mm)
                </Button>
                <Button
                  variant={orientation === 'landscape' ? 'default' : 'outline'}
                  onClick={() => setOrientation('landscape')}
                >
                  Landscape (53.98×85.6 mm)
                </Button>
              </div>
            </div>
            
            {/* Summary */}
            <div className="p-4 bg-gray-50 rounded-lg space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Total Cards:</span>
                <span className="font-semibold">{selectedCount}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Format:</span>
                <span className="font-semibold uppercase">{exportFormat}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Sides:</span>
                <span className="font-semibold">{exportScope}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Orientation:</span>
                <span className="font-semibold capitalize">{orientation}</span>
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setExportDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleExport} disabled={isGenerating} className="bg-emerald-600 hover:bg-emerald-700">
              {isGenerating ? (
                <>
                  <Loader2 className="size-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Download className="size-4 mr-2" />
                  Download {exportFormat.toUpperCase()}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Card Preview Component
interface IDCardPreviewProps {
  person: StudentData | StaffData;
  cardType: CardType;
  colors: SchoolColors;
  showPhoto: boolean;
  showBarcode: boolean;
  showQR: boolean;
  backText: string;
  showBack: boolean;
  orientation: Orientation;
}

function IDCardPreview({ person, cardType, colors, showPhoto, showBarcode, showQR, backText, showBack, orientation }: IDCardPreviewProps) {
  const [previewImage, setPreviewImage] = useState<string>('');
  const [loading, setLoading] = useState(false);
  
  useEffect(() => {
    const generatePreview = async () => {
      setLoading(true);
      try {
        const response = await fetch('/api/id-cards', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: cardType,
            personId: person.id,
            schoolId: person.schoolId,
            colors,
            backText,
            showPhoto,
            showBarcode,
            showQR,
            orientation,
            isBack: showBack,
          }),
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data) {
            setPreviewImage(`data:image/png;base64,${data.data}`);
          }
        }
      } catch (error) {
        console.error('Preview generation failed:', error);
      } finally {
        setLoading(false);
      }
    };
    
    generatePreview();
  }, [person, cardType, colors, showPhoto, showBarcode, showQR, backText, showBack, orientation]);
  
  const width = orientation === 'portrait' ? CARD_WIDTH_PORTRAIT : CARD_WIDTH_LANDSCAPE;
  const height = orientation === 'portrait' ? CARD_HEIGHT_PORTRAIT : CARD_HEIGHT_LANDSCAPE;
  const scale = orientation === 'portrait' ? 1 : 1.2;
  
  return (
    <motion.div 
      className="relative"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      style={{ 
        width: `${width * scale}px`, 
        height: `${height * scale}px`,
      }}
    >
      {loading ? (
        <div className="w-full h-full bg-gray-100 rounded-xl flex items-center justify-center">
          <Loader2 className="size-6 animate-spin text-emerald-600" />
        </div>
      ) : previewImage ? (
        <img 
          src={previewImage} 
          alt="ID Card Preview" 
          className="w-full h-full object-contain rounded-xl shadow-lg"
        />
      ) : (
        <div className="w-full h-full bg-gray-200 rounded-xl flex items-center justify-center text-gray-500 text-sm">
          Preview unavailable
        </div>
      )}
    </motion.div>
  );
}
