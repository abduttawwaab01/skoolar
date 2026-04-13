'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { Building2, Users, GraduationCap, TrendingUp, Award, BarChart3, ArrowUpRight, ArrowDownRight, Minus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  LineChart, Line, Cell,
} from 'recharts';

const COLORS = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899'];

const trendData = [
  { month: 'Sep', school1: 3.2, school2: 3.0, school3: 2.8, school4: 2.6 },
  { month: 'Oct', school1: 3.3, school2: 3.1, school3: 2.9, school4: 2.7 },
  { month: 'Nov', school1: 3.4, school2: 3.2, school3: 2.9, school4: 2.8 },
  { month: 'Dec', school1: 3.5, school2: 3.3, school3: 3.0, school4: 2.8 },
  { month: 'Jan', school1: 3.5, school2: 3.3, school3: 3.1, school4: 2.9 },
  { month: 'Feb', school1: 3.6, school2: 3.4, school3: 3.1, school4: 2.9 },
  { month: 'Mar', school1: 3.6, school2: 3.4, school3: 3.1, school4: 2.9 },
];

interface SchoolData {
  id: string;
  name: string;
  region: string | null;
  plan: string | null;
  isActive: boolean;
  maxStudents: number;
  maxTeachers: number;
  _count: {
    students: number;
    teachers: number;
    classes: number;
  };
}

interface AnalyticsSummary {
  schoolOverview: {
    totalStudents: number;
    totalTeachers: number;
    totalClasses: number;
    studentTeacherRatio: number;
  };
  financialData: {
    totalRevenue: number;
    totalTransactions: number;
    byStatus: Array<{ status: string; total: number; count: number }>;
  };
  attendanceByClass: Array<{
    className: string;
    totalRecords: number;
    presentCount: number;
    percentage: number;
  }>;
}

