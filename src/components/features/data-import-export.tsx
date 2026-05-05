'use client';

import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, CheckCircle, Download, Upload, FileSpreadsheet, FileText, Clock, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAppStore } from '@/store/app-store';
import { handleSilentError } from '@/lib/error-handler';

interface CSVRow {
  [key: string]: string;
}

interface ExportRecord {
  id: string;
  type: string;
  format: string;
  date: string;
  size: string;
  status: 'completed' | 'failed' | 'processing';
  downloadUrl?: string;
}

const importTypes = ['Students', 'Teachers', 'Parents', 'Classes', 'Subjects', 'Attendance', 'Exam Scores', 'Fees'];
const dbFieldsByType: Record<string, string[]> = {
  'Students': ['admissionNo', 'firstName', 'lastName', 'email', 'gender', 'dateOfBirth', 'classId'],
  'Teachers': ['employeeNo', 'firstName', 'lastName', 'email', 'specialization', 'qualification'],
  'Parents': ['firstName', 'lastName', 'email', 'phone', 'studentAdmissionNo'],
  'Classes': ['name', 'grade', 'section', 'teacherId'],
  'Subjects': ['name', 'code', 'classId', 'teacherId'],
  'Attendance': ['admissionNo', 'date', 'status', 'remarks'],
  'Exam Scores': ['examId', 'admissionNo', 'score', 'maxMarks'],
  'Fees': ['studentId', 'amount', 'method', 'status', 'termId'],
};
const exportTypes = [
  { id: 'students', name: 'Students', description: 'Export all student records', icon: '👥' },
  { id: 'teachers', name: 'Teachers', description: 'Export teacher records', icon: '👨‍🏫' },
  { id: 'attendance', name: 'Attendance', description: 'Export attendance records', icon: '📅' },
  { id: 'payments', name: 'Payments', description: 'Export payment records', icon: '💰' },
  { id: 'exams', name: 'Exams & Results', description: 'Export exam records and results', icon: '📝' },
  { id: 'report-cards', name: 'Report Cards', description: 'Export generated report cards', icon: '🎓' },
];

