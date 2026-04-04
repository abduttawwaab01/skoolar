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
  Clock, RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';

const exportTypes = [
  { id: 'report_cards', label: 'Report Cards', description: 'Student termly report cards', icon: '📄', count: 847 },
  { id: 'attendance', label: 'Attendance Reports', description: 'Student attendance data', icon: '📋', count: 245 },
  { id: 'financial', label: 'Financial Reports', description: 'Revenue and payment summaries', icon: '💰', count: 120 },
  { id: 'student_list', label: 'Student Lists', description: 'Complete student directory', icon: '👥', count: 89 },
  { id: 'teacher_list', label: 'Teacher Lists', description: 'Staff directory and assignments', icon: '👨‍🏫', count: 34 },
  { id: 'library', label: 'Library Reports', description: 'Book inventory and borrow records', icon: '📚', count: 56 },
  { id: 'audit_logs', label: 'Audit Logs', description: 'System activity logs', icon: '🔒', count: 1200 },
];

const formats = [
  { id: 'pdf', label: 'PDF', icon: FileText, description: 'Best for printing and sharing' },
  { id: 'csv', label: 'CSV', icon: FileSpreadsheet, description: 'Best for data analysis' },
  { id: 'excel', label: 'Excel', icon: FileSpreadsheet, description: 'Best for reports with charts' },
  { id: 'print', label: 'Print', icon: Printer, description: 'Direct print to printer' },
];

const recentExports = [
  { id: '1', type: 'Report Cards', format: 'PDF', size: '4.2 MB', date: '2025-03-28 14:30', status: 'success', records: 120 },
  { id: '2', type: 'Attendance Report', format: 'Excel', size: '1.8 MB', date: '2025-03-28 12:15', status: 'success', records: 847 },
  { id: '3', type: 'Financial Summary', format: 'PDF', size: '2.1 MB', date: '2025-03-27 16:45', status: 'success', records: 356 },
  { id: '4', type: 'Student Directory', format: 'CSV', size: '890 KB', date: '2025-03-27 10:00', status: 'success', records: 847 },
  { id: '5', type: 'Audit Logs', format: 'Excel', size: '12.4 MB', date: '2025-03-26 09:30', status: 'success', records: 2500 },
  { id: '6', type: 'Library Report', format: 'PDF', size: '3.5 MB', date: '2025-03-25 15:20', status: 'failed', records: 0 },
];

export function ExportSystem() {
  const [selectedType, setSelectedType] = useState('report_cards');
  const [selectedFormat, setSelectedFormat] = useState('pdf');
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = () => {
    setIsExporting(true);
    setTimeout(() => { setIsExporting(false); toast.success('Export completed successfully'); }, 2000);
  };

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard title="Total Exports" value="1,234" icon={Download} iconBgColor="bg-emerald-100" iconColor="text-emerald-600" change={15} changeLabel="this month" />
        <KpiCard title="PDF Exports" value="567" icon={FileText} iconBgColor="bg-red-100" iconColor="text-red-600" />
        <KpiCard title="Excel Exports" value="423" icon={FileSpreadsheet} iconBgColor="bg-green-100" iconColor="text-green-600" />
        <KpiCard title="Print Jobs" value="244" icon={Printer} iconBgColor="bg-blue-100" iconColor="text-blue-600" />
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
                    {exportTypes.map(t => (
                      <SelectItem key={t.id} value={t.id}>{t.icon} {t.label}</SelectItem>
                    ))}
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
                  <Input type="date" defaultValue="2025-01-01" className="text-xs h-8" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">To</Label>
                  <Input type="date" defaultValue="2025-03-31" className="text-xs h-8" />
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
                    <p className="text-xs text-muted-foreground">{exp.format} · {exp.size} · {exp.records} records · {exp.date}</p>
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
