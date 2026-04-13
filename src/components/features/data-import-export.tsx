'use client';

import { useState, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { Upload, Download, FileSpreadsheet, FileText, CheckCircle, AlertCircle, Clock, Calendar, X, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';

interface CSVRow {
  [key: string]: string;
}

const importTypes = ['Students', 'Teachers', 'Attendance', 'Grades', 'Payments'];
const exportTypes = [
  { id: 'students', name: 'Students', icon: '👥', description: 'All student records with details' },
  { id: 'teachers', name: 'Teachers', icon: '👨‍🏫', description: 'Teacher profiles and assignments' },
  { id: 'attendance', name: 'Attendance', icon: '📋', description: 'Attendance records by class' },
  { id: 'grades', name: 'Grades', icon: '📊', description: 'Exam results and scores' },
  { id: 'payments', name: 'Payments', icon: '💰', description: 'Financial transactions' },
  { id: 'report-cards', name: 'Report Cards', icon: '🏆', description: 'Complete student report cards' },
  { id: 'financial', name: 'Financial Summary', icon: '📈', description: 'Revenue and expenditure report' },
];

const dbFieldsByType: Record<string, string[]> = {
  Students: ['Full Name', 'Admission No', 'Class', 'Gender', 'Date of Birth', 'Parent Phone', 'Parent Email'],
  Teachers: ['Full Name', 'Subject', 'Qualification', 'Phone', 'Email', 'Classes'],
  Attendance: ['Student Name', 'Admission No', 'Date', 'Status', 'Class'],
  Grades: ['Student Name', 'Subject', 'Exam Type', 'Score', 'Term', 'Class'],
  Payments: ['Student Name', 'Amount', 'Method', 'Date', 'Status', 'Term'],
};

// Development mock data - prefix with MOCK_ to clearly indicate it's not real production data
const MOCK_EXPORT_HISTORY = [
  { id: 'eh-1', type: 'Students', format: 'CSV', date: '2025-03-28 14:30', size: '245 KB', status: 'completed' },
  { id: 'eh-2', type: 'Grades', format: 'PDF', date: '2025-03-27 11:15', size: '1.2 MB', status: 'completed' },
  { id: 'eh-3', type: 'Attendance', format: 'Excel', date: '2025-03-26 09:45', size: '89 KB', status: 'completed' },
  { id: 'eh-4', type: 'Financial Summary', format: 'PDF', date: '2025-03-25 16:00', size: '3.4 MB', status: 'completed' },
  { id: 'eh-5', type: 'Report Cards', format: 'PDF', date: '2025-03-24 13:20', size: '5.8 MB', status: 'completed' },
];

export default function DataImportExport() {
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Export state
  const [selectedExportType, setSelectedExportType] = useState('');
  const [exportFormat, setExportFormat] = useState('csv');
  const [exportDateFrom, setExportDateFrom] = useState('');
  const [exportDateTo, setExportDateTo] = useState('');
  const [exportSchedule, setExportSchedule] = useState('none');
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);

  const watermark = 'Powered by Skoolar || Odebunmi Tawwāb';

  const parseCSV = (text: string) => {
    const lines = text.trim().split('\n');
    if (lines.length < 2) return { headers: [], rows: [] };
    const headers = lines[0].split(',').map(h => h.trim());
    const rows = lines.slice(1).map(line => {
      const values = line.split(',').map(v => v.trim());
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
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const { headers, rows } = parseCSV(text);
      setCsvHeaders(headers);
      setCsvPreview(rows.slice(0, 5));

      const dbFields = dbFieldsByType[importType] || [];
      const mapping: Record<string, string> = {};
      headers.forEach(header => {
        const match = dbFields.find(f => f.toLowerCase() === header.toLowerCase() || header.toLowerCase().includes(f.toLowerCase().split(' ')[0].toLowerCase()));
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

  const handleImport = () => {
    if (!csvFile || !importType) return;
    setIsImporting(true);
    setImportProgress(0);
    const total = csvPreview.length * 10;
    let current = 0;
    const interval = setInterval(() => {
      current += 3;
      setImportProgress(Math.min((current / total) * 100, 100));
      if (current >= total) {
        clearInterval(interval);
        setIsImporting(false);
        setImportComplete(true);
        toast.success(`Successfully imported ${total} ${importType.toLowerCase()} records`);
      }
    }, 200);
  };

  const handleExport = () => {
    if (!selectedExportType) {
      toast.error('Please select an export type');
      return;
    }
    setIsExporting(true);
    setExportProgress(0);

    let current = 0;
    const interval = setInterval(() => {
      current += 5;
      setExportProgress(Math.min(current, 100));
      if (current >= 100) {
        clearInterval(interval);
        setIsExporting(false);
        toast.success(`Exported ${selectedExportType} as ${exportFormat.toUpperCase()}. ${watermark}`);
      }
    }, 150);
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
                      onClick={() => { setImportType(type); setCsvFile(null); setCsvPreview([]); setImportComplete(false); }}
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
                <CardDescription>Upload a CSV or Excel file with your data</CardDescription>
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
                  <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleFileSelect} />
                  <Upload className="h-10 w-10 mx-auto text-gray-400 mb-3" />
                  <p className="font-medium text-gray-700">Drop file here or click to browse</p>
                  <p className="text-sm text-gray-400 mt-1">Supports .csv, .xlsx, .xls files</p>
                  {csvFile && (
                    <Badge variant="secondary" className="mt-3 gap-1">
                      <FileText className="h-3 w-3" />
                      {csvFile.name} ({(csvFile.size / 1024).toFixed(1)} KB)
                    </Badge>
                  )}
                </div>

                {csvPreview.length > 0 && (
                  <>
                    {/* Preview Table */}
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
                              <ArrowRight className="h-3 w-3 text-gray-400 flex-shrink-0" />
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

                    {importComplete && (
                      <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50 text-emerald-700">
                        <CheckCircle className="h-5 w-5" />
                        <span className="text-sm font-medium">Import completed successfully!</span>
                      </div>
                    )}

                    <div className="flex gap-2">
                      <Button onClick={handleImport} disabled={!csvFile || !importType || isImporting} className="gap-2">
                        {isImporting ? 'Importing...' : <><Upload className="h-4 w-4" /> Import Data</>}
                      </Button>
                      <Button variant="outline" onClick={() => { setCsvFile(null); setCsvPreview([]); setCsvHeaders([]); setImportComplete(false); setValidationErrors([]); }}>
                        Reset
                      </Button>
                    </div>
                  </>
                )}

                <p className="text-xs text-gray-400">{watermark}</p>
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
                <CardDescription>Configure format, date range, and schedule</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Format</label>
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
                    <label className="text-sm font-medium mb-2 block">Date From</label>
                    <Input type="date" value={exportDateFrom} onChange={(e) => setExportDateFrom(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Date To</label>
                    <Input type="date" value={exportDateTo} onChange={(e) => setExportDateTo(e.target.value)} />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Schedule Export</label>
                  <Select value={exportSchedule} onValueChange={setExportSchedule}>
                    <SelectTrigger className="max-w-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No Schedule (One-time)</SelectItem>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly (Monday)</SelectItem>
                      <SelectItem value="monthly">Monthly (1st)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {exportSchedule !== 'none' && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-blue-50 text-blue-700">
                    <Clock className="h-4 w-4" />
                    <span className="text-sm">Scheduled export will be generated automatically. Check export history for downloads.</span>
                  </div>
                )}

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
                    {isExporting ? (
                      'Generating...'
                    ) : (
                      <><Download className="h-4 w-4" /> Export {selectedExportType}</>
                    )}
                  </Button>
                </div>

                <p className="text-xs text-gray-400">{watermark}</p>
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
                   {MOCK_EXPORT_HISTORY.map(exp => (
                    <TableRow key={exp.id}>
                      <TableCell className="font-medium">{exp.type}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">{exp.format}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-gray-500">{exp.date}</TableCell>
                      <TableCell className="text-sm text-gray-500">{exp.size}</TableCell>
                      <TableCell>
                        <Badge variant="default" className="bg-emerald-100 text-emerald-700 text-xs gap-1">
                          <CheckCircle className="h-3 w-3" /> {exp.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => toast.info(`Downloading ${exp.type} (${exp.format})... ${watermark}`)} className="gap-1 text-xs">
                          <Download className="h-3 w-3" /> Download
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
