
"use client";

import AppHeader from "@/components/layout/AppHeader";
import AppSidebar from "@/components/layout/AppSidebar";
import { useAuth } from "@/context/AuthContext";
import { Loader2 } from "lucide-react"; 
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { DEFAULT_USER_PREFERENCES } from "@/types";

export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const pathname = usePathname();
  const userPreferences = user?.preferences || DEFAULT_USER_PREFERENCES;

  useEffect(() => {
    if (user && userPreferences.rememberLastSection && typeof window !== 'undefined') {
      // Don't save login, root, or profile page as last visited if we're trying to redirect away from them
      const nonRememberPaths = ['/login', '/', '/profile'];
      if (!nonRememberPaths.includes(pathname)) {
         localStorage.setItem('lastVisitedPath_pixelsphere', pathname);
      }
    }
  }, [pathname, user, userPreferences.rememberLastSection]);


  if (isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="sr-only">Loading...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    // AuthProvider handles redirection, but this is a fallback / UI for during redirection
     return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <p className="text-foreground">Redirecting to login...</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen min-h-screen w-full flex-col md:flex-row bg-background text-foreground">
      <AppSidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <AppHeader />
        <main className="flex-1 overflow-x-hidden overflow-y-auto p-4 md:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}

