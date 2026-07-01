'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Search, FileText, Download, Edit3, Eye, X, Save, Printer, FileDown,
  ChevronLeft, AlertCircle, Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  DOCUMENT_TEMPLATES, CATEGORIES, getPlaceholders, fillPlaceholders,
  PLACEHOLDER_DESCRIPTIONS, type DocumentTemplate, type DocumentCategory,
} from './documents.types';
import { OcrUploadButton } from '@/components/features/ocr/ocr-button';

type ViewMode = 'list' | 'editor' | 'preview';

export function DocumentsManager() {
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [activeCategory, setActiveCategory] = useState<DocumentCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDoc, setSelectedDoc] = useState<DocumentTemplate | null>(null);
  const [editedContent, setEditedContent] = useState('');
  const [downloadDialogOpen, setDownloadDialogOpen] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  const [placeholderValues, setPlaceholderValues] = useState<Record<string, string>>({});

  const filteredDocs = DOCUMENT_TEMPLATES.filter(doc => {
    const matchesCategory = activeCategory === 'all' || doc.category === activeCategory;
    const matchesSearch = !searchQuery
      || doc.title.toLowerCase().includes(searchQuery.toLowerCase())
      || doc.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const categoryCounts = CATEGORIES.map(cat => ({
    ...cat,
    count: DOCUMENT_TEMPLATES.filter(d => d.category === cat.id).length,
  }));

  const openEditor = (doc: DocumentTemplate) => {
    setSelectedDoc(doc);
    setEditedContent(doc.content);
    setViewMode('editor');
    setPreviewHtml('');
    setPlaceholderValues({});
  };

  const openPreview = () => {
    if (!selectedDoc) return;
    const placeholders = getPlaceholders(editedContent);
    const defaultValues: Record<string, string> = {};
    for (const ph of placeholders) {
      defaultValues[ph] = placeholderValues[ph] || '';
    }
    setPlaceholderValues(defaultValues);
    const html = fillPlaceholders(editedContent, defaultValues);
    setPreviewHtml(html);
    setViewMode('preview');
  };

  const backToList = () => {
    setViewMode('list');
    setSelectedDoc(null);
    setEditedContent('');
    setPreviewHtml('');
  };

  const openDownloadDialog = () => {
    if (!selectedDoc) return;
    const placeholders = getPlaceholders(editedContent);
    const current: Record<string, string> = {};
    for (const ph of placeholders) {
      current[ph] = placeholderValues[ph] || '';
    }
    setPlaceholderValues(current);
    setDownloadDialogOpen(true);
  };

  const downloadAsPDF = () => {
    const html = fillPlaceholders(editedContent, placeholderValues);
    const styledHtml = `
      <html><head>
        <meta charset="utf-8" />
        <style>
          body { font-family: 'Times New Roman', serif; margin: 0; padding: 0; }
          @page { margin: 20mm; }
        </style>
      </head><body>${html}</body></html>
    `;
    const blob = new Blob([styledHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedDoc?.title?.replace(/\s+/g, '_') || 'document'}.html`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Document downloaded as HTML. Open in Word/LibreOffice to save as PDF.');
    setDownloadDialogOpen(false);
  };

  const downloadAsDocx = () => {
    const html = fillPlaceholders(editedContent, placeholderValues);
    const fullHtml = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office"
            xmlns:w="urn:schemas-microsoft-com:office:word"
            xmlns="http://www.w3.org/TR/REC-html40">
      <head><meta charset="utf-8" />
      <style>body { font-family: 'Times New Roman', serif; }</style>
      </head><body>${html}</body></html>
    `;
    const blob = new Blob([fullHtml], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedDoc?.title?.replace(/\s+/g, '_') || 'document'}.doc`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Document downloaded as Word file (.doc)');
    setDownloadDialogOpen(false);
  };

  const insertPlaceholder = (placeholder: string) => {
    const textarea = document.getElementById('doc-editor') as HTMLTextAreaElement;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newContent = editedContent.substring(0, start) + placeholder + editedContent.substring(end);
      setEditedContent(newContent);
      setTimeout(() => {
        textarea.focus();
        textarea.selectionStart = textarea.selectionEnd = start + placeholder.length;
      }, 0);
    }
  };

  // ─── LIST VIEW ────────────────────────────────────────────────
  if (viewMode === 'list') {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Documents</h1>
          <p className="text-muted-foreground mt-1">
            Browse, edit, and download school document templates. All changes are made locally and will not affect the original templates.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="relative flex-1 max-w-sm w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Search documents..."
              className="pl-9"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
          <Badge variant="outline" className="text-xs">{filteredDocs.length} templates</Badge>
        </div>

        {/* Category Tabs */}
        <Tabs value={activeCategory} onValueChange={v => setActiveCategory(v as DocumentCategory | 'all')} className="w-full">
          <TabsList className="w-full flex-wrap h-auto gap-1 bg-muted/30 p-1">
            <TabsTrigger value="all" className="text-xs data-[state=active]:bg-background">
              All ({DOCUMENT_TEMPLATES.length})
            </TabsTrigger>
            {categoryCounts.map(cat => (
              <TabsTrigger key={cat.id} value={cat.id} className="text-xs data-[state=active]:bg-background gap-1.5">
                <span>{cat.icon}</span> {cat.label} ({cat.count})
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {/* Document Grid */}
        {filteredDocs.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="p-12 flex flex-col items-center justify-center text-center gap-3">
              <FileText className="size-12 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No documents found</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredDocs.map(doc => (
              <Card
                key={doc.id}
                className="hover:shadow-md transition-all cursor-pointer group border-muted/80 hover:border-emerald-200/60"
                onClick={() => openEditor(doc)}
              >
                <CardContent className="p-4 flex flex-col gap-3">
                  <div className="flex items-start gap-3">
                    <div className="size-10 rounded-xl bg-emerald-100/80 flex items-center justify-center text-xl shrink-0">
                      {doc.icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold leading-tight truncate">{doc.title}</p>
                      <Badge variant="outline" className="mt-1.5 text-[10px] font-normal text-muted-foreground">
                        {CATEGORIES.find(c => c.id === doc.category)?.icon} {CATEGORIES.find(c => c.id === doc.category)?.label}
                      </Badge>
                    </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                    {doc.description}
                  </p>
                  <div className="flex items-center gap-2 pt-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs gap-1 flex-1"
                      onClick={(e) => { e.stopPropagation(); openEditor(doc); }}
                    >
                      <Edit3 className="size-3" /> Edit
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <AlertCircle className="size-5 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-blue-800">Fully Client-Side</p>
              <p className="text-[11px] text-blue-700 leading-relaxed mt-1">
                All document editing is done locally in your browser. Your changes are not saved to the server,
                so feel free to experiment and customize templates without affecting the global presets.
                Download your edited document as a Word file or HTML when you&apos;re done.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── EDITOR VIEW ──────────────────────────────────────────────
  if (viewMode === 'editor' && selectedDoc) {
    const placeholders = getPlaceholders(editedContent);

    return (
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={backToList}>
              <ChevronLeft className="size-4" />
            </Button>
            <div>
              <h2 className="text-lg font-bold tracking-tight flex items-center gap-2">
                <span>{selectedDoc.icon}</span> {selectedDoc.title}
              </h2>
              <p className="text-xs text-muted-foreground">{selectedDoc.description}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs gap-1.5"
              onClick={openPreview}
            >
              <Eye className="size-3.5" /> Preview
            </Button>
            <Button
              size="sm"
              className="h-8 text-xs gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white"
              onClick={openDownloadDialog}
            >
              <Download className="size-3.5" /> Download
            </Button>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
          {/* Editor */}
          <Card className="border-muted/80">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3 text-xs text-muted-foreground">
                <FileText className="size-3.5" />
                <span>Edit the HTML template below. Use <code className="text-emerald-600 bg-emerald-50 px-1 rounded">{'{{placeholder}}'}</code> tags for dynamic content.</span>
                <span className="ml-auto"><OcrUploadButton onTextExtracted={(text) => setEditedContent(prev => prev + text)} label="Scan" /></span>
              </div>
              <Textarea
                id="doc-editor"
                value={editedContent}
                onChange={e => setEditedContent(e.target.value)}
                className="font-mono text-xs leading-relaxed min-h-[500px] resize-y"
                spellCheck={false}
              />
            </CardContent>
          </Card>

          {/* Sidebar - Placeholders */}
          <Card className="border-muted/80 h-fit">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Sparkles className="size-4 text-emerald-600" />
                Placeholders
              </div>
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                Click a placeholder to insert it at the cursor position in the editor.
              </p>
              <div className="space-y-1 max-h-[400px] overflow-y-auto">
                {placeholders.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">No placeholders found in this template.</p>
                ) : (
                  placeholders.map(ph => (
                    <button
                      key={ph}
                      className="w-full text-left flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs hover:bg-emerald-50 hover:text-emerald-700 transition-colors border border-transparent hover:border-emerald-200 group"
                      onClick={() => insertPlaceholder(ph)}
                      title={PLACEHOLDER_DESCRIPTIONS[ph] || ph}
                    >
                      <code className="text-[11px] font-mono bg-muted/60 px-1 rounded group-hover:bg-emerald-100/60">{ph}</code>
                      <span className="text-[10px] text-muted-foreground truncate flex-1">
                        {PLACEHOLDER_DESCRIPTIONS[ph] || ''}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // ─── PREVIEW VIEW ─────────────────────────────────────────────
  if (viewMode === 'preview' && selectedDoc) {
    const placeholders = getPlaceholders(editedContent);

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setViewMode('editor')}>
              <ChevronLeft className="size-4" />
            </Button>
            <div>
              <h2 className="text-lg font-bold tracking-tight flex items-center gap-2">
                <span>👁️</span> Preview: {selectedDoc.title}
              </h2>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs gap-1.5"
              onClick={() => setViewMode('editor')}
            >
              <Edit3 className="size-3.5" /> Back to Editor
            </Button>
            <Button
              size="sm"
              className="h-8 text-xs gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white"
              onClick={openDownloadDialog}
            >
              <Download className="size-3.5" /> Download
            </Button>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
          <Card className="border-muted/80">
            <CardContent className="p-0 overflow-auto max-h-[80vh] bg-white">
              {previewHtml ? (
                <div className="p-6" dangerouslySetInnerHTML={{ __html: previewHtml }} />
              ) : (
                <div className="p-12 flex items-center justify-center text-sm text-muted-foreground">
                  Fill in the placeholders to preview the document.
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-muted/80 h-fit">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <FileText className="size-4 text-blue-600" />
                Fill Placeholders
              </div>
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                Enter values for the placeholders below. They will replace the tags in the preview and downloaded document.
              </p>
              <ScrollArea className="max-h-[500px]">
                <div className="space-y-3">
                  {placeholders.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">No placeholders to fill.</p>
                  ) : (
                    placeholders.map(ph => (
                      <div key={ph}>
                        <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                          <code className="text-emerald-600">{ph}</code>
                        </label>
                        <p className="text-[10px] text-muted-foreground mb-1">{PLACEHOLDER_DESCRIPTIONS[ph] || ''}</p>
                        <Input
                          size={1}
                          className="h-8 text-xs"
                          placeholder={ph}
                          value={placeholderValues[ph] || ''}
                          onChange={e => {
                            const newValues = { ...placeholderValues, [ph]: e.target.value };
                            setPlaceholderValues(newValues);
                            setPreviewHtml(fillPlaceholders(editedContent, newValues));
                          }}
                        />
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // ─── DOWNLOAD DIALOG ──────────────────────────────────────────
  return (
    <Dialog open={downloadDialogOpen} onOpenChange={setDownloadDialogOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Download Document</DialogTitle>
          <DialogDescription>
            Choose a format to download your edited document. Placeholder values will be filled in.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {getPlaceholders(editedContent).length > 0 && (
            <div className="space-y-3 max-h-[200px] overflow-y-auto">
              <p className="text-xs font-semibold text-muted-foreground">Placeholder Values</p>
              {getPlaceholders(editedContent).map(ph => (
                <div key={ph}>
                  <label className="text-[11px] text-muted-foreground"><code>{ph}</code></label>
                  <Input
                    size={1}
                    className="h-8 text-xs mt-0.5"
                    placeholder={PLACEHOLDER_DESCRIPTIONS[ph] || ph}
                    value={placeholderValues[ph] || ''}
                    onChange={e => setPlaceholderValues(p => ({ ...p, [ph]: e.target.value }))}
                  />
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Button onClick={downloadAsDocx} className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl gap-2">
              <FileDown className="size-4" /> Download as Word (.doc)
            </Button>
            <Button onClick={downloadAsPDF} variant="outline" className="rounded-xl gap-2">
              <Download className="size-4" /> Download as HTML (Open in Word/LibreOffice)
            </Button>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" className="rounded-xl" onClick={() => setDownloadDialogOpen(false)}>Cancel</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