export default function DataImportExport() {
  const { selectedSchoolId, currentUser } = useAppStore();
  const schoolId = selectedSchoolId || currentUser.schoolId;

  // Import state
  const [activeTab, setActiveTab] = useState('import');
  const [importType, setImportType] = useState('');
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvPreview, setCsvPreview] = useState<CSVRow[]>([]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [importComplete, setImportComplete] = useState(false);
  const [importResult, setImportResult] = useState<{ success: number; failed: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Export state
  const [selectedExportType, setSelectedExportType] = useState('');
  const [exportFormat, setExportFormat] = useState('csv');
  const [exportDateFrom, setExportDateFrom] = useState('');
  const [exportDateTo, setExportDateTo] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportHistory, setExportHistory] = useState<ExportRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  // Fetch export history
  useEffect(() => {
    if (!schoolId) {
      setHistoryLoading(false);
      return;
    }

    fetch(`/api/export/history?schoolId=${schoolId}`)
      .then(res => res.json())
      .then(json => {
        setExportHistory(json.data || []);
      })
      .catch(() => {
        // If endpoint doesn't exist yet, start with empty
        setExportHistory([]);
      })
      .finally(() => setHistoryLoading(false));
  }, [schoolId]);

  const parseCSV = (text: string) => {
    const lines = text.trim().split('\n');
    if (lines.length < 2) return { headers: [], rows: [] };
    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    const rows = lines.slice(1).map(line => {
      const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
      const row: CSVRow = {};
      headers.forEach((header, i) => {
        row[header] = values[i] || '';
      });
      return row;
    });
    return { headers, rows };
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
    else toast.error('Please upload a CSV or Excel file');
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const processFile = (file: File) => {
    setCsvFile(file);
    setImportComplete(false);
    setValidationErrors([]);
    setImportResult(null);

    if (!file.name.endsWith('.csv')) {
      toast.error('Please upload a CSV file');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const { headers, rows } = parseCSV(text);
      setCsvHeaders(headers);
      setCsvPreview(rows.slice(0, 5));

      const dbFields = dbFieldsByType[importType] || [];
      const mapping: Record<string, string> = {};
      headers.forEach(header => {
        const match = dbFields.find(f =>
          f.toLowerCase() === header.toLowerCase() ||
          header.toLowerCase().includes(f.toLowerCase().split(' ')[0])
        );
        mapping[header] = match || '';
      });
      setColumnMapping(mapping);

      if (rows.length > 0) {
        const errors: string[] = [];
        rows.forEach((row, i) => {
          if (!row[headers[0]]?.trim()) errors.push(`Row ${i + 2}: Missing required field in first column`);
        });
        if (rows.length > 1000) errors.push('Warning: File contains more than 1000 rows. Processing may take longer.');
        setValidationErrors(errors);
      }

      toast.success(`File loaded: ${rows.length} records found`);
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!csvFile || !importType || !schoolId) {
      toast.error('Please select import type and upload a file');
      return;
    }

    setIsImporting(true);
    setImportProgress(0);
    setImportComplete(false);

    const formData = new FormData();
    formData.append('file', csvFile);
    formData.append('type', importType);
    formData.append('schoolId', schoolId);
    formData.append('columnMapping', JSON.stringify(columnMapping));

    try {
      const res = await fetch('/api/import', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: 'Import failed' }));
        throw new Error(error.error || 'Import failed');
      }

      const result = await res.json();
      setImportProgress(100);
      setImportComplete(true);
      setImportResult({
        success: result.successCount || 0,
        failed: result.failedCount || 0,
      });
      toast.success(`Imported ${result.successCount || 0} records successfully`);
    } catch (err) {
      handleSilentError(err);
      toast.error(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setIsImporting(false);
    }
  };

  const handleExport = async () => {
    if (!selectedExportType || !schoolId) {
      toast.error('Please select an export type');
      return;
    }

    setIsExporting(true);
    setExportProgress(0);

    try {
      const params = new URLSearchParams({
        type: selectedExportType,
        format: exportFormat,
        schoolId,
      });
      if (exportDateFrom) params.set('from', exportDateFrom);
      if (exportDateTo) params.set('to', exportDateTo);

      // Start export
      const res = await fetch(`/api/export?${params.toString()}`, {
        method: 'POST',
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: 'Export failed' }));
        throw new Error(error.error || 'Export failed');
      }

      const result = await res.json();
      setExportProgress(100);

      // Add to history
      const newRecord: ExportRecord = {
        id: result.id || `export-${Date.now()}`,
        type: selectedExportType,
        format: exportFormat.toUpperCase(),
        date: new Date().toISOString(),
        size: result.size || 'Unknown',
        status: 'completed',
        downloadUrl: result.downloadUrl,
      };
      setExportHistory(prev => [newRecord, ...prev]);

      toast.success(`Exported ${selectedExportType} as ${exportFormat.toUpperCase()}`);

      // Auto-download if URL provided
      if (result.downloadUrl) {
        window.open(result.downloadUrl, '_blank');
      }
    } catch (err) {
      handleSilentError(err);
      toast.error(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownload = (record: ExportRecord) => {
    if (record.downloadUrl) {
      window.open(record.downloadUrl, '_blank');
    } else {
      toast.info('Download URL not available for this export');
    }
  };

  const handleDeleteHistory = async (id: string) => {
    try {
      const res = await fetch(`/api/export/history/${id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setExportHistory(prev => prev.filter(r => r.id !== id));
        toast.success('Export record deleted');
      }
    } catch {
      toast.error('Failed to delete record');
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleString('en-NG', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-cyan-100">
          <FileSpreadsheet className="h-6 w-6 text-cyan-700" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Data Import & Export</h2>
          <p className="text-sm text-gray-500">Import and export data across the platform</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="import" className="gap-2">
            <Upload className="h-4 w-4" />
            Import Data
          </TabsTrigger>
          <TabsTrigger value="export" className="gap-2">
            <Download className="h-4 w-4" />
            Export Data
          </TabsTrigger>
        </TabsList>

        {/* Import Section */}
        <TabsContent value="import" className="space-y-6">
          {/* Import Type & File Upload */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Import Type</CardTitle>
                <CardDescription>Select what type of data you want to import</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {importTypes.map(type => (
                    <button
                      key={type}
                      onClick={() => { setImportType(type); setCsvFile(null); setCsvPreview([]); setImportComplete(false); setImportResult(null); }}
                      className={`w-full text-left p-3 rounded-lg border-2 transition-all ${
                        importType === type ? 'border-cyan-500 bg-cyan-50' : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <p className="font-medium text-sm">{type}</p>
                      <p className="text-xs text-gray-400">{dbFieldsByType[type].length} fields</p>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-lg">Upload File</CardTitle>
                <CardDescription>Upload a CSV file with your data</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div
                  className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
                    isDragging ? 'border-cyan-500 bg-cyan-50' : 'border-gray-300 hover:border-cyan-400'
                  }`}
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleFileDrop}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleFileSelect} />
                  <Upload className="h-10 w-10 mx-auto text-gray-400 mb-3" />
                  <p className="font-medium text-gray-700">Drop file here or click to browse</p>
                  <p className="text-sm text-gray-400 mt-1">Supports .csv files</p>
                  {csvFile && (
                    <Badge variant="secondary" className="mt-3 gap-1">
                      <FileText className="h-3 w-3" />
                      {csvFile.name} ({(csvFile.size / 1024).toFixed(1)} KB)
                    </Badge>
                  )}
                </div>

                {/* Preview Table */}
                {csvPreview.length > 0 && (
                  <>
                    <div>
                      <h4 className="font-medium mb-2 text-sm">Preview (first 5 rows)</h4>
                      <ScrollArea className="max-h-48">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              {csvHeaders.map(header => (
                                <TableHead key={header} className="text-xs whitespace-nowrap">{header}</TableHead>
                              ))}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {csvPreview.map((row, i) => (
                              <TableRow key={i}>
                                {csvHeaders.map(header => (
                                  <TableCell key={header} className="text-xs">{row[header]}</TableCell>
                                ))}
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </ScrollArea>
                    </div>

                    {/* Column Mapping */}
                    {importType && (
                      <div>
                        <h4 className="font-medium mb-2 text-sm">Column Mapping</h4>
                        <div className="p-3 rounded-lg bg-gray-50 space-y-2">
                          {csvHeaders.map(header => (
                            <div key={header} className="flex items-center gap-2">
                              <span className="text-xs font-mono w-32 truncate">{header}</span>
                              <span className="text-gray-400">→</span>
                              <Select
                                value={columnMapping[header] || ''}
                                onValueChange={(v) => setColumnMapping(prev => ({ ...prev, [header]: v }))}
                              >
                                <SelectTrigger className="h-8 text-xs">
                                  <SelectValue placeholder="Map to field..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {(dbFieldsByType[importType] || []).map(field => (
                                    <SelectItem key={field} value={field}>{field}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Validation Errors */}
                    {validationErrors.length > 0 && (
                      <div className="space-y-1">
                        <h4 className="font-medium text-sm text-amber-600 flex items-center gap-1">
                          <AlertCircle className="h-4 w-4" /> Validation ({validationErrors.length} issues)
                        </h4>
                        <ScrollArea className="max-h-32">
                          {validationErrors.map((err, i) => (
                            <p key={i} className="text-xs text-amber-600">{err}</p>
                          ))}
                        </ScrollArea>
                      </div>
                    )}

                    {/* Import Progress */}
                    {isImporting && (
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">Importing data...</span>
                          <span className="font-medium">{Math.round(importProgress)}%</span>
                        </div>
                        <Progress value={importProgress} className="h-2" />
                      </div>
                    )}

                    {importComplete && importResult && (
                      <div className={`flex items-center gap-2 p-3 rounded-lg ${importResult.failed > 0 ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>
                        <CheckCircle className="h-5 w-5" />
                        <span className="text-sm font-medium">
                          Import completed: {importResult.success} successful, {importResult.failed} failed
                        </span>
                      </div>
                    )}

                    <div className="flex gap-2">
                      <Button onClick={handleImport} disabled={!csvFile || !importType || isImporting} className="gap-2">
                        {isImporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                        {isImporting ? 'Importing...' : 'Import Data'}
                      </Button>
                      <Button variant="outline" onClick={() => { setCsvFile(null); setCsvPreview([]); setCsvHeaders([]); setImportComplete(false); setValidationErrors([]); setImportResult(null); }}>
                        Reset
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Export Section */}
        <TabsContent value="export" className="space-y-6">
          {/* Export Type Cards */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Select Export Type</CardTitle>
              <CardDescription>Choose the type of data you want to export</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {exportTypes.map(type => (
                  <button
                    key={type.id}
                    onClick={() => setSelectedExportType(type.id)}
                    className={`text-left p-4 rounded-lg border-2 transition-all ${
                      selectedExportType === type.id ? 'border-cyan-500 bg-cyan-50 shadow-sm' : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="text-2xl mb-2">{type.icon}</div>
                    <p className="font-medium text-sm">{type.name}</p>
                    <p className="text-xs text-gray-400 mt-1">{type.description}</p>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Export Configuration */}
          {selectedExportType && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Export Configuration</CardTitle>
                <CardDescription>Configure format, date range, and options</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label className="text-sm font-medium mb-2 block">Format</Label>
                    <Select value={exportFormat} onValueChange={setExportFormat}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="csv">CSV</SelectItem>
                        <SelectItem value="pdf">PDF</SelectItem>
                        <SelectItem value="excel">Excel</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-sm font-medium mb-2 block">Date From</Label>
                    <Input type="date" value={exportDateFrom} onChange={(e) => setExportDateFrom(e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-sm font-medium mb-2 block">Date To</Label>
                    <Input type="date" value={exportDateTo} onChange={(e) => setExportDateTo(e.target.value)} />
                  </div>
                </div>

                {isExporting && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Generating export...</span>
                      <span className="font-medium">{Math.round(exportProgress)}%</span>
                    </div>
                    <Progress value={exportProgress} className="h-2" />
                  </div>
                )}

                <div className="flex gap-2">
                  <Button onClick={handleExport} disabled={isExporting} className="gap-2">
                    {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                    {isExporting ? 'Generating...' : `Export ${selectedExportType}`}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Export History */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Export History
              </CardTitle>
              <CardDescription>Previous exports available for download</CardDescription>
            </CardHeader>
            <CardContent>
              {historyLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-4 p-3">
                      <Skeleton className="h-5 w-24" />
                      <Skeleton className="h-5 w-16" />
                      <Skeleton className="h-5 w-32" />
                      <Skeleton className="h-5 w-16" />
                      <Skeleton className="h-8 w-24" />
                    </div>
                  ))}
                </div>
              ) : exportHistory.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-8">No export history found</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Format</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Size</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {exportHistory.map(exp => (
                      <TableRow key={exp.id}>
                        <TableCell className="font-medium">{exp.type}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">{exp.format}</Badge>
                        </TableCell>
                        <TableCell className="text-sm text-gray-500">{formatDate(exp.date)}</TableCell>
                        <TableCell className="text-sm text-gray-500">{exp.size}</TableCell>
                        <TableCell>
                          <Badge variant={exp.status === 'completed' ? 'default' : 'destructive'} className={`text-xs gap-1 ${exp.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : ''}`}>
                            {exp.status === 'completed' && <CheckCircle className="h-3 w-3" />}
                            {exp.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="sm" onClick={() => handleDownload(exp)} className="gap-1 text-xs">
                              <Download className="h-3 w-3" /> Download
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => handleDeleteHistory(exp.id)} className="gap-1 text-xs text-red-600">
                              <Trash2 className="h-3 w-3" /> Delete
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
