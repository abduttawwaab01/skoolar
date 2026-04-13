'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, Filter, Clock, Bookmark, Download, X, ChevronRight, Star, User, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAppStore, DashboardView } from '@/store/app-store';

type SearchableItem = {
  id: string;
  name: string;
  type: 'student' | 'teacher' | 'class';
  details: string;
  extra: string;
  view: DashboardView;
  gender?: string;
  gpa?: number;
  attendance?: number;
  class?: string;
  subject?: string;
};

interface SavedSearch {
  id: string;
  name: string;
  query: string;
  filters: SearchFilters;
  timestamp: Date;
}

interface SearchFilters {
  role: string;
  classFilter: string;
  gender: string;
  status: string;
  gpaRange: number[];
  attendanceRange: number[];
}

interface StudentData {
  id: string;
  admissionNo: string;
  gender: string | null;
  gpa: number | null;
  isActive: boolean;
  class: { id: string; name: string; section: string | null; grade: string | null } | null;
  user: { name: string | null; email: string | null };
}

interface TeacherData {
  id: string;
  employeeNo: string;
  specialization: string | null;
  gender: string | null;
  isActive: boolean;
  _count: { classes: number; classSubjects: number; exams: number; comments: number };
  user: { name: string | null; email: string | null };
}

interface ClassData {
  id: string;
  name: string;
  grade: string | null;
  section: string | null;
  _count: { students: number; subjects: number; exams: number };
}

const recentSearchesDefault = [
  { id: 'rs-1', query: 'Search students, teachers, classes...', timestamp: new Date(Date.now() - 3600000) },
];

