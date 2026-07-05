'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { FileUploader } from '@/components/ui/file-uploader';
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors,
} from '@dnd-kit/core';
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Plus, Trash2, ChevronDown, ChevronRight, Type, Image, Columns, Megaphone, Minus } from 'lucide-react';

type BlockType = 'text' | 'image' | 'text-image' | 'cta' | 'divider';
type Block = { id: string; type: BlockType; content: string; order: number };

interface ExtraSectionsEditorProps {
  value: string;
  onChange: (json: string) => void;
}

let _counter = 0;
function uid() { return `block_${++_counter}_${Date.now()}`; }

const BLOCK_TYPES: Array<{ value: BlockType; label: string; icon: React.ElementType }> = [
  { value: 'text', label: 'Text', icon: Type },
  { value: 'image', label: 'Image', icon: Image },
  { value: 'text-image', label: 'Text + Image', icon: Columns },
  { value: 'cta', label: 'Call to Action', icon: Megaphone },
  { value: 'divider', label: 'Divider', icon: Minus },
];

function parseBlocks(json: string): Block[] {
  if (!json) return [];
  try { return JSON.parse(json); } catch { return []; }
}

function SortableBlock({ block, onChange, onRemove }: { block: Block; onChange: (b: Block) => void; onRemove: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };

  const blockIcon = BLOCK_TYPES.find(t => t.value === block.type)?.icon || Type;

  function parseContent(): Record<string, string> {
    try { return JSON.parse(block.content); } catch { return { text: block.content }; }
  }

  function updateContentField(key: string, val: string) {
    const c = parseContent();
    c[key] = val;
    onChange({ ...block, content: JSON.stringify(c) });
  }

  return (
    <div ref={setNodeRef} style={style} className="border rounded-lg bg-white">
      <div className="flex items-center gap-2 p-3 border-b bg-gray-50">
        <button {...attributes} {...listeners} className="cursor-grab text-gray-400 hover:text-gray-600">
          <GripVertical className="h-4 w-4" />
        </button>
        {React.createElement(blockIcon, { className: 'h-4 w-4 text-gray-500' })}
        <span className="text-sm font-medium flex-1 capitalize">{block.type.replace('-', ' ')}</span>
        <button onClick={() => setExpanded(!expanded)} className="text-gray-400 hover:text-gray-600">
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
        <button onClick={onRemove} className="text-red-400 hover:text-red-600">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      {expanded && (
        <div className="p-4 space-y-3">
          {block.type === 'text' && (
            <>
              <div><Label>Heading</Label><Input value={parseContent().heading || ''} onChange={e => updateContentField('heading', e.target.value)} placeholder="Section heading" /></div>
              <div><Label>Content</Label><Textarea value={parseContent().text || ''} onChange={e => updateContentField('text', e.target.value)} rows={4} placeholder="Write your content here..." /></div>
            </>
          )}
          {block.type === 'image' && (
            <>
              <div><Label>Caption</Label><Input value={parseContent().caption || ''} onChange={e => updateContentField('caption', e.target.value)} placeholder="Image caption" /></div>
              <div><Label>Image</Label><FileUploader value={parseContent().imageUrl || ''} onChange={v => updateContentField('imageUrl', v)} folder="schools" /></div>
            </>
          )}
          {block.type === 'text-image' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label>Text Side</Label>
                <select value={parseContent().side || 'left'} onChange={e => updateContentField('side', e.target.value)} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm mb-2">
                  <option value="left">Text left, image right</option>
                  <option value="right">Image left, text right</option>
                </select>
                <Label>Heading</Label><Input value={parseContent().heading || ''} onChange={e => updateContentField('heading', e.target.value)} placeholder="Heading" className="mb-2" />
                <Label>Text</Label><Textarea value={parseContent().text || ''} onChange={e => updateContentField('text', e.target.value)} rows={4} placeholder="Write your content..." />
              </div>
              <div><Label>Image</Label><FileUploader value={parseContent().imageUrl || ''} onChange={v => updateContentField('imageUrl', v)} folder="schools" /></div>
            </div>
          )}
          {block.type === 'cta' && (
            <>
              <div><Label>Heading</Label><Input value={parseContent().heading || ''} onChange={e => updateContentField('heading', e.target.value)} placeholder="Call to action heading" /></div>
              <div><Label>Description</Label><Input value={parseContent().description || ''} onChange={e => updateContentField('description', e.target.value)} placeholder="Short description" /></div>
              <div><Label>Button Text</Label><Input value={parseContent().buttonText || ''} onChange={e => updateContentField('buttonText', e.target.value)} placeholder="Learn More" /></div>
              <div><Label>Button URL</Label><Input value={parseContent().buttonUrl || ''} onChange={e => updateContentField('buttonUrl', e.target.value)} placeholder="https://..." /></div>
            </>
          )}
          {block.type === 'divider' && (
            <p className="text-sm text-gray-500">A horizontal divider line. No additional settings.</p>
          )}
        </div>
      )}
    </div>
  );
}

export function ExtraSectionsEditor({ value, onChange }: ExtraSectionsEditorProps) {
  const [adding, setAdding] = useState(false);

  const blocks = parseBlocks(value);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function addBlock(type: BlockType) {
    const block: Block = { id: uid(), type, content: '{}', order: blocks.length };
    const next = [...blocks, block];
    onChange(JSON.stringify(next));
    setAdding(false);
  }

  function updateBlock(updated: Block) {
    const next = blocks.map(b => b.id === updated.id ? updated : b);
    onChange(JSON.stringify(next));
  }

  function removeBlock(id: string) {
    const next = blocks.filter(b => b.id !== id);
    onChange(JSON.stringify(next));
  }

  function handleDragEnd(event: any) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = blocks.findIndex(b => b.id === active.id);
    const newIndex = blocks.findIndex(b => b.id === over.id);
    const reordered = arrayMove(blocks, oldIndex, newIndex).map((b, i) => ({ ...b, order: i }));
    onChange(JSON.stringify(reordered));
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-500">Add custom content blocks to your landing page. Drag to reorder.</p>

      {blocks.length === 0 && (
        <div className="text-center py-8 border-2 border-dashed rounded-lg text-gray-400">
          <p className="text-sm">No custom blocks yet. Click below to add one.</p>
        </div>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={blocks.map(b => b.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {blocks.map(block => (
              <SortableBlock key={block.id} block={block} onChange={updateBlock} onRemove={() => removeBlock(block.id)} />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {adding ? (
        <div className="flex flex-wrap gap-2 p-3 border rounded-lg bg-gray-50">
          <span className="text-sm text-gray-500 w-full mb-1">Choose block type:</span>
          {BLOCK_TYPES.map(({ value: v, label, icon: Icon }) => (
            <Button key={v} variant="outline" size="sm" onClick={() => addBlock(v)}>
              <Icon className="h-4 w-4 mr-1" /> {label}
            </Button>
          ))}
          <Button variant="ghost" size="sm" onClick={() => setAdding(false)}>Cancel</Button>
        </div>
      ) : (
        <Button variant="outline" size="sm" onClick={() => setAdding(true)}>
          <Plus className="h-4 w-4 mr-1" /> Add Block
        </Button>
      )}
    </div>
  );
}
