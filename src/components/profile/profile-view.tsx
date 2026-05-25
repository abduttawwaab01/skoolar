'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAppStore } from '@/store/app-store';
import { useEffect, useState, useRef } from 'react';
import { toast } from 'sonner';
import { Camera, Loader2, Upload, X } from 'lucide-react';
import { ProfileForm } from './profile-form';

export function ProfileView() {
  const { currentUser } = useAppStore();
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchUserData();
  }, [currentUser.id]);

  const fetchUserData = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/users/${currentUser.id}`);
      if (!res.ok) {
        throw new Error('Failed to fetch user data');
      }
      const data = await res.json();
      setUserData(data.data);
      if (data.data?.avatar) {
        setAvatarPreview(data.data.avatar);
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to load profile data');
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('Image size must be less than 10MB');
      return;
    }

    try {
      setAvatarUploading(true);
      
      const localPreview = URL.createObjectURL(file);
      setAvatarPreview(localPreview);

      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/upload?compress=true&folder=avatars', {
        method: 'POST',
        body: formData,
      });

      const result = await res.json();

      if (!result.success || !result.data?.url) {
        throw new Error(result.message || 'Upload failed');
      }

      const avatarUrl = result.data.url;
      
      const updateRes = await fetch(`/api/users/${currentUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatar: avatarUrl }),
      });

      const updateResult = await updateRes.json();

      if (!updateRes.ok) {
        throw new Error(updateResult.error || 'Failed to update avatar');
      }

      toast.success(`Avatar uploaded successfully ${result.data.compression ? `(${result.data.compression.savings} compression)` : ''}`);
      setUserData(prev => prev ? { ...prev, avatar: avatarUrl } : prev);
      
    } catch (error: any) {
      toast.error(error.message || 'Failed to upload avatar');
      if (userData?.avatar) {
        setAvatarPreview(userData.avatar);
      } else {
        setAvatarPreview(null);
      }
    } finally {
      setAvatarUploading(false);
    }
  };

  const clearAvatarPreview = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (fileInputRef.current?.value) fileInputRef.current.value = '';
    if (userData?.avatar) {
      setAvatarPreview(userData.avatar);
    } else {
      setAvatarPreview(null);
    }
  };

  const handleUpdate = async (data: any) => {
    try {
      setSaving(true);
      const res = await fetch(`/api/users/${currentUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to update profile');
      }
      toast.success('Profile updated successfully');
      // Refresh data after successful update
      await fetchUserData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !userData) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <div className="space-y-4 text-center">
          <div className="h-8 w-64 animate-pulse bg-muted"></div>
          <div className="h-4 w-48 animate-pulse bg-muted"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">My Profile</h1>
          <p className="text-muted-foreground">
            Update your personal information and passport photo
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => {
            fetchUserData();
          }}
        >
          Refresh
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="text-base">Passport Photo</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center space-y-4">
            <div className="relative group">
              <Avatar className="h-32 w-32 border-4 border-gray-100 shadow-md">
                <AvatarImage src={avatarPreview || ''} alt={userData?.name || 'Profile'} className="object-cover" />
                <AvatarFallback className="text-3xl bg-emerald-100 text-emerald-700">
                  {userData?.name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2) || '?'}
                </AvatarFallback>
              </Avatar>
              
              {avatarUploading && (
                <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center">
                  <Loader2 className="h-8 w-8 text-white animate-spin" />
                </div>
              )}
              
              {avatarPreview && (
                <button 
                  onClick={clearAvatarPreview}
                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="w-full space-y-2">
              <Label htmlFor="avatar-upload">Upload Photo (ID Card)</Label>
              <Input
                ref={fileInputRef}
                id="avatar-upload"
                type="file"
                accept="image/*"
                onChange={handleAvatarUpload}
                disabled={avatarUploading}
                className="file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100"
              />
              <p className="text-xs text-muted-foreground">
                Upload a passport-style photo for your ID card. Photos are automatically compressed.
              </p>
            </div>

            <Button 
              className="w-full" 
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={avatarUploading}
            >
              <Upload className="h-4 w-4 mr-2" />
              Choose Photo
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Profile Information</CardTitle>
          </CardHeader>
          <CardContent>
            <ProfileForm
              initialData={userData}
              onSubmit={handleUpdate}
              isLoading={saving}
              canEdit={true}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}