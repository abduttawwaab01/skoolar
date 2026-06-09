'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Download, FileText, FileSpreadsheet, Printer, ChevronDown, FileDown } from 'lucide-react';
import { exportReport, type ExportOptions, type ExportColumn } from '@/lib/export-utils';

interface ExportMenuProps {
  options: ExportOptions;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg';
  className?: string;
}

export function ExportMenu({ options, variant = 'outline', size = 'sm', className }: ExportMenuProps) {
  const [exporting, setExporting] = useState<string | null>(null);

  const handleExport = async (format: 'pdf' | 'doc' | 'csv' | 'print') => {
    setExporting(format);
    try {
      await exportReport(options, format);
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      setExporting(null);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} size={size} className={className}>
          <FileDown className="h-4 w-4 mr-2" /> Export
          <ChevronDown className="h-3 w-3 ml-1" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={() => handleExport('pdf')} disabled={exporting === 'pdf'}>
          <FileText className="h-4 w-4 mr-2 text-red-500" />
          {exporting === 'pdf' ? 'Generating...' : 'Export as PDF'}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport('doc')} disabled={exporting === 'doc'}>
          <FileText className="h-4 w-4 mr-2 text-blue-500" />
          {exporting === 'doc' ? 'Generating...' : 'Export as DOC'}
        </DropdownMenuItem>
        {options.data && options.data.length > 0 && (
          <DropdownMenuItem onClick={() => handleExport('csv')} disabled={exporting === 'csv'}>
            <FileSpreadsheet className="h-4 w-4 mr-2 text-green-500" />
            {exporting === 'csv' ? 'Generating...' : 'Export as CSV'}
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => handleExport('print')}>
          <Printer className="h-4 w-4 mr-2" />
          Print View
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
