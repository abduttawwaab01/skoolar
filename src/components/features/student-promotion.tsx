'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, ArrowRight, CheckCircle, XCircle, GraduationCap, Users, Trophy, AlertTriangle, Undo2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAppStore } from '@/store/app-store';

interface PromotionRecord {
  id: string;
  academicYear: string;
  term: string;
  studentName: string;
  fromClass: string;
  toClass: string;
  date: string;
  status: 'completed' | 'undone';
}

interface PromotionStudent {
  id: string;
  name: string;
  className: string;
  classId: string | null;
  gpa: number;
  attendance: number;
  behaviorScore: number;
  passed: boolean;
  selected: boolean;
}

interface ClassData {
  id: string;
  name: string;
  section: string | null;
  _count: { students: number };
}

interface StudentData {
  id: string;
  admissionNo: string;
  user: { name: string | null };
  class: { id: string; name: string; section: string | null } | null;
  classId: string | null;
  gpa: number | null;
  behaviorScore: number | null;
  parentIds: string | null;
}

const steps = [
  { label: 'Academic Year', icon: '📅' },
  { label: 'Source Class', icon: '🏫' },
  { label: 'Review Students', icon: '👥' },
  { label: 'Destination', icon: '🎯' },
  { label: 'Confirm', icon: '✅' },
];

const classProgression: Record<string, string> = {
  'JSS 1A': 'JSS 2A', 'JSS 1B': 'JSS 2B',
  'JSS 2A': 'SS 1A', 'JSS 2B': 'SS 1B',
  'SS 1A': 'SS 2A', 'SS 1B': 'SS 2B',
  'SS 2A': 'SS 3A', 'SS 2B': 'SS 3B',
};

