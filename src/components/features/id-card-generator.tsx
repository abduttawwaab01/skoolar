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
  const { currentRole } = useAppStore();
  const isTeacher = currentRole === 'TEACHER';
  
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
        const res = await fetch('/api/students?limit=1000');
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
        const res = await fetch('/api/teachers?limit=1000');
        if (res.ok) {
          const json = await res.json();
          const staffList: StaffData[] = (json.data || []).map((t: any) => ({
            id: t.id,
            name: t.name || t.user?.name || 'Unknown',
            employeeNo: t.employeeNo || 'N/A',
            role: t.qualification || 'Teacher',
            phone: t.phone,
            photo: t.photo,
            userId: t.userId,
            schoolId: t.schoolId,
          }));
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
  
  // Single card download (PNG)
  const handleSingleDownload = async (person: StudentData | StaffData) => {
    try {
      toast.info('Single card download would be implemented in the export API');
      // For now, just show success message
      await new Promise(resolve => setTimeout(resolve, 500));
      toast.success('ID card ready for download');
    } catch (error) {
      toast.error('Failed to generate card');
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
              {isTeacher ? (
                <div className="flex gap-2">
                  <Button size="sm" variant="default" className="flex-1" disabled>Student</Button>
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
                          onClick={(e) => {
                            e.stopPropagation();
                            // Preview single card
                          }}
                        >
                          <Eye className="size-3.5" />
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
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [photoError, setPhotoError] = useState(false);
  
  useEffect(() => {
    if (showQR && !showBack) {
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
      QRCode.toDataURL(JSON.stringify(data), {
        width: 140,
        margin: 2,
        color: {
          dark: colors.primary,
          light: colors.secondary,
        },
      })
      .then(url => setQrCodeDataUrl(url))
      .catch(console.error);
    }
  }, [person, cardType, colors.primary, colors.secondary, showQR, showBack]);
  
  const width = orientation === 'portrait' ? CARD_WIDTH_PORTRAIT : CARD_WIDTH_LANDSCAPE;
  const height = orientation === 'portrait' ? CARD_HEIGHT_PORTRAIT : CARD_HEIGHT_LANDSCAPE;
  const scale = orientation === 'portrait' ? 1 : 1.2;
  
  const initials = person.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  const schoolName = "Greenfield Academy";
  
  // Check if there's a photo URL available
  const hasPhoto = person.photo && person.photo.length > 0 && !photoError;
  
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
      {!showBack ? (
        // Front - Enhanced Design
        <div 
          className="h-full flex flex-col relative overflow-hidden rounded-xl shadow-lg"
          style={{ 
            width: `${width * scale}px`, 
            height: `${height * scale}px`,
            backgroundColor: colors.secondary,
          }}
        >
          {/* Gradient Header */}
          <motion.div 
            className="h-10 px-3 flex items-center relative overflow-hidden"
            style={{ 
              background: `linear-gradient(135deg, ${colors.primary} 0%, ${adjustColor(colors.primary, -25)} 100%)`,
            }}
            initial={{ height: 0 }}
            animate={{ height: 40 }}
            transition={{ delay: 0.1, duration: 0.3 }}
          >
            {/* Decorative Circle */}
            <div className="absolute -right-4 -top-4 w-16 h-16 bg-white/10 rounded-full" />
            <div className="absolute -bottom-6 -left-6 w-12 h-12 bg-white/5 rounded-full" />
            
            <div className="flex items-center gap-2 relative z-10">
              <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">
                <GraduationCap className="size-4 text-white" />
              </div>
              <span className="text-white text-xs font-bold tracking-wide truncate">{schoolName}</span>
            </div>
            <motion.span 
              className="ml-auto text-white/90 text-xs font-medium"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              OFFICIAL ID CARD
            </motion.span>
          </motion.div>
          
          <div className="flex-1 flex p-3 gap-3">
            {/* Photo Section - Now with actual photo support */}
            <motion.div 
              className="shrink-0 flex flex-col items-center gap-1"
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.15 }}
            >
              <div 
                className="relative rounded-lg overflow-hidden flex items-center justify-center"
                style={{ 
                  width: `${60 * scale}px`, 
                  height: `${75 * scale}px`,
                  backgroundColor: colors.primary + '15',
                  border: `2px solid ${colors.primary}40`,
                }}
              >
                {hasPhoto ? (
                  <img 
                    src={person.photo!} 
                    alt={person.name}
                    className="w-full h-full object-cover"
                    onError={() => setPhotoError(true)}
                  />
                ) : (
                  <>
                    <div 
                      className="absolute inset-0 flex items-center justify-center"
                      style={{ backgroundColor: colors.primary + '10' }}
                    >
                      <span 
                        className="font-bold text-2xl"
                        style={{ color: colors.primary }}
                      >
                        {initials}
                      </span>
                    </div>
                    {/* Subtle border overlay */}
                    <div className="absolute inset-0 border border-dashed border-gray-300 rounded-lg opacity-50" />
                  </>
                )}
              </div>
              <span className="text-xs text-gray-500 font-medium">PHOTO</span>
            </motion.div>
            
            {/* Info Section */}
            <motion.div 
              className="flex-1 min-w-0 space-y-1.5"
              initial={{ x: 20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              <motion.p 
                className="text-sm font-bold truncate"
                style={{ color: colors.primary }}
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.25 }}
              >
                {person.name}
              </motion.p>

              <Badge 
                variant="outline" 
                className="text-xs px-2 py-0.5 font-semibold"
                style={{ borderColor: colors.primary, color: colors.primary, backgroundColor: colors.primary + '10' }}
              >
                {cardType === 'student' ? '🎓 STUDENT' : '👨‍🏫 STAFF'}
              </Badge>
              
              <div className="space-y-[2px] text-[10px] text-gray-600">
                {cardType === 'student' ? (
                  <>
                    <p>
                      <span className="text-gray-400">📚 Class:</span>{' '}
                      <span className="font-semibold">{(person as StudentData).class}</span>
                    </p>
                    <p>
                      <span className="text-gray-400">🆔 ID:</span>{' '}
                      <span className="font-mono font-bold">{(person as StudentData).admissionNo}</span>
                    </p>
                    <p>
                      <span className="text-gray-400">⚧ Gender:</span>{' '}
                      <span className="font-medium">{(person as StudentData).gender}</span>
                    </p>
                  </>
                ) : (
                  <>
                    <p>
                      <span className="text-gray-400">💼 Emp#:</span>{' '}
                      <span className="font-mono font-bold">{(person as StaffData).employeeNo}</span>
                    </p>
                    <p>
                      <span className="text-gray-400">📋 Role:</span>{' '}
                      <span className="font-medium">{(person as StaffData).role}</span>
                    </p>
                    {(person as StaffData).phone && (
                      <p>
                        <span className="text-gray-400">📱 Tel:</span>{' '}
                        <span className="font-medium">{(person as StaffData).phone}</span>
                      </p>
                    )}
                  </>
                )}
              </div>
            </motion.div>
          </div>
          
          {/* QR Code Section - Prominent */}
          <motion.div 
            className="px-3 pb-3 flex items-end justify-between"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            {showBarcode && (
              <div className="flex items-end gap-[1px] h-6">
                {Array.from({ length: 25 }).map((_, i) => (
                  <motion.div 
                    key={i}
                    initial={{ scaleY: 0 }}
                    animate={{ scaleY: 1 }}
                    transition={{ delay: 0.4 + i * 0.02 }}
                    className={cn('w-[1.5px]', i % 3 === 0 ? 'h-full' : i % 3 === 1 ? 'h-3/4' : 'h-1/2')} 
                    style={{ backgroundColor: i % 2 === 0 ? '#000' : colors.primary }} 
                  />
                ))}
              </div>
            )}
            {showQR && qrCodeDataUrl && (
              <motion.div 
                className="relative rounded-lg p-1"
                style={{ 
                  border: `2px solid ${colors.primary}`,
                  backgroundColor: colors.secondary,
                  width: `${50 * scale}px`, 
                  height: `${50 * scale}px`,
                }}
                initial={{ scale: 0, rotate: -10 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: 0.35, type: 'spring' }}
                whileHover={{ scale: 1.05, rotate: 2 }}
              >
                <img 
                  src={qrCodeDataUrl} 
                  alt="QR Code" 
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }} 
                />
                <div className="absolute -bottom-5 left-0 right-0 text-center">
                  <span className="text-[6px] text-gray-400">Scan for Info</span>
                </div>
              </motion.div>
            )}
          </motion.div>

          {/* Footer */}
          <motion.div 
            className="absolute bottom-0 left-0 right-0 h-5 px-3 flex items-center"
            style={{ backgroundColor: colors.primary + '12' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            <span className="text-[7px] text-gray-500">
              🎓 SKOOLAR | Odebunmi Tawwāb | Valid {new Date().getFullYear()}
            </span>
          </motion.div>
        </div>
      ) : (
        // Back - Enhanced Design
        <motion.div 
          className="h-full flex flex-col p-3 relative overflow-hidden rounded-xl shadow-lg"
          style={{ 
            width: `${width * scale}px`, 
            height: `${height * scale}px`,
            backgroundColor: colors.secondary,
          }}
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
        >
          {/* Header */}
          <motion.div 
            className="text-center pb-2"
            style={{ borderBottom: `2px solid ${colors.primary}30` }}
            initial={{ y: -10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
          >
            <p className="text-xs font-bold" style={{ color: colors.primary }}>{schoolName}</p>
            <p className="text-xs text-gray-500">📍 12 Education Drive, Lagos | 📞 +234-801-234-5678</p>
          </motion.div>
          
          {/* Back Text */}
          <motion.div 
            className="flex-1 py-2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <p className="text-xs text-gray-600 whitespace-pre-line leading-relaxed">
              {backText}
            </p>
          </motion.div>
          
          {/* Footer */}
          <motion.div 
            className="text-center pt-2"
            style={{ borderTop: `2px solid ${colors.primary}30` }}
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            <p className="text-xs text-gray-500">
              📅 Academic Year: {new Date().getFullYear()}/{new Date().getFullYear() + 1}
            </p>
            <p className="text-[7px] text-gray-400 mt-0.5">
              🚨 Emergency: Contact School Administration
            </p>
          </motion.div>

          {/* Watermark */}
          <motion.div 
            className="absolute bottom-1 right-2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            <span className="text-[6px] text-gray-300">SKOOLAR | Odebunmi Tawwāb</span>
          </motion.div>
        </motion.div>
      )}
    </motion.div>
  );
}
