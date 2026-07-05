'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Twitter, Facebook, Instagram, Linkedin, Youtube } from 'lucide-react';

interface SocialLinksFormProps {
  value: string;
  onChange: (json: string) => void;
}

const platforms = [
  { key: 'twitter', label: 'Twitter / X', icon: Twitter, placeholder: 'https://twitter.com/YourSchool' },
  { key: 'facebook', label: 'Facebook', icon: Facebook, placeholder: 'https://facebook.com/YourSchool' },
  { key: 'instagram', label: 'Instagram', icon: Instagram, placeholder: 'https://instagram.com/YourSchool' },
  { key: 'linkedin', label: 'LinkedIn', icon: Linkedin, placeholder: 'https://linkedin.com/school/YourSchool' },
  { key: 'youtube', label: 'YouTube', icon: Youtube, placeholder: 'https://youtube.com/@YourSchool' },
];

export function SocialLinksForm({ value, onChange }: SocialLinksFormProps) {
  let links: Record<string, string> = {};
  try { links = JSON.parse(value); } catch { links = {}; }

  function setLink(key: string, val: string) {
    const next = { ...links, [key]: val };
    onChange(JSON.stringify(next));
  }

  return (
    <div className="space-y-4">
      {platforms.map(({ key, label, icon: Icon, placeholder }) => (
        <div key={key}>
          <Label className="flex items-center gap-2 mb-1">
            <Icon className="h-4 w-4 text-gray-500" />
            {label}
          </Label>
          <Input
            value={links[key] || ''}
            onChange={e => setLink(key, e.target.value)}
            placeholder={placeholder}
          />
        </div>
      ))}
    </div>
  );
}
