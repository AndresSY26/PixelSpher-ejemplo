"use client";

import { useState } from 'react';
import LoginForm from '@/components/auth/LoginForm';
import RegistrationForm from '@/components/auth/RegistrationForm'; // Import the new component
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Card } from '@/components/ui/card';


export default function LoginPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const [isRegistering, setIsRegistering] = useState(false); // State to toggle forms

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.push('/gallery');
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading || isAuthenticated) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
        <p className="text-foreground">Loading...</p>
      </div>
    );
  }
  
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md shadow-2xl">
        {isRegistering ? (
          <RegistrationForm onSwitchToLogin={() => setIsRegistering(false)} />
        ) : (
          <LoginForm onSwitchToRegister={() => setIsRegistering(true)} />
        )}
      </Card>
    </div>
  );
}