export default function StudentPromotion() {
  const { selectedSchoolId, currentUser } = useAppStore();
  const schoolId = selectedSchoolId || currentUser.schoolId;

  const [currentStep, setCurrentStep] = useState(0);
  const [selectedYear, setSelectedYear] = useState('');
  const [selectedTerm, setSelectedTerm] = useState('');
  const [selectedFromClass, setSelectedFromClass] = useState('');
  const [selectedToClass, setSelectedToClass] = useState('');
  const [promotionStudents, setPromotionStudents] = useState<PromotionStudent[]>([]);
  const [isPromoting, setIsPromoting] = useState(false);
  const [promotionProgress, setPromotionProgress] = useState(0);
  const [promotionHistory, setPromotionHistory] = useState<PromotionRecord[]>([]);
  const [promotionComplete, setPromotionComplete] = useState(false);

  // Fetched data
   const [allStudents, setAllStudents] = useState<StudentData[]>([]);
   const [classes, setClasses] = useState<ClassData[]>([]);
   const [academicYears, setAcademicYears] = useState<Array<{ id: string; name: string; isCurrent: boolean }>>([]);
   const [terms, setTerms] = useState<Array<{ id: string; name: string; academicYearId: string }>>([]);
   const [isLoadingData, setIsLoadingData] = useState(true);
   const [dataError, setDataError] = useState<string | null>(null);

   const fetchData = useCallback(async () => {
     if (!schoolId) {
       setDataError('No school selected');
       setIsLoadingData(false);
       return;
     }
     try {
       setDataError(null);
       setIsLoadingData(true);
       
       const [studentsRes, classesRes, yearsRes, termsRes] = await Promise.all([
         fetch(`/api/students?schoolId=${schoolId}&limit=500`),
         fetch(`/api/classes?schoolId=${schoolId}&limit=100`),
         fetch(`/api/academic-years?schoolId=${schoolId}&limit=10`),
         fetch(`/api/terms?schoolId=${schoolId}&limit=20`),
       ]);

       // Core data
       if (!studentsRes.ok || !classesRes.ok) {
         throw new Error('Failed to fetch core data');
       }

       const studentsJson = await studentsRes.json();
       const classesJson = await classesRes.json();

       if (studentsJson.error) throw new Error(studentsJson.error);
       if (classesJson.error) throw new Error(classesJson.error);

       setAllStudents(studentsJson.data || []);
       setClasses(classesJson.data || []);

       // Academic years
       if (yearsRes.ok) {
         const yearsJson = await yearsRes.json();
         const years = yearsJson.data || [];
         setAcademicYears(years);
         const currentYear = years.find((y: any) => y.isCurrent);
         if (currentYear && !selectedYear) {
           setSelectedYear(currentYear.id);
         }
       }

       // Terms
       if (termsRes.ok) {
         const termsJson = await termsRes.json();
         setTerms(termsJson.data || []);
       }

     } catch (err) {
       const msg = err instanceof Error ? err.message : 'Failed to load data';
       setDataError(msg);
       toast.error(msg);
     } finally {
       setIsLoadingData(false);
     }
   }, [schoolId, selectedYear]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const classNames = classes.map(c => c.name);
  const getClassId = (name: string) => classes.find(c => c.name === name)?.id || null;
  const getStudentCountForClass = (className: string) => {
    return allStudents.filter(s => s.class?.name === className).length;
  };

  const classStudents = useMemo(() => {
    return allStudents
      .filter(s => s.class?.name === selectedFromClass)
      .map(s => ({
        id: s.id,
        name: s.user.name || s.admissionNo,
        className: s.class?.name || '',
        classId: s.class?.id || null,
        gpa: s.gpa || 0,
        attendance: 85, // Default if no attendance data
        behaviorScore: s.behaviorScore || 80,
        passed: (s.gpa || 0) >= 2.0,
        selected: (s.gpa || 0) >= 2.0,
      }));
  }, [allStudents, selectedFromClass]);

  const handleSelectAllPassing = () => {
    setPromotionStudents(prev => prev.map(s => ({ ...s, selected: s.passed })));
  };

  const handleToggleStudent = (id: string) => {
    setPromotionStudents(prev => prev.map(s => s.id === id ? { ...s, selected: !s.selected } : s));
  };

  const handleNext = () => {
    if (currentStep === 0 && (!selectedYear || !selectedTerm)) {
      toast.error('Please select academic year and term');
      return;
    }
    if (currentStep === 1 && !selectedFromClass) {
      toast.error('Please select a class');
      return;
    }
    if (currentStep === 2) {
      if (promotionStudents.length === 0) {
        setPromotionStudents(classStudents);
      }
      const selectedCount = promotionStudents.filter(s => s.selected).length;
      if (selectedCount === 0) {
        toast.error('Please select at least one student to promote');
        return;
      }
    }
    if (currentStep === 3 && !selectedToClass) {
      toast.error('Please select a destination class');
      return;
    }
    setCurrentStep(prev => Math.min(prev + 1, 4));
  };

  const handleBack = () => {
    setCurrentStep(prev => Math.max(prev - 1, 0));
  };

  const handleConfirmPromotion = async () => {
    setIsPromoting(true);
    setPromotionProgress(0);
    const toPromote = promotionStudents.filter(s => s.selected);
    const total = toPromote.length;
    const toClassId = getClassId(selectedToClass);
    let promoted = 0;

    try {
      for (const student of toPromote) {
        try {
          const res = await fetch(`/api/students/${student.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              classId: toClassId,
              isPromoted: true,
            }),
          });
          if (res.ok) promoted++;
        } catch {
          // skip failed
        }
        setPromotionProgress((promoted / total) * 100);
      }

      const newRecords: PromotionRecord[] = toPromote.map(s => ({
        id: `pr-${Date.now()}-${s.id}`,
        academicYear: selectedYear,
        term: selectedTerm,
        studentName: s.name,
        fromClass: selectedFromClass,
        toClass: selectedToClass,
        date: new Date().toISOString().split('T')[0],
        status: 'completed' as const,
      }));

      setPromotionHistory(prev => [...newRecords, ...prev]);
      setPromotionComplete(true);
      toast.success(`Successfully promoted ${promoted} of ${total} students to ${selectedToClass}`);
      fetchData();
    } catch {
      toast.error('Failed to complete promotion');
    } finally {
      setIsPromoting(false);
    }
  };

  const handleUndoLast = () => {
    if (promotionHistory.length === 0) return;
    setPromotionHistory(prev => {
      const updated = [...prev];
      updated[0] = { ...updated[0], status: 'undone' };
      return updated;
    });
    toast.info('Last promotion has been undone');
  };

  const resetWizard = () => {
    setCurrentStep(0);
    setSelectedYear('');
    setSelectedTerm('');
    setSelectedFromClass('');
    setSelectedToClass('');
    setPromotionStudents([]);
    setPromotionComplete(false);
  };

  const suggestedToClass = selectedFromClass ? classProgression[selectedFromClass] || '' : '';

  if (isLoadingData) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <div>
            <Skeleton className="h-7 w-64 mb-1" />
            <Skeleton className="h-4 w-72" />
          </div>
        </div>
        <Card><CardContent className="pt-6"><Skeleton className="h-20 w-full" /></CardContent></Card>
        <Card><CardContent className="pt-6"><Skeleton className="h-96 w-full" /></CardContent></Card>
      </div>
    );
  }

  if (dataError) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-purple-100">
            <GraduationCap className="h-6 w-6 text-purple-700" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Student Promotion & Graduation</h2>
            <p className="text-sm text-gray-500">Promote students between classes at the end of a term</p>
          </div>
        </div>
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-red-500 mb-4">{dataError}</p>
            <Button onClick={fetchData} variant="outline" className="gap-2">
              <Loader2 className="h-4 w-4" /> Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-purple-100">
            <GraduationCap className="h-6 w-6 text-purple-700" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Student Promotion & Graduation</h2>
            <p className="text-sm text-gray-500">Promote students between classes at the end of a term</p>
          </div>
        </div>
        <Button variant="outline" onClick={handleUndoLast} disabled={promotionHistory.length === 0} className="gap-2">
          <Undo2 className="h-4 w-4" />
          Undo Last
        </Button>
      </div>

      {/* Progress Indicator */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            {steps.map((step, i) => (
              <div key={i} className="flex items-center">
                <div className="flex flex-col items-center">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                    i < currentStep ? 'bg-emerald-500 text-white' :
                    i === currentStep ? 'bg-purple-500 text-white' :
                    'bg-gray-100 text-gray-500'
                  }`}>
                    {i < currentStep ? <CheckCircle className="h-5 w-5" /> : step.icon}
                  </div>
                  <span className={`text-xs mt-1 font-medium ${i <= currentStep ? 'text-gray-900' : 'text-gray-400'}`}>
                    {step.label}
                  </span>
                </div>
                {i < steps.length - 1 && (
                  <div className={`w-16 lg:w-24 h-0.5 mx-2 mt-[-20px] ${i < currentStep ? 'bg-emerald-500' : 'bg-gray-200'}`} />
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Step Content */}
      <Card>
        <CardContent className="pt-6">
          {/* Step 1: Academic Year & Term */}
          {currentStep === 0 && (
            <div className="space-y-4 max-w-md">
              <h3 className="text-lg font-semibold">Select Academic Period</h3>
              <p className="text-sm text-gray-500">Choose the academic year and term for the promotion</p>
               <div>
                 <label className="text-sm font-medium mb-2 block">Academic Year</label>
                 <Select value={selectedYear} onValueChange={setSelectedYear}>
                   <SelectTrigger><SelectValue placeholder="Select year" /></SelectTrigger>
                   <SelectContent>
                     {academicYears.map(year => (
                       <SelectItem key={year.id} value={year.id}>
                         {year.name} {year.isCurrent ? '(Current)' : ''}
                       </SelectItem>
                     ))}
                   </SelectContent>
                 </Select>
               </div>
               {selectedYear && (
                 <div>
                   <label className="text-sm font-medium mb-2 block">Term</label>
                   <Select value={selectedTerm} onValueChange={setSelectedTerm}>
                     <SelectTrigger><SelectValue placeholder="Select term" /></SelectTrigger>
                     <SelectContent>
                       {terms
                         .filter(term => term.academicYearId === selectedYear)
                         .map(term => (
                           <SelectItem key={term.id} value={term.name}>
                             {term.name}
                           </SelectItem>
                         ))}
                     </SelectContent>
                   </Select>
                 </div>
               )}
            </div>
          )}

          {/* Step 2: Select Class */}
          {currentStep === 1 && (
            <div className="space-y-4 max-w-md">
              <h3 className="text-lg font-semibold">Select Class to Promote From</h3>
              <p className="text-sm text-gray-500">Choose the class whose students will be promoted</p>
              <Select value={selectedFromClass} onValueChange={(v) => { setSelectedFromClass(v); setPromotionStudents([]); }}>
                <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
                <SelectContent>
                  {classNames.map(c => (
                    <SelectItem key={c} value={c}>
                      {c} ({getStudentCountForClass(c)} students)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedFromClass && (
                <div className="p-3 rounded-lg bg-gray-50">
                  <p className="text-sm text-gray-600">
                    <strong>{getStudentCountForClass(selectedFromClass)}</strong> students found in {selectedFromClass}
                  </p>
                  {suggestedToClass && (
                    <p className="text-xs text-gray-400 mt-1">
                      Suggested destination: <strong>{suggestedToClass}</strong>
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Step 3: Review Students */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">Review Students</h3>
                  <p className="text-sm text-gray-500">
                    {promotionStudents.length} students | {promotionStudents.filter(s => s.selected).length} selected
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={handleSelectAllPassing} className="gap-1">
                  <CheckCircle className="h-3.5 w-3.5" /> Select All Passing
                </Button>
              </div>

              <div className="flex gap-4 text-sm">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full bg-emerald-500" />
                  <span className="text-gray-500">Pass (GPA ≥ 2.0)</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  <span className="text-gray-500">Fail</span>
                </div>
              </div>

              <ScrollArea className="max-h-[400px]">
                {classStudents.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Users className="h-10 w-10 mx-auto mb-2 text-gray-300" />
                    <p>No students found in {selectedFromClass}.</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10"></TableHead>
                        <TableHead>Student</TableHead>
                        <TableHead className="text-center">GPA</TableHead>
                        <TableHead className="text-center">Behavior</TableHead>
                        <TableHead className="text-center">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(promotionStudents.length > 0 ? promotionStudents : classStudents).map(student => (
                        <TableRow key={student.id} className={student.selected ? 'bg-emerald-50/50' : ''}>
                          <TableCell>
                            <Checkbox
                              checked={student.selected}
                              onCheckedChange={() => handleToggleStudent(student.id)}
                            />
                          </TableCell>
                          <TableCell className="font-medium">{student.name}</TableCell>
                          <TableCell className="text-center">
                            <span className={`font-medium ${student.gpa >= 3.5 ? 'text-emerald-600' : student.gpa >= 2.5 ? 'text-amber-600' : 'text-red-600'}`}>
                              {student.gpa.toFixed(1)}
                            </span>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant={student.behaviorScore >= 90 ? 'default' : student.behaviorScore >= 75 ? 'secondary' : 'destructive'} className="text-xs">
                              {student.behaviorScore}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            {student.passed ? (
                              <Badge className="bg-emerald-100 text-emerald-700 gap-1 text-xs">
                                <CheckCircle className="h-3 w-3" /> Pass
                              </Badge>
                            ) : (
                              <Badge className="bg-red-100 text-red-700 gap-1 text-xs">
                                <XCircle className="h-3 w-3" /> Fail
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </ScrollArea>
            </div>
          )}

          {/* Step 4: Destination Class */}
          {currentStep === 3 && (
            <div className="space-y-4 max-w-md">
              <h3 className="text-lg font-semibold">Select Destination Class</h3>
              <p className="text-sm text-gray-500">
                Choose the class to promote {promotionStudents.filter(s => s.selected).length} students to
              </p>
              <Select value={selectedToClass} onValueChange={setSelectedToClass}>
                <SelectTrigger><SelectValue placeholder="Select destination class" /></SelectTrigger>
                <SelectContent>
                  {classNames.filter(c => c !== selectedFromClass).map(c => (
                    <SelectItem key={c} value={c}>{c} {c === suggestedToClass ? '(Recommended)' : ''}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Step 5: Confirm */}
          {currentStep === 4 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Confirm Promotion</h3>

              {promotionComplete ? (
                <div className="text-center py-8">
                  <CheckCircle className="h-16 w-16 mx-auto text-emerald-500 mb-4" />
                  <h4 className="text-xl font-bold text-gray-900">Promotion Complete!</h4>
                  <p className="text-gray-500 mt-2">
                    {promotionStudents.filter(s => s.selected).length} students have been promoted from {selectedFromClass} to {selectedToClass}
                  </p>
                  <Button onClick={resetWizard} className="mt-6">
                    <GraduationCap className="h-4 w-4 mr-2" /> New Promotion
                  </Button>
                </div>
              ) : (
                <>
                  <Card className="border-purple-200 bg-purple-50/30">
                    <CardContent className="pt-6 space-y-3">
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <span className="text-gray-500">Academic Year</span>
                          <p className="font-medium">{selectedYear}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">Term</span>
                          <p className="font-medium">{selectedTerm}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">From Class</span>
                          <p className="font-medium">{selectedFromClass}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">To Class</span>
                          <p className="font-medium">{selectedToClass}</p>
                        </div>
                      </div>
                      <Separator />
                      <div>
                        <span className="text-sm text-gray-500">Students to promote</span>
                        <div className="mt-2 space-y-1">
                          {promotionStudents.filter(s => s.selected).map(s => (
                            <div key={s.id} className="flex items-center justify-between text-sm">
                              <span>{s.name}</span>
                              <Badge variant="outline" className="text-xs">GPA: {s.gpa.toFixed(1)}</Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {isPromoting && (
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Promoting students...</span>
                        <span className="font-medium">{Math.round(promotionProgress)}%</span>
                      </div>
                      <Progress value={promotionProgress} className="h-2" />
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Button onClick={handleConfirmPromotion} disabled={isPromoting || promotionComplete} className="gap-2">
                      {isPromoting ? (
                        <><Loader2 className="h-4 w-4 animate-spin" /> Processing...</>
                      ) : (
                        <><CheckCircle className="h-4 w-4" /> Confirm Promotion</>
                      )}
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Navigation */}
          {!promotionComplete && (
            <div className="flex justify-between mt-6 pt-4 border-t">
              <Button variant="outline" onClick={handleBack} disabled={currentStep === 0} className="gap-2">
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>
              {currentStep < 4 && (
                <Button onClick={handleNext} className="gap-2">
                  Next <ArrowRight className="h-4 w-4" />
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Promotion History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Trophy className="h-5 w-5 text-amber-500" />
            Promotion History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {promotionHistory.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">No promotion history yet.</p>
          ) : (
            <ScrollArea className="max-h-64">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>From</TableHead>
                    <TableHead>To</TableHead>
                    <TableHead>Academic Year</TableHead>
                    <TableHead>Term</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {promotionHistory.map(record => (
                    <TableRow key={record.id}>
                      <TableCell className="font-medium">{record.studentName}</TableCell>
                      <TableCell><Badge variant="outline">{record.fromClass}</Badge></TableCell>
                      <TableCell><Badge variant="outline">{record.toClass}</Badge></TableCell>
                      <TableCell className="text-sm">{record.academicYear}</TableCell>
                      <TableCell className="text-sm">{record.term}</TableCell>
                      <TableCell className="text-sm text-gray-500">{record.date}</TableCell>
                      <TableCell>
                        {record.status === 'completed' ? (
                          <Badge className="bg-emerald-100 text-emerald-700 text-xs gap-1">
                            <CheckCircle className="h-3 w-3" /> Done
                          </Badge>
                        ) : (
                          <Badge className="bg-gray-100 text-gray-500 text-xs gap-1">
                            <Undo2 className="h-3 w-3" /> Undone
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
