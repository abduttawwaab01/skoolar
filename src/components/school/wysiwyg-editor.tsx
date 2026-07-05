'use client';

import { useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Bold, Italic, List, Heading, Quote, Link as LinkIcon } from 'lucide-react';

interface WysiwygEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function WysiwygEditor({ value, onChange, placeholder }: WysiwygEditorProps) {
  const ref = useRef<HTMLTextAreaElement>(null);

  const wrap = useCallback((before: string, after: string) => {
    const ta = ref.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = value.substring(start, end);
    const next = value.substring(0, start) + before + selected + after + value.substring(end);
    onChange(next);
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(start + before.length, start + before.length + selected.length);
    });
  }, [value, onChange]);

  const insertLink = useCallback(() => {
    const ta = ref.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = value.substring(start, end) || 'link text';
    const next = value.substring(0, start) + `[${selected}](url)` + value.substring(end);
    onChange(next);
  }, [value, onChange]);

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap gap-1 p-1 border rounded-t-md bg-gray-50">
        <Button type="button" variant="ghost" size="sm" onClick={() => wrap('**', '**')} title="Bold">
          <Bold className="h-3.5 w-3.5" />
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => wrap('*', '*')} title="Italic">
          <Italic className="h-3.5 w-3.5" />
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => wrap('# ', '')} title="Heading">
          <Heading className="h-3.5 w-3.5" />
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => wrap('- ', '')} title="Bullet list">
          <List className="h-3.5 w-3.5" />
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => wrap('> ', '')} title="Quote">
          <Quote className="h-3.5 w-3.5" />
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={insertLink} title="Link">
          <LinkIcon className="h-3.5 w-3.5" />
        </Button>
      </div>
      <textarea
        ref={ref}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        rows={10}
        className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm rounded-t-none font-mono"
      />
    </div>
  );
}
