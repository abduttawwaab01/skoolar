'use client';

import * as React from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useForm, SubmitHandler } from 'react-hook-form';
import { useAppStore } from '@/store/app-store';
import { toast } from 'sonner';

interface ProfileFormValues {
  name: string;
  email: string;
  phone: string | null;
  passportNumber: string | null;
  dateOfBirth: string | null; // Changed to string to match Input type="date" output
  gender: string | null;
  address: string | null;
  nationality: string | null;
  emergencyContact: string | null;
  emergencyPhone: string | null;
  bloodGroup: string | null;
  maritalStatus: string | null;
  nextOfKin: string | null;
  nextOfKinPhone: string | null;
}

export function ProfileForm({ 
  initialData, 
  onSubmit, 
  isLoading = false, 
  canEdit = true 
}: {
  initialData: Partial<ProfileFormValues>;
  onSubmit: (data: ProfileFormValues) => Promise<void>;
  isLoading?: boolean;
  canEdit?: boolean;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<ProfileFormValues>({
    defaultValues: {
      name: initialData.name || '',
      email: initialData.email || '',
      phone: initialData.phone ?? null,
      passportNumber: initialData.passportNumber ?? null,
       dateOfBirth: initialData.dateOfBirth 
         ? typeof initialData.dateOfBirth === 'string'
           ? initialData.dateOfBirth.split('T')[0] 
           : initialData.dateOfBirth instanceof Date
             ? initialData.dateOfBirth.toISOString().split('T')[0]
             : null
         : null,
      gender: initialData.gender ?? null,
      address: initialData.address ?? null,
      nationality: initialData.nationality ?? null,
      emergencyContact: initialData.emergencyContact ?? null,
      emergencyPhone: initialData.emergencyPhone ?? null,
      bloodGroup: initialData.bloodGroup ?? null,
      maritalStatus: initialData.maritalStatus ?? null,
      nextOfKin: initialData.nextOfKin ?? null,
      nextOfKinPhone: initialData.nextOfKinPhone ?? null,
    },
  });

  const { currentUser } = useAppStore();

  const onHandleSubmit: SubmitHandler<ProfileFormValues> = async (data) => {
    try {
      await onSubmit(data);
      reset();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update profile');
    }
  };

  if (!canEdit) {
    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Profile Information</h2>
          <p className="text-sm text-muted-foreground">View only mode</p>
        </div>
        <div className="grid gap-4 grid-cols-2">
          <div>
            <Label>Full Name</Label>
            <Input defaultValue={initialData.name || ''} readOnly />
          </div>
          <div>
            <Label>Email</Label>
            <Input type="email" defaultValue={initialData.email || ''} readOnly />
          </div>
          <div>
            <Label>Phone</Label>
            <Input defaultValue={initialData.phone ?? ''} readOnly />
          </div>
          <div>
            <Label>Passport Number</Label>
            <Input defaultValue={initialData.passportNumber ?? ''} readOnly />
          </div>
          <div>
            <Label>Date of Birth</Label>
            <Input 
              type="date" 
              defaultValue={initialData.dateOfBirth || ''} 
              readOnly 
            />
          </div>
          <div>
            <Label>Gender</Label>
            <Input defaultValue={initialData.gender ?? ''} readOnly />
          </div>
          <div>
            <Label>Address</Label>
            <Textarea defaultValue={initialData.address ?? ''} readOnly />
          </div>
          <div>
            <Label>Nationality</Label>
            <Input defaultValue={initialData.nationality ?? ''} readOnly />
          </div>
          <div>
            <Label>Emergency Contact</Label>
            <Input defaultValue={initialData.emergencyContact ?? ''} readOnly />
          </div>
          <div>
            <Label>Emergency Phone</Label>
            <Input defaultValue={initialData.emergencyPhone ?? ''} readOnly />
          </div>
          <div>
            <Label>Blood Group</Label>
            <Input defaultValue={initialData.bloodGroup ?? ''} readOnly />
          </div>
          <div>
            <Label>Marital Status</Label>
            <Input defaultValue={initialData.maritalStatus ?? ''} readOnly />
          </div>
          <div>
            <Label>Next of Kin</Label>
            <Input defaultValue={initialData.nextOfKin ?? ''} readOnly />
          </div>
          <div>
            <Label>Next of Kin Phone</Label>
            <Input defaultValue={initialData.nextOfKinPhone ?? ''} readOnly />
          </div>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onHandleSubmit)} className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Profile Information</h2>
        <p className="text-sm text-muted-foreground">
          Update your personal details. Password changes must be done through the security settings.
        </p>
      </div>
      
      <div className="grid gap-4 grid-cols-2">
        <div>
          <Label>Full Name</Label>
          <Input 
            {...register('name', { required: 'Name is required' })}
            value={initialData.name || ''}
            onChange={e => register().onChange(e.target.value)}
          />
          {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
        </div>
        <div>
          <Label>Email</Label>
          <Input 
            type="email"
            {...register('email', { 
              required: 'Email is required',
              pattern: {
                value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                message: 'Invalid email format'
              }
            })}
            value={initialData.email || ''}
            onChange={e => register().onChange(e.target.value)}
          />
          {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
        </div>
        <div>
          <Label>Phone</Label>
          <Input 
            {...register('phone')}
            value={initialData.phone ?? ''}
            onChange={e => register().onChange(e.target.value)}
          />
        </div>
        <div>
          <Label>Passport Number</Label>
          <Input 
            {...register('passportNumber')}
            value={initialData.passportNumber ?? ''}
            onChange={e => register().onChange(e.target.value)}
          />
        </div>
        <div>
          <Label>Date of Birth</Label>
          <Input 
            type="date"
            {...register('dateOfBirth')}
            value={initialData.dateOfBirth ?? ''}
            onChange={e => register().onChange(e.target.value)}
          />
        </div>
        <div>
          <Label>Gender</Label>
          <Select 
            {...register('gender')}
            value={initialData.gender ?? ''}
            onValueChange={(value) => register().onChange(value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select gender" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Select gender</SelectItem>
              <SelectItem value="Male">Male</SelectItem>
              <SelectItem value="Female">Female</SelectItem>
              <SelectItem value="Other">Other</SelectItem>
            </SelectContent>
          </Select>
          {errors.gender && <p className="text-xs text-destructive">{errors.gender.message}</p>}
        </div>
        <div>
          <Label>Address</Label>
          <Textarea 
            {...register('address')}
            value={initialData.address ?? ''}
            onChange={e => register().onChange(e.target.value)}
          />
        </div>
        <div>
          <Label>Nationality</Label>
          <Input 
            {...register('nationality')}
            value={initialData.nationality ?? ''}
            onChange={e => register().onChange(e.target.value)}
          />
        </div>
        <div>
          <Label>Emergency Contact</Label>
          <Input 
            {...register('emergencyContact')}
            value={initialData.emergencyContact ?? ''}
            onChange={e => register().onChange(e.target.value)}
          />
        </div>
        <div>
          <Label>Emergency Phone</Label>
          <Input 
            {...register('emergencyPhone')}
            value={initialData.emergencyPhone ?? ''}
            onChange={e => register().onChange(e.target.value)}
          />
        </div>
        <div>
          <Label>Blood Group</Label>
          <Select 
            {...register('bloodGroup')}
            value={initialData.bloodGroup ?? ''}
            onValueChange={(value) => register().onChange(value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select blood group" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Select blood group</SelectItem>
              <SelectItem value="A+">A+</SelectItem>
              <SelectItem value="A-">A-</SelectItem>
              <SelectItem value="B+">B+</SelectItem>
              <SelectItem value="B-">B-</SelectItem>
              <SelectItem value="AB+">AB+</SelectItem>
              <SelectItem value="AB-">AB-</SelectItem>
              <SelectItem value="O+">O+</SelectItem>
              <SelectItem value="O-">O-</SelectItem>
            </SelectContent>
          </Select>
          {errors.bloodGroup && <p className="text-xs text-destructive">{errors.bloodGroup.message}</p>}
        </div>
        <div>
          <Label>Marital Status</Label>
          <Select 
            {...register('maritalStatus')}
            value={initialData.maritalStatus ?? ''}
            onValueChange={(value) => register().onChange(value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select marital status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Select marital status</SelectItem>
              <SelectItem value="Single">Single</SelectItem>
              <SelectItem value="Married">Married</SelectItem>
              <SelectItem value="Divorced">Divorced</SelectItem>
              <SelectItem value="Widowed">Widowed</SelectItem>
            </SelectContent>
          </Select>
          {errors.maritalStatus && <p className="text-xs text-destructive">{errors.maritalStatus.message}</p>}
        </div>
        <div>
          <Label>Next of Kin</Label>
          <Input 
            {...register('nextOfKin')}
            value={initialData.nextOfKin ?? ''}
            onChange={e => register().onChange(e.target.value)}
          />
        </div>
        <div>
          <Label>Next of Kin Phone</Label>
          <Input 
            {...register('nextOfKinPhone')}
            value={initialData.nextOfKinPhone ?? ''}
            onChange={e => register().onChange(e.target.value)}
          />
        </div>
      </div>
      
      <div className="flex justify-end space-x-3">
        <Button 
          variant="outline" 
          onClick={() => reset({
            name: initialData.name || '',
            email: initialData.email || '',
            phone: initialData.phone ?? null,
            passportNumber: initialData.passportNumber ?? null,
            dateOfBirth: initialData.dateOfBirth ?? null,
            gender: initialData.gender ?? null,
            address: initialData.address ?? null,
            nationality: initialData.nationality ?? null,
            emergencyContact: initialData.emergencyContact ?? null,
            emergencyPhone: initialData.emergencyPhone ?? null,
            bloodGroup: initialData.bloodGroup ?? null,
            maritalStatus: initialData.maritalStatus ?? null,
            nextOfKin: initialData.nextOfKin ?? null,
            nextOfKinPhone: initialData.nextOfKinPhone ?? null,
          })}
        >
          Reset
        </Button>
        <Button 
          type="submit" 
          disabled={isSubmitting || isLoading}
          className="btn-primary"
        >
          {isSubmitting ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </form>
  );
}