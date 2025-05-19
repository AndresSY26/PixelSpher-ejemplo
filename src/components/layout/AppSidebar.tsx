
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutGrid, 
  Share2,
  Album,
  Heart,
  Lock,
  Trash2,
  Settings,
  Users, // New icon for Shared With Me
} from "lucide-react";


const mainNavItems = [
  { href: "/gallery", label: "Galería", icon: LayoutGrid },
  { href: "/share", label: "Compartir", icon: Share2 },
];

const collectionsNavItems = [
  { href: "/albums", label: "Álbumes", icon: Album },
  { href: "/favorites", label: "Favoritos", icon: Heart },
  { href: "/private", label: "Carpeta Privada", icon: Lock },
  { href: "/shared-with-me", label: "Compartido Conmigo", icon: Users }, // New Item
];

const utilityNavItems = [
  { href: "/trash", label: "Papelera", icon: Trash2 },
  { href: "/settings", label: "Configuración", icon: Settings },
];

export default function AppSidebar() {
  const pathname = usePathname();

  const NavLink = ({ href, label, icon: Icon }: { href: string, label: string, icon: React.ElementType }) => (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all",
        "hover:bg-sidebar-hover-background hover:text-sidebar-hover-foreground",
        pathname === href || 
        (href === "/gallery" && pathname.startsWith("/gallery")) || 
        (href.startsWith("/albums") && pathname.startsWith("/albums")) ||
        (href.startsWith("/shared-with-me") && pathname.startsWith("/shared-with-me")) 
          ? "bg-sidebar-active-background text-sidebar-active-foreground"
          : "text-sidebar-foreground"
      )}
    >
      <Icon className="h-5 w-5" />
      {label}
    </Link>
  );

  return (
    <aside className="hidden md:flex md:flex-col md:w-64 border-r bg-sidebar-background text-sidebar-foreground">
      <div className="flex h-16 items-center border-b px-6">
        <Link href="/gallery" className="flex items-center gap-2 font-semibold text-lg text-gradient-blue-purple">
          <LayoutGrid className="h-6 w-6 text-primary" /> 
          <span>PixelSphere</span>
        </Link>
      </div>
      <nav className="flex-1 overflow-auto p-4 space-y-4">
        <div className="space-y-1">
          {mainNavItems.map((item) => (
            <NavLink key={item.href} href={item.href} label={item.label} icon={item.icon} />
          ))}
        </div>

        <div>
          <h3 className="mb-2 px-3 text-xs font-semibold uppercase text-muted-foreground tracking-wider">
            COLECCIONES
          </h3>
          <div className="space-y-1">
            {collectionsNavItems.map((item) => (
              <NavLink key={item.href} href={item.href} label={item.label} icon={item.icon} />
            ))}
          </div>
        </div>
        
        <div className="space-y-1">
            {utilityNavItems.map((item) => (
            <NavLink key={item.href} href={item.href} label={item.label} icon={item.icon} />
            ))}
        </div>
      </nav>
    </aside>
  );
}