export default function AdvancedSearch() {
  const { selectedSchoolId, currentUser, setCurrentView } = useAppStore();
  const schoolId = selectedSchoolId || currentUser.schoolId;

  const [query, setQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<SearchFilters>({
    role: 'all',
    classFilter: 'all',
    gender: 'all',
    status: 'all',
    gpaRange: [0, 5],
    attendanceRange: [0, 100],
  });
  const [recentSearches, setRecentSearches] = useState(recentSearchesDefault);
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveName, setSaveName] = useState('');

  // Fetched data
  const [studentsData, setStudentsData] = useState<StudentData[]>([]);
  const [teachersData, setTeachersData] = useState<TeacherData[]>([]);
  const [classesData, setClassesData] = useState<ClassData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!schoolId) {
      setIsLoading(false);
      return;
    }
    try {
      setIsLoading(true);
      const [studentsRes, teachersRes, classesRes] = await Promise.all([
        fetch(`/api/students?schoolId=${schoolId}&limit=500`),
        fetch(`/api/teachers?schoolId=${schoolId}&limit=200`),
        fetch(`/api/classes?schoolId=${schoolId}&limit=200`),
      ]);

      if (!studentsRes.ok || !teachersRes.ok || !classesRes.ok) {
        throw new Error('Failed to fetch data');
      }

      const studentsJson = await studentsRes.json();
      const teachersJson = await teachersRes.json();
      const classesJson = await classesRes.json();

      if (studentsJson.error) throw new Error(studentsJson.error);
      if (teachersJson.error) throw new Error(teachersJson.error);
      if (classesJson.error) throw new Error(classesJson.error);

      setStudentsData(studentsJson.data || []);
      setTeachersData(teachersJson.data || []);
      setClassesData(classesJson.data || []);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load data';
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  }, [schoolId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Build searchable items from real data
  const allItems: SearchableItem[] = useMemo(() => {
    const items: SearchableItem[] = [];

    for (const s of studentsData) {
      items.push({
        id: s.id,
        name: s.user?.name || s.admissionNo,
        type: 'student',
        details: s.admissionNo,
        extra: s.class?.name || 'N/A',
        view: 'students',
        gender: s.gender || undefined,
        gpa: s.gpa ?? undefined,
        class: s.class?.name || undefined,
      });
    }

    for (const t of teachersData) {
      items.push({
        id: t.id,
        name: t.user?.name || t.employeeNo,
        type: 'teacher',
        details: t.specialization || 'N/A',
        extra: `${t._count?.classes || 0} classes`,
        view: 'teachers',
        gender: t.gender || undefined,
      });
    }

    for (const c of classesData) {
      items.push({
        id: c.id,
        name: c.name,
        type: 'class',
        details: `${c._count?.students || 0} students`,
        extra: c.grade || 'Class',
        view: 'classes',
      });
    }

    return items;
  }, [studentsData, teachersData, classesData]);

  // Extract class names for the filter dropdown
  const classNames = useMemo(() => classesData.map(c => c.name), [classesData]);

  const filteredResults = useMemo(() => {
    let results = allItems;

    if (query.trim()) {
      const q = query.toLowerCase();
      results = results.filter(item =>
        item.name.toLowerCase().includes(q) ||
        item.details.toLowerCase().includes(q) ||
        item.extra.toLowerCase().includes(q)
      );
    }

    if (filters.role !== 'all') {
      results = results.filter(item => item.type === filters.role);
    }
    if (filters.classFilter !== 'all') {
      results = results.filter(item => item.class === filters.classFilter || (item.type === 'class' && item.name === filters.classFilter));
    }
    if (filters.gender !== 'all') {
      results = results.filter(item => item.gender === filters.gender);
    }
    if (filters.role === 'student' || filters.role === 'all') {
      if (filters.gpaRange[0] > 0 || filters.gpaRange[1] < 5) {
        results = results.filter(item =>
          item.gpa !== undefined && item.gpa >= filters.gpaRange[0] && item.gpa <= filters.gpaRange[1]
        );
      }
      if (filters.attendanceRange[0] > 0 || filters.attendanceRange[1] < 100) {
        results = results.filter(item =>
          item.attendance !== undefined && item.attendance >= filters.attendanceRange[0] && item.attendance <= filters.attendanceRange[1]
        );
      }
    }

    return results;
  }, [query, filters, allItems]);

  const handleSearch = () => {
    if (query.trim()) {
      setRecentSearches(prev => [
        { id: `rs-${Date.now()}`, query: query.trim(), timestamp: new Date() },
        ...prev.filter(s => s.query !== query.trim()).slice(0, 9),
      ]);
    }
  };

  const handleSaveSearch = () => {
    if (!saveName.trim()) return;
    setSavedSearches(prev => [
      ...prev,
      { id: `ss-${Date.now()}`, name: saveName, query, filters: { ...filters }, timestamp: new Date() },
    ]);
    setSaveDialogOpen(false);
    setSaveName('');
    toast.success('Search saved successfully');
  };

  const loadSavedSearch = (saved: SavedSearch) => {
    setQuery(saved.query);
    setFilters(saved.filters);
    setShowFilters(true);
    toast.info(`Loaded search: "${saved.name}"`);
  };

  const handleExport = () => {
    const csvContent = [
      'Name,Type,Details,Extra,GPA,Attendance',
      ...filteredResults.map(r =>
        `"${r.name}","${r.type}","${r.details}","${r.extra}",${r.gpa || 'N/A'},${r.attendance || 'N/A'}`
      ),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `search-results-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${filteredResults.length} results`);
  };

  const clearFilters = () => {
    setFilters({ role: 'all', classFilter: 'all', gender: 'all', status: 'all', gpaRange: [0, 5], attendanceRange: [0, 100] });
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <div>
            <Skeleton className="h-7 w-48 mb-1" />
            <Skeleton className="h-4 w-72" />
          </div>
        </div>
        <Card>
          <CardContent className="pt-6">
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3">
            <Card>
              <CardHeader>
                <Skeleton className="h-6 w-32 mb-2" />
                <Skeleton className="h-4 w-64" />
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
          <div className="space-y-4">
            <Card><CardContent className="pt-6"><Skeleton className="h-32 w-full" /></CardContent></Card>
            <Card><CardContent className="pt-6"><Skeleton className="h-32 w-full" /></CardContent></Card>
          </div>
        </div>
      </div>
    );
  }

  // No school selected state
  if (!schoolId) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-100">
            <Search className="h-6 w-6 text-blue-700" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Advanced Search</h2>
            <p className="text-sm text-gray-500">Search across students, teachers, and classes</p>
          </div>
        </div>
        <Card>
          <CardContent className="pt-6 text-center py-12">
            <Search className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p className="text-gray-500 text-lg mb-2">No school selected</p>
            <p className="text-gray-400 text-sm">Please select a school to enable advanced search.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-blue-100">
          <Search className="h-6 w-6 text-blue-700" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Advanced Search</h2>
          <p className="text-sm text-gray-500">Search across students, teachers, and classes</p>
        </div>
      </div>

      {/* Search Bar */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search students, teachers, classes..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="pl-10"
              />
            </div>
            <Button variant="outline" onClick={() => setShowFilters(!showFilters)} className="gap-2">
              <Filter className="h-4 w-4" />
              Filters
            </Button>
            <Button onClick={handleSearch} className="gap-2">
              <Search className="h-4 w-4" />
              Search
            </Button>
            {query && (
              <Button variant="ghost" size="icon" onClick={() => setQuery('')}>
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Filters Panel */}
      {showFilters && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Filters</CardTitle>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setSaveDialogOpen(true)} className="gap-1 text-xs">
                  <Bookmark className="h-3 w-3" /> Save Search
                </Button>
                <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1 text-xs">
                  <X className="h-3 w-3" /> Clear
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Type</label>
                <Select value={filters.role} onValueChange={(v) => setFilters(p => ({ ...p, role: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="student">Students</SelectItem>
                    <SelectItem value="teacher">Teachers</SelectItem>
                    <SelectItem value="class">Classes</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Class</label>
                <Select value={filters.classFilter} onValueChange={(v) => setFilters(p => ({ ...p, classFilter: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Classes</SelectItem>
                    {classNames.map(c => (<SelectItem key={c} value={c}>{c}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Gender</label>
                <Select value={filters.gender} onValueChange={(v) => setFilters(p => ({ ...p, gender: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="Male">Male</SelectItem>
                    <SelectItem value="Female">Female</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Status</label>
                <Select value={filters.status} onValueChange={(v) => setFilters(p => ({ ...p, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-2">
                <label className="text-sm font-medium mb-2 block">GPA Range: {filters.gpaRange[0].toFixed(1)} - {filters.gpaRange[1].toFixed(1)}</label>
                <Slider
                  value={filters.gpaRange}
                  onValueChange={(v) => setFilters(p => ({ ...p, gpaRange: v as [number, number] }))}
                  min={0}
                  max={5}
                  step={0.1}
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-sm font-medium mb-2 block">Attendance Range: {filters.attendanceRange[0]}% - {filters.attendanceRange[1]}%</label>
                <Slider
                  value={filters.attendanceRange}
                  onValueChange={(v) => setFilters(p => ({ ...p, attendanceRange: v as [number, number] }))}
                  min={0}
                  max={100}
                  step={1}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Save Search Dialog */}
      {saveDialogOpen && (
        <Card className="border-blue-200">
          <CardContent className="pt-6">
            <div className="flex gap-2">
              <Input
                placeholder="Search name..."
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                className="flex-1"
              />
              <Button onClick={handleSaveSearch} disabled={!saveName.trim()}>Save</Button>
              <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Results */}
        <div className="lg:col-span-3">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Results ({filteredResults.length})</CardTitle>
                  <CardDescription>
                    {query ? `Showing results for "${query}"` : 'Showing all records'}
                  </CardDescription>
                </div>
                {filteredResults.length > 0 && (
                  <Button variant="outline" size="sm" onClick={handleExport} className="gap-1">
                    <Download className="h-3.5 w-3.5" /> Export
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="max-h-[500px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Details</TableHead>
                      <TableHead>Extra</TableHead>
                      <TableHead>GPA</TableHead>
                      <TableHead>Attendance</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredResults.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-gray-400">
                          <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          <p>No results found. Try adjusting your search or filters.</p>
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredResults.map(item => (
                        <TableRow key={item.id} className="cursor-pointer hover:bg-gray-50" onClick={() => setCurrentView(item.view)}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              {item.type === 'student' ? (
                                <User className="h-4 w-4 text-violet-500" />
                              ) : item.type === 'teacher' ? (
                                <Star className="h-4 w-4 text-amber-500" />
                              ) : (
                                <User className="h-4 w-4 text-emerald-500" />
                              )}
                              {item.name}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={
                              item.type === 'student' ? 'default' :
                              item.type === 'teacher' ? 'secondary' : 'outline'
                            } className="text-xs">
                              {item.type}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-gray-500">{item.details}</TableCell>
                          <TableCell className="text-sm text-gray-500">{item.extra}</TableCell>
                          <TableCell>
                            {item.gpa ? (
                              <Badge variant={item.gpa >= 3.5 ? 'default' : item.gpa >= 2.5 ? 'secondary' : 'destructive'} className="text-xs">
                                {item.gpa}
                              </Badge>
                            ) : '-'}
                          </TableCell>
                          <TableCell>
                            {item.attendance ? (
                              <span className={`text-sm ${item.attendance >= 90 ? 'text-emerald-600' : item.attendance >= 75 ? 'text-amber-600' : 'text-red-600'}`}>
                                {item.attendance}%
                              </span>
                            ) : '-'}
                          </TableCell>
                          <TableCell>
                            <ChevronRight className="h-4 w-4 text-gray-400" />
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Recent Searches */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4" /> Recent Searches
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="max-h-48">
                <div className="space-y-2">
                  {recentSearches.map(search => (
                    <button
                      key={search.id}
                      className="w-full text-left p-2 rounded-md hover:bg-gray-100 transition-colors text-sm flex items-center justify-between group"
                      onClick={() => setQuery(search.query)}
                    >
                      <span className="truncate text-gray-700">{search.query}</span>
                      <X
                        className="h-3 w-3 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 ml-2"
                        onClick={(e) => {
                          e.stopPropagation();
                          setRecentSearches(prev => prev.filter(s => s.id !== search.id));
                        }}
                      />
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Saved Searches */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Bookmark className="h-4 w-4" /> Saved Searches
              </CardTitle>
            </CardHeader>
            <CardContent>
              {savedSearches.length === 0 ? (
                <p className="text-sm text-gray-400">No saved searches yet</p>
              ) : (
                <ScrollArea className="max-h-48">
                  <div className="space-y-2">
                    {savedSearches.map(saved => (
                      <button
                        key={saved.id}
                        className="w-full text-left p-2 rounded-md hover:bg-gray-100 transition-colors text-sm"
                        onClick={() => loadSavedSearch(saved)}
                      >
                        <p className="font-medium text-gray-700">{saved.name}</p>
                        <p className="text-xs text-gray-400">{saved.query || 'All filters'}</p>
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