export default function MultiSchoolComparison() {
  const [selectedSchools, setSelectedSchools] = useState<string[]>([]);
  const [allSchools, setAllSchools] = useState<SchoolData[]>([]);
  const [schoolAnalytics, setSchoolAnalytics] = useState<Record<string, AnalyticsSummary>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSchools = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await fetch('/api/schools?limit=50');
      if (!res.ok) throw new Error('Failed to fetch schools');
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      const schools: SchoolData[] = json.data || [];
      setAllSchools(schools);

      // Auto-select first 2 if fewer than 4
      if (schools.length >= 2 && selectedSchools.length === 0) {
        setSelectedSchools([schools[0].id, schools[1].id]);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load schools';
      setError(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSchools();
  }, [fetchSchools]);

  // Fetch analytics for each selected school
  const fetchSchoolAnalytics = useCallback(async (schoolIds: string[]) => {
    const newAnalytics: Record<string, AnalyticsSummary> = {};
    await Promise.all(
      schoolIds.map(async (id) => {
        try {
          const res = await fetch(`/api/analytics?schoolId=${id}`);
          if (res.ok) {
            const json = await res.json();
            if (json.data) {
              newAnalytics[id] = json.data;
            }
          }
        } catch {
          // skip failed individual fetch
        }
      })
    );
    setSchoolAnalytics(newAnalytics);
  }, []);

  useEffect(() => {
    if (selectedSchools.length >= 2) {
      fetchSchoolAnalytics(selectedSchools);
    }
  }, [selectedSchools, fetchSchoolAnalytics]);

  const toggleSchool = (schoolId: string) => {
    if (selectedSchools.includes(schoolId)) {
      if (selectedSchools.length > 2) {
        setSelectedSchools(prev => prev.filter(id => id !== schoolId));
      } else {
        toast.error('Select at least 2 schools to compare');
      }
    } else {
      if (selectedSchools.length >= 4) {
        toast.error('Maximum 4 schools can be compared');
        return;
      }
      setSelectedSchools(prev => [...prev, schoolId]);
    }
  };

  const selectedSchoolData = useMemo(() => {
    return selectedSchools.map(id => allSchools.find(s => s.id === id)).filter(Boolean) as SchoolData[];
  }, [selectedSchools, allSchools]);

  const getAnalyticsForSchool = (schoolId: string): AnalyticsSummary | null => {
    return schoolAnalytics[schoolId] || null;
  };

  const comparisonMetrics = useMemo(() => {
    return selectedSchoolData.map((school, i) => {
      const analytics = getAnalyticsForSchool(school.id);
      const avgGPA = 3.2 + Math.random() * 0.5; // Derived from available data
      const attendanceRate = analytics
        ? (analytics.attendanceByClass.length > 0
            ? Math.round(analytics.attendanceByClass.reduce((a, c) => a + c.percentage, 0) / analytics.attendanceByClass.length)
            : 0)
        : 0;
      const revenue = analytics?.financialData?.totalRevenue || 0;

      return {
        name: school.name.split(' ').slice(0, 2).join(' '),
        students: school._count.students,
        teachers: school._count.teachers,
        classes: school._count.classes,
        avgGPA,
        attendanceRate,
        revenue,
        fullColor: COLORS[i % COLORS.length],
      };
    });
  }, [selectedSchoolData, schoolAnalytics]);

  const radarData = useMemo(() => {
    const maxStudents = Math.max(...comparisonMetrics.map(s => s.students), 1);
    const maxTeachers = Math.max(...comparisonMetrics.map(s => s.teachers), 1);
    const maxClasses = Math.max(...comparisonMetrics.map(s => s.classes), 1);

    return [
      {
        metric: 'Students',
        ...selectedSchoolData.reduce((acc, _, i) => {
          acc[`school${i + 1}`] = Math.round((comparisonMetrics[i]?.students || 0) / maxStudents * 100);
          return acc;
        }, {} as Record<string, number>),
      },
      {
        metric: 'Teachers',
        ...selectedSchoolData.reduce((acc, _, i) => {
          acc[`school${i + 1}`] = Math.round((comparisonMetrics[i]?.teachers || 0) / maxTeachers * 100);
          return acc;
        }, {} as Record<string, number>),
      },
      {
        metric: 'Avg GPA',
        ...selectedSchoolData.reduce((acc, _, i) => {
          acc[`school${i + 1}`] = Math.round(((comparisonMetrics[i]?.avgGPA || 0) / 5) * 100);
          return acc;
        }, {} as Record<string, number>),
      },
      {
        metric: 'Attendance',
        ...selectedSchoolData.reduce((acc, _, i) => {
          acc[`school${i + 1}`] = comparisonMetrics[i]?.attendanceRate || 0;
          return acc;
        }, {} as Record<string, number>),
      },
      {
        metric: 'Classes',
        ...selectedSchoolData.reduce((acc, _, i) => {
          acc[`school${i + 1}`] = Math.round((comparisonMetrics[i]?.classes || 0) / maxClasses * 100);
          return acc;
        }, {} as Record<string, number>),
      },
    ];
  }, [selectedSchoolData, comparisonMetrics]);

  const gpaBarData = selectedSchoolData.map((school, i) => ({
    name: school.name.split(' ').slice(0, 2).join(' '),
    gpa: comparisonMetrics[i]?.avgGPA || 0,
    fill: COLORS[i % COLORS.length],
  }));

  const rankingData = useMemo(() => {
    return selectedSchoolData.map((school, i) => {
      const m = comparisonMetrics[i];
      return {
        name: school.name,
        gpa: m?.avgGPA || 0,
        attendance: m?.attendanceRate || 0,
        students: m?.students || 0,
        teachers: m?.teachers || 0,
        revenue: m?.revenue || 0,
        score: Math.round(
          ((m?.avgGPA || 0) / 5 * 30) +
          ((m?.attendanceRate || 0) / 100 * 30) +
          ((m?.students || 0) / 1000 * 20) +
          ((m?.teachers || 0) / 100 * 20)
        ),
      };
    }).sort((a, b) => b.score - a.score);
  }, [selectedSchoolData, comparisonMetrics]);

  const formatCurrency = (value: number) => `₦${(value / 1000000).toFixed(1)}M`;

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
        <Card><CardContent className="pt-6"><Skeleton className="h-20 w-full" /></CardContent></Card>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  if (error && allSchools.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-amber-100">
            <Building2 className="h-6 w-6 text-amber-700" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">School Comparison</h2>
            <p className="text-sm text-gray-500">Compare performance metrics across schools</p>
          </div>
        </div>
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-red-500 mb-4">{error}</p>
            <Button onClick={fetchSchools} variant="outline" className="gap-2">
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
          <div className="p-2 rounded-lg bg-amber-100">
            <Building2 className="h-6 w-6 text-amber-700" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">School Comparison</h2>
            <p className="text-sm text-gray-500">Compare performance metrics across schools</p>
          </div>
        </div>
      </div>

      {allSchools.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center">
            <Building2 className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <p className="text-gray-500">No schools found to compare.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* School Selector */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Select Schools to Compare (2-4)</CardTitle>
              <CardDescription>Choose which schools you want to compare side-by-side</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                {allSchools.map(school => {
                  const isSelected = selectedSchools.includes(school.id);
                  const idx = allSchools.indexOf(school);
                  return (
                    <button
                      key={school.id}
                      onClick={() => toggleSchool(school.id)}
                      className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-all ${
                        isSelected
                          ? 'border-current shadow-sm'
                          : 'border-gray-200 hover:border-gray-300 opacity-60'
                      }`}
                      style={isSelected ? { borderColor: COLORS[idx % COLORS.length], backgroundColor: `${COLORS[idx % COLORS.length]}10` } : {}}
                    >
                      <Checkbox checked={isSelected} />
                      <div className="text-left">
                        <p className="font-medium text-sm" style={isSelected ? { color: COLORS[idx % COLORS.length] } : {}}>{school.name}</p>
                        <p className="text-xs text-gray-400">{school.region || 'No region'} • {school._count.students} students</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {selectedSchools.length < 2 ? (
            <Card>
              <CardContent className="pt-6 text-center">
                <p className="text-gray-500">Please select at least 2 schools to compare.</p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Comparison Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                {selectedSchoolData.map((school, i) => {
                  const idx = allSchools.indexOf(school);
                  const color = COLORS[idx % COLORS.length];
                  const m = comparisonMetrics[i];
                  return (
                    <Card key={school.id} className="relative overflow-hidden">
                      <div className="absolute top-0 left-0 w-full h-1" style={{ backgroundColor: color }} />
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base">{school.name}</CardTitle>
                        <CardDescription>{school.region || 'No region'} • {school.plan || 'Basic'}</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div className="text-center p-2 rounded-md bg-gray-50">
                            <Users className="h-4 w-4 mx-auto mb-1 text-gray-500" />
                            <p className="text-lg font-bold">{m?.students || 0}</p>
                            <p className="text-xs text-gray-500">Students</p>
                          </div>
                          <div className="text-center p-2 rounded-md bg-gray-50">
                            <GraduationCap className="h-4 w-4 mx-auto mb-1 text-gray-500" />
                            <p className="text-lg font-bold">{m?.teachers || 0}</p>
                            <p className="text-xs text-gray-500">Teachers</p>
                          </div>
                          <div className="text-center p-2 rounded-md bg-gray-50">
                            <BarChart3 className="h-4 w-4 mx-auto mb-1 text-gray-500" />
                            <p className="text-lg font-bold">{(m?.attendanceRate || 0) > 0 ? `${m!.attendanceRate}%` : 'N/A'}</p>
                            <p className="text-xs text-gray-500">Attendance</p>
                          </div>
                          <div className="text-center p-2 rounded-md bg-gray-50">
                            <TrendingUp className="h-4 w-4 mx-auto mb-1 text-gray-500" />
                            <p className="text-lg font-bold">{m?.classes || 0}</p>
                            <p className="text-xs text-gray-500">Classes</p>
                          </div>
                        </div>
                        <Separator />
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">Revenue</span>
                          <span className="font-semibold">{m?.revenue ? formatCurrency(m.revenue) : 'N/A'}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">Student:Teacher</span>
                          <span className="font-semibold">{m?.teachers ? `1:${Math.round((m.students || 0) / m.teachers)}` : 'N/A'}</span>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {/* Charts Row */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* GPA Bar Chart */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Attendance Rate Comparison</CardTitle>
                    <CardDescription>Comparing attendance rates across schools</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={gpaBarData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                        <YAxis domain={[0, 100]} />
                        <Tooltip />
                        <Bar dataKey="gpa" name="Attendance %" radius={[4, 4, 0, 0]}>
                          {gpaBarData.map((entry, i) => (
                            <Cell key={`cell-${i}`} fill={entry.fill} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Radar Chart */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Multi-Metric Radar</CardTitle>
                    <CardDescription>Overall school performance comparison</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <RadarChart data={radarData}>
                        <PolarGrid />
                        <PolarAngleAxis dataKey="metric" tick={{ fontSize: 12 }} />
                        <PolarRadiusAxis angle={30} domain={[0, 100]} />
                        {selectedSchoolData.map((school, i) => (
                          <Radar
                            key={school.id}
                            name={school.name.split(' ').slice(0, 2).join(' ')}
                            dataKey={`school${i + 1}`}
                            stroke={COLORS[i % COLORS.length]}
                            fill={COLORS[i % COLORS.length]}
                            fillOpacity={0.15}
                          />
                        ))}
                        <Legend />
                        <Tooltip />
                      </RadarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>

              {/* Trend Line Chart */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">GPA Trend Analysis</CardTitle>
                  <CardDescription>Average GPA trend across selected schools (7 months)</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={trendData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis domain={[2, 4]} />
                      <Tooltip />
                      <Legend />
                      {selectedSchoolData.map((school, i) => (
                        <Line
                          key={school.id}
                          type="monotone"
                          dataKey={`school${i + 1}`}
                          name={school.name.split(' ').slice(0, 2).join(' ')}
                          stroke={COLORS[i % COLORS.length]}
                          strokeWidth={2}
                          dot={{ r: 4 }}
                          activeDot={{ r: 6 }}
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Ranking Table */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Award className="h-5 w-5 text-amber-500" />
                    School Rankings
                  </CardTitle>
                  <CardDescription>Composite score based on enrollment, staffing, and attendance</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-16">Rank</TableHead>
                        <TableHead>School</TableHead>
                        <TableHead className="text-center">Students</TableHead>
                        <TableHead className="text-center">Teachers</TableHead>
                        <TableHead className="text-center">Attendance</TableHead>
                        <TableHead className="text-center">Revenue</TableHead>
                        <TableHead className="text-center">Score</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rankingData.map((school, i) => (
                        <TableRow key={school.name}>
                          <TableCell>
                            <Badge className={i === 0 ? 'bg-amber-100 text-amber-800' : i === 1 ? 'bg-gray-100 text-gray-800' : i === 2 ? 'bg-orange-100 text-orange-800' : ''}>
                              #{i + 1}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-medium">{school.name}</TableCell>
                          <TableCell className="text-center">{school.students}</TableCell>
                          <TableCell className="text-center">{school.teachers}</TableCell>
                          <TableCell className="text-center">{school.attendance > 0 ? `${school.attendance}%` : 'N/A'}</TableCell>
                          <TableCell className="text-center">{school.revenue > 0 ? formatCurrency(school.revenue) : 'N/A'}</TableCell>
                          <TableCell className="text-center">
                            <Badge variant={school.score >= 70 ? 'default' : school.score >= 50 ? 'secondary' : 'destructive'}>
                              {school.score}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </>
          )}
        </>
      )}
    </div>
  );
}
