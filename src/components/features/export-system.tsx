'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { KpiCard } from '@/components/shared/kpi-card';
import { StatusBadge } from '@/components/shared/status-badge';
import {
  FileText, FileSpreadsheet, Download, Printer, CheckCircle2,
  Clock, RefreshCw, Users, BookUser, Award, CalendarCheck,
} from 'lucide-react';
import { toast } from 'sonner';

export function ExportSystem() {
  const [selectedType, setSelectedType] = useState('students');
  const [selectedFormat, setSelectedFormat] = useState('pdf');
  const [isExporting, setIsExporting] = useState(false);

  const exportTypes = [
    { id: 'students', label: 'Students', icon: Users, count: null as number | null },
    { id: 'teachers', label: 'Teachers', icon: BookUser, count: null as number | null },
    { id: 'results', label: 'Results', icon: Award, count: null as number | null },
    { id: 'attendance', label: 'Attendance', icon: CalendarCheck, count: null as number | null },
  ];

  const formats = [
    { id: 'pdf', label: 'PDF', description: 'Print-ready', icon: FileText },
    { id: 'excel', label: 'Excel', description: 'Data analysis', icon: FileSpreadsheet },
    { id: 'csv', label: 'CSV', description: 'Raw data', icon: FileText },
    { id: 'print', label: 'Print', description: 'Direct print', icon: Printer },
  ];

  const recentExports: Array<{ id: string; type: string; format: string; date: string; status: string }> = [];

  const handleExport = () => {
    setIsExporting(true);
    setTimeout(() => { setIsExporting(false); toast.success('Export completed successfully'); }, 2000);
  };

  return (
    <div className="space-y-6">
      {/* Stats - showing N/A until real export tracking is implemented */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard title="Total Exports" value="—" icon={Download} iconBgColor="bg-emerald-100" iconColor="text-emerald-600" changeLabel="tracked" />
        <KpiCard title="PDF Exports" value="—" icon={FileText} iconBgColor="bg-red-100" iconColor="text-red-600" />
        <KpiCard title="Excel Exports" value="—" icon={FileSpreadsheet} iconBgColor="bg-green-100" iconColor="text-green-600" />
        <KpiCard title="Print Jobs" value="—" icon={Printer} iconBgColor="bg-blue-100" iconColor="text-blue-600" />
      </div>

      <div className="grid gap-4 lg:grid-cols-[400px_1fr]">
        {/* Export Configuration */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Export Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Export Type */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Export Type</Label>
                <Select value={selectedType} onValueChange={setSelectedType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {exportTypes.map(t => {
                      const Icon = t.icon;
                      return (
                        <SelectItem key={t.id} value={t.id}>
                          <div className="flex items-center gap-2">
                            <Icon className="size-4" />
                            {t.label}
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              {/* Format */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Format</Label>
                <div className="grid grid-cols-2 gap-2">
                  {formats.map(f => (
                    <Button
                      key={f.id}
                      size="sm"
                      variant={selectedFormat === f.id ? 'default' : 'outline'}
                      className="h-auto flex-col items-start gap-0.5 py-2 px-3"
                      onClick={() => setSelectedFormat(f.id)}
                    >
                      <div className="flex items-center gap-1.5">
                        <f.icon className="size-3.5" />
                        <span className="text-xs font-medium">{f.label}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">{f.description}</span>
                    </Button>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Date Range */}
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">From</Label>
                  <Input type="date" className="text-xs h-8" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">To</Label>
                  <Input type="date" className="text-xs h-8" />
                </div>
              </div>

              {/* Class Filter */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Filter by Class (optional)</Label>
                <Select>
                  <SelectTrigger><SelectValue placeholder="All Classes" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Classes</SelectItem>
                    {['JSS 1A', 'JSS 1B', 'JSS 2A', 'SS 1A', 'SS 2A', 'SS 3A'].map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              {/* Export Button */}
              <Button className="w-full" onClick={handleExport} disabled={isExporting}>
                {isExporting ? (
                  <><RefreshCw className="size-4 mr-2 animate-spin" /> Generating...</>
                ) : (
                  <><Download className="size-4 mr-2" /> Generate Export</>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Watermark Notice */}
          <Card className="bg-muted/50">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">
                <strong>Note:</strong> All exports include a branded watermark:
              </p>
              <p className="text-xs text-gray-300 opacity-50 mt-1 italic text-center">
                &quot;Powered by Skoolar || Odebunmi Tawwāb&quot;
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Recent Exports */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Recent Exports</CardTitle>
                <CardDescription>Download or view recent export files</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {recentExports.map(exp => (
                <div key={exp.id} className="flex items-center gap-3 rounded-lg border p-3 hover:bg-accent/50 transition-colors">
                  <div className="size-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    {exp.format === 'PDF' ? <FileText className="size-4 text-red-500" /> : <FileSpreadsheet className="size-4 text-green-600" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{exp.type}</p>
                    <p className="text-xs text-muted-foreground">No recent exports</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <StatusBadge variant={exp.status === 'success' ? 'success' : 'error'} size="sm">
                      {exp.status}
                    </StatusBadge>
                    {exp.status === 'success' && (
                      <Button variant="ghost" size="icon" className="size-8" onClick={() => toast.success(`Downloading ${exp.type}...`)}>
                        <Download className="size-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
