"use client";

import { Button } from '@/components/ui/button';
import { LogIn } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function WelcomePage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

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
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4 text-center">
      <h1 className="mb-6 text-5xl font-bold text-gradient-blue-purple md:text-7xl">
        Welcome to PixelSphere
      </h1>
      <p className="mb-10 max-w-2xl text-lg text-muted-foreground md:text-xl">
        Your personal space to upload, store, and browse your favorite photos and videos, chronologically organized just like your phone's gallery.
      </p>
      <Link href="/login" passHref>
        <Button size="lg" className="btn-glow-purple text-lg font-semibold px-8 py-6">
          <LogIn className="mr-2 h-6 w-6" />
          Login to Access Your Gallery
        </Button>
      </Link>
    </div>
  );
}
