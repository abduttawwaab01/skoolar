'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { KpiCard } from '@/components/shared/kpi-card';
import { StatusBadge } from '@/components/shared/status-badge';
import {
  FileText, FileSpreadsheet, Download, Printer, CheckCircle2,
  Clock, RefreshCw, Users, BookUser, Award, CalendarCheck,
} from 'lucide-react';
import { toast } from 'sonner';

interface ExportRecord {
  id: string;
  type: string;
  format: string;
  date: string;
  status: string;
}

function escapeHtml(text: string): string {
  const d = document.createElement('div');
  d.textContent = text;
  return d.innerHTML;
}

function buildExportHtml(title: string, tableHeaders: string[], tableRows: string[][]): string {
  const headersHtml = tableHeaders.map(h => `<th style="padding:0.45rem 0.5rem;text-align:left;border:1px solid #047857;font-size:0.85rem">${escapeHtml(h)}</th>`).join('');
  const rowsHtml = tableRows.map((row, i) => {
    const bg = i % 2 === 0 ? '#fff' : '#f9fafb';
    const cells = row.map(c => `<td style="padding:0.4rem 0.5rem;border:1px solid #e5e7eb;font-size:0.83rem">${escapeHtml(c)}</td>`).join('');
    return `<tr style="background:${bg}">${cells}</tr>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif; padding: 1.5rem; line-height: 1.6; color: #333; font-size: 14px; }
    @media print { body { padding: 0.5in; } @page { margin: 0.5in; } }
  </style>
</head>
<body>
  <div style="position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:9999;overflow:hidden;">
    <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-30deg);opacity:0.035;font-size:4.5rem;font-weight:900;color:#059669;white-space:nowrap;letter-spacing:0.3rem;">Skoolar</div>
  </div>
  <h1 style="color:#059669;margin:0 0 0.25rem 0;font-size:1.3rem;text-align:center">Skoolar</h1>
  <div style="text-align:center;margin-bottom:0.5rem">
    <h2 style="color:#1B5E20;margin:0 0 0.5rem 0;font-size:1.2rem">${escapeHtml(title)}</h2>
    <p style="color:#9ca3af;font-size:0.75rem">Generated on ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
  </div>
  <div style="height:2px;background:linear-gradient(90deg,#059669,#34d399);margin-bottom:1rem;border-radius:2px"></div>
  <p style="font-size:0.85rem;color:#555;margin-bottom:0.75rem">Total Records: ${tableRows.length}</p>
  <table style="width:100%;border-collapse:collapse">
    <thead><tr style="background:#059669;color:#fff">${headersHtml}</tr></thead>
    <tbody>${rowsHtml}</tbody>
  </table>
  <div style="text-align:center;padding:0.4rem 0;border-top:1px solid #e5e7eb;margin-top:1.5rem">
    <p style="font-size:7pt;color:#bbb;font-style:italic;">Skoolar - Odebunmi Tawwāb</p>
  </div>
</body>
</html>`;
}

function openPrintWindow(html: string): void {
  const win = window.open('', '_blank');
  if (!win) { alert('Please allow popups to export.'); return; }
  win.document.write(html);
  win.document.close();
  win.onload = () => { setTimeout(() => win.print(), 300); };
}

export function ExportSystem() {
  const [selectedType, setSelectedType] = useState('students');
  const [selectedFormat, setSelectedFormat] = useState('pdf');
  const [isExporting, setIsExporting] = useState(false);
  const [recentExports, setRecentExports] = useState<ExportRecord[]>([]);

  const exportTypes = [
    { id: 'students', label: 'Students', icon: Users },
    { id: 'teachers', label: 'Teachers', icon: BookUser },
    { id: 'results', label: 'Results', icon: Award },
    { id: 'attendance', label: 'Attendance', icon: CalendarCheck },
  ];

  const formats = [
    { id: 'pdf', label: 'PDF', description: 'Print-ready', icon: FileText },
    { id: 'excel', label: 'Excel', description: 'Data analysis', icon: FileSpreadsheet },
    { id: 'csv', label: 'CSV', description: 'Raw data', icon: FileText },
    { id: 'print', label: 'Print', description: 'Direct print', icon: Printer },
  ];

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const res = await fetch(`/api/export?type=${selectedType}`);
      if (!res.ok) { throw new Error('API error'); }
      const json = await res.json();
      const records: Record<string, unknown>[] = json.data?.[selectedType === 'results' ? 'results' : selectedType] || json.data || [];

      if (selectedFormat === 'csv' || selectedFormat === 'excel') {
        const headers = records.length > 0 ? Object.keys(records[0] as Record<string, unknown>) : ['No Data'];
        const csvRows = records.map(r => headers.map(h => {
          const val = (r as Record<string, unknown>)[h];
          const str = val != null ? String(val) : '';
          return `"${str.replace(/"/g, '""')}"`;
        }));
        const csvContent = [headers.join(','), ...csvRows.map(r => r.join(','))].join('\n') + '\n# Skoolar - Odebunmi Tawwāb';
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${selectedType}-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        const headers = records.length > 0 ? Object.keys(records[0] as Record<string, unknown>) : ['No Data'];
        const rows = records.map(r => headers.map(h => {
          const val = (r as Record<string, unknown>)[h];
          return val != null ? String(val) : '';
        }));
        const title = `Skoolar ${selectedType.charAt(0).toUpperCase() + selectedType.slice(1)} Export`;
        const html = buildExportHtml(title, headers, rows);
        openPrintWindow(html);
      }

      const exportRecord: ExportRecord = {
        id: `exp-${Date.now()}`,
        type: selectedType,
        format: selectedFormat.toUpperCase(),
        date: new Date().toLocaleDateString(),
        status: 'success',
      };
      setRecentExports(prev => [exportRecord, ...prev].slice(0, 10));
      toast.success(`${selectedType} exported as ${selectedFormat.toUpperCase()}`);
    } catch {
      toast.error('Export failed');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard title="Total Exports" value={String(recentExports.length)} icon={Download} iconBgColor="bg-emerald-100" iconColor="text-emerald-600" changeLabel="this session" />
        <KpiCard title="PDF Exports" value={String(recentExports.filter(e => e.format === 'PDF').length)} icon={FileText} iconBgColor="bg-red-100" iconColor="text-red-600" />
        <KpiCard title="CSV/Excel" value={String(recentExports.filter(e => e.format === 'CSV' || e.format === 'EXCEL').length)} icon={FileSpreadsheet} iconBgColor="bg-green-100" iconColor="text-green-600" />
        <KpiCard title="Print Jobs" value={String(recentExports.filter(e => e.format === 'PRINT').length)} icon={Printer} iconBgColor="bg-blue-100" iconColor="text-blue-600" />
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
                &quot;Skoolar - Odebunmi Tawwāb&quot;
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
              {recentExports.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  No exports yet. Use the controls to generate one.
                </div>
              ) : (
                recentExports.map(exp => (
                  <div key={exp.id} className="flex items-center gap-3 rounded-lg border p-3 hover:bg-accent/50 transition-colors">
                    <div className="size-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                      {exp.format === 'PDF' || exp.format === 'PRINT' ? <FileText className="size-4 text-red-500" /> : <FileSpreadsheet className="size-4 text-green-600" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate capitalize">{exp.type}</p>
                      <p className="text-xs text-muted-foreground">{exp.format} &middot; {exp.date}</p>
                    </div>
                    <StatusBadge variant="success" size="sm">
                      <CheckCircle2 className="size-3 mr-1" /> Done
                    </StatusBadge>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
