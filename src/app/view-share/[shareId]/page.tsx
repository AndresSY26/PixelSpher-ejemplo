
"use client";

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getSharedItemDetails } from '@/app/actions/shareActions';
import type { MediaItem, SharedLink } from '@/types';
import Image from 'next/image';
import { Loader2, ShieldAlert, Download, Film } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { format } from 'date-fns'; // Added import
import { es } from 'date-fns/locale'; // Added import

export default function ViewSharePage() {
  const params = useParams();
  const router = useRouter();
  const shareId = typeof params.shareId === 'string' ? params.shareId : '';

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sharedItem, setSharedItem] = useState<MediaItem | null>(null);
  const [sharedLinkInfo, setSharedLinkInfo] = useState<SharedLink | null>(null);

  useEffect(() => {
    if (!shareId) {
      setError("ID de compartición no proporcionado.");
      setIsLoading(false);
      return;
    }

    async function fetchDetails() {
      setIsLoading(true);
      try {
        const result = await getSharedItemDetails(shareId);
        if (result.error || !result.item || !result.link) {
          setError(result.error || "No se pudo cargar el contenido compartido.");
          setSharedItem(null);
          setSharedLinkInfo(null);
        } else {
          setSharedItem(result.item);
          setSharedLinkInfo(result.link);
          setError(null);
        }
      } catch (e) {
        setError("Ocurrió un error al cargar el contenido.");
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    }
    fetchDetails();
  }, [shareId]);

  const handleDownload = () => {
    if (sharedItem?.filePath) {
      // The filePath is relative to /public, so it can be directly used in an <a> tag
      const link = document.createElement('a');
      link.href = sharedItem.filePath;
      link.download = sharedItem.originalFilename || 'shared_item';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col min-h-screen items-center justify-center bg-background text-foreground p-6">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p>Cargando contenido compartido...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col min-h-screen items-center justify-center bg-background text-foreground p-6 text-center">
        <ShieldAlert className="h-16 w-16 text-destructive mb-4" />
        <h1 className="text-2xl font-semibold mb-2">Error al Cargar</h1>
        <p className="text-muted-foreground mb-6">{error}</p>
        <Button asChild variant="outline">
          <Link href="/">Volver a la página principal</Link>
        </Button>
      </div>
    );
  }

  if (!sharedItem) {
    // Should be caught by error state, but as a fallback
    return (
      <div className="flex flex-col min-h-screen items-center justify-center bg-background text-foreground p-6 text-center">
        <p>Contenido no encontrado.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen items-center justify-center bg-background text-foreground p-4 sm:p-6 md:p-8">
      <div className="w-full max-w-4xl bg-card shadow-xl rounded-lg overflow-hidden">
        <div className="p-4 sm:p-6 bg-card-foreground/5 border-b border-border">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-semibold text-foreground truncate" title={sharedItem.originalFilename}>
                {sharedItem.originalFilename}
                </h1>
                <Button onClick={handleDownload} variant="outline" size="sm">
                    <Download className="mr-2 h-4 w-4" />
                    Descargar
                </Button>
            </div>
        </div>
        
        <div className="aspect-[16/9] w-full bg-muted flex items-center justify-center overflow-hidden">
          {sharedItem.type === 'image' ? (
            <Image
              src={sharedItem.filePath}
              alt={sharedItem.originalFilename}
              width={1200}
              height={675}
              className="max-w-full max-h-full object-contain"
              data-ai-hint="shared media"
              priority
            />
          ) : sharedItem.type === 'video' ? (
            <video
              src={sharedItem.filePath}
              controls
              autoPlay
              className="max-w-full max-h-full object-contain outline-none"
            >
              Tu navegador no soporta la etiqueta de video.
            </video>
          ) : (
            <p className="text-muted-foreground">Formato de archivo no soportado para visualización.</p>
          )}
        </div>
        
        {sharedLinkInfo && (
            <div className="p-3 sm:p-4 text-center text-xs text-muted-foreground bg-card-foreground/5 border-t border-border">
                Compartido el: {format(new Date(sharedLinkInfo.creationTimestamp), "PPPp", { locale: es })}
            </div>
        )}
      </div>
       <p className="text-xs text-muted-foreground mt-6">
        Impulsado por <Link href="/" className="text-primary hover:underline">PixelSphere</Link>
      </p>
    </div>
  );
}
