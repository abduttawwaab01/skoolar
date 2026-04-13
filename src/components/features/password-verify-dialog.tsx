'use client';

import React, { useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Lock, Eye, EyeOff, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface PasswordVerifyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  title?: string;
  description?: string;
  confirmText?: string;
  userName?: string;
  userEmail?: string;
}

export function PasswordVerifyDialog({
  open,
  onOpenChange,
  onConfirm,
  title = 'Verify Password',
  description = 'Enter your password to confirm this action.',
  confirmText = 'Confirm',
  userName,
  userEmail,
}: PasswordVerifyDialogProps) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isVerified, setIsVerified] = useState(false);

  const handleVerify = async () => {
    if (!password) {
      toast.error('Please enter your password');
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch('/api/users/password-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: 'self',
          password: password,
          mode: 'verify',
        }),
      });

      const data = await res.json();

      if (data.valid) {
        setIsVerified(true);
        onConfirm();
        onOpenChange(false);
        setPassword('');
        setIsVerified(false);
      } else {
        toast.error(data.message || 'Invalid password');
      }
    } catch {
      toast.error('Failed to verify password');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setPassword('');
    setIsVerified(false);
    onOpenChange(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Lock className="size-5 text-emerald-600" />
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {description}
            {userName && (
              <div className="mt-2 p-2 rounded-md bg-muted text-sm">
                <p className="font-medium">{userName}</p>
                {userEmail && <p className="text-muted-foreground text-xs">{userEmail}</p>}
              </div>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="verify-password">Your Password</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="verify-password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleVerify();
                }}
                className="pl-10 pr-10"
                disabled={isLoading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>

          {isVerified && (
            <div className="flex items-center gap-2 text-green-600 text-sm">
              <CheckCircle className="size-4" />
              Password verified successfully
            </div>
          )}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleCancel}>Cancel</AlertDialogCancel>
          <Button
            onClick={handleVerify}
            disabled={isLoading || !password}
            className="gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Verifying...
              </>
            ) : isVerified ? (
              <>
                <CheckCircle className="size-4" />
                Verified
              </>
            ) : (
              confirmText
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

interface usePasswordVerifyOptions {
  onSuccess?: () => void;
  title?: string;
  description?: string;
  confirmText?: string;
}

export function usePasswordVerify(options: usePasswordVerifyOptions = {}) {
  const [open, setOpen] = useState(false);
  const [userName, setUserName] = useState<string>();
  const [userEmail, setUserEmail] = useState<string>();
  const [actionCallback, setActionCallback] = useState<(() => void) | null>(null);

  const verify = (
    callback: () => void,
    user?: { name?: string; email?: string }
  ) => {
    setUserName(user?.name);
    setUserEmail(user?.email);
    setActionCallback(() => callback);
    setOpen(true);
  };

  const handleConfirm = () => {
    if (actionCallback) {
      actionCallback();
      options.onSuccess?.();
    }
  };

  const dialog = (
    <PasswordVerifyDialog
      open={open}
      onOpenChange={setOpen}
      onConfirm={handleConfirm}
      title={options.title}
      description={options.description}
      confirmText={options.confirmText}
      userName={userName}
      userEmail={userEmail}
    />
  );

  return { verify, dialog };
}
