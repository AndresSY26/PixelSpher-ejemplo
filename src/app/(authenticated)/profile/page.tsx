"use client";

import ProfileForm from '@/components/profile/ProfileForm';
import { useAuth } from '@/context/AuthContext';
import { Loader2 } from 'lucide-react';

export default function ProfilePage() {
  const { user, isLoading: authLoading, updateUserInContext } = useAuth();

  if (authLoading || !user) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <h1 className="text-3xl font-bold">Perfil</h1>
      <ProfileForm currentUser={user} onProfileUpdate={updateUserInContext} />
    </div>
  );
}
