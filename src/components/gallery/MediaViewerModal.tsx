
"use client";

import type { MediaItem, UserPreferences } from '@/types';
import { DEFAULT_USER_PREFERENCES } from '@/types';
import { Dialog, DialogContent, DialogOverlay, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, X as CloseIcon, Heart, Loader2, CloudDownload, CheckCircle } from 'lucide-react'; // Changed CheckCloud to CheckCircle
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { toggleFavoriteStatus, isItemFavorite } from '@/app/actions/favoritesActions';
import { toggleOfflineItem, isItemOffline } from '@/app/actions/offlineActions'; 
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';

interface MediaViewerModalProps {
  isOpen: boolean;
  item: MediaItem | null;
  onClose: () => void;
  onNavigate: (direction: 'prev' | 'next') => void;
  canNavigatePrev: boolean;
  canNavigateNext: boolean;
  onFavoriteToggledInModal?: (itemId: string, isFavorite: boolean) => void;
  userPreferences?: UserPreferences;
}

export default function MediaViewerModal({
  isOpen,
  item,
  onClose,
  onNavigate,
  canNavigatePrev,
  canNavigateNext,
  onFavoriteToggledInModal,
  userPreferences = DEFAULT_USER_PREFERENCES,
}: MediaViewerModalProps) {
  const [videoError, setVideoError] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [isLoadingFavorite, setIsLoadingFavorite] = useState(false);
  const [isOfflineViewerItem, setIsOfflineViewerItem] = useState(false); 
  const [isLoadingOfflineViewerItem, setIsLoadingOfflineViewerItem] = useState(false); 
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    if (item && user) {
      setVideoError(false);
      // Fetch Favorite Status
      setIsLoadingFavorite(true);
      isItemFavorite(item.id, user.id).then(status => {
        setIsFavorite(status);
        setIsLoadingFavorite(false);
      });
      // Fetch Offline Status
      setIsLoadingOfflineViewerItem(true);
      isItemOffline(user.id, item.id).then(status => {
        setIsOfflineViewerItem(status);
        setIsLoadingOfflineViewerItem(false);
      });
    }
  }, [item, user]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isOpen || !item) return;
      if (event.key === 'Escape') {
        onClose();
      } else if (event.key === 'ArrowLeft' && canNavigatePrev) {
        onNavigate('prev');
      } else if (event.key === 'ArrowRight' && canNavigateNext) {
        onNavigate('next');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, item, onClose, onNavigate, canNavigatePrev, canNavigateNext]);

  const handleFavoriteClick = async () => {
    if (!item || !user) return;
    setIsLoadingFavorite(true);
    const result = await toggleFavoriteStatus(item.id, user.id);
    if (result.success) {
      setIsFavorite(result.isFavorite);
      toast({
        title: result.isFavorite ? "Añadido a Favoritos" : "Quitado de Favoritos",
      });
      if (onFavoriteToggledInModal) {
        onFavoriteToggledInModal(item.id, result.isFavorite);
      }
    } else {
      toast({ title: "Error", description: result.error || "No se pudo actualizar el estado de favorito.", variant: "destructive" });
    }
    setIsLoadingFavorite(false);
  };

  const handleOfflineClick = async () => {
    if (!item || !user) return;
    setIsLoadingOfflineViewerItem(true);
    const result = await toggleOfflineItem(user.id, item.id);
    if (result.success) {
        setIsOfflineViewerItem(result.isOffline);
        toast({
            title: result.isOffline ? "Marcado para Sin Conexión" : "Quitado de Sin Conexión",
        });
    } else {
        toast({ title: "Error", description: result.error || "No se pudo actualizar el estado sin conexión.", variant: "destructive" });
    }
    setIsLoadingOfflineViewerItem(false);
  };


  if (!isOpen || !item) {
    return null;
  }

  const shouldAutoplayVideo = userPreferences.lightboxVideoAutoplay;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogOverlay className="bg-black/80 backdrop-blur-sm" />
      <DialogContent className="max-w-screen-xl w-[95vw] h-[90vh] p-0 bg-transparent border-0 shadow-none flex flex-col items-center justify-center outline-none focus:outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
        <div className="absolute top-4 right-4 z-50 flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/20 hover:text-white"
              onClick={handleFavoriteClick}
              disabled={isLoadingFavorite}
              aria-label={isFavorite ? "Quitar de favoritos" : "Añadir a favoritos"}
              title={isFavorite ? "Quitar de favoritos" : "Añadir a favoritos"}
            >
              {isLoadingFavorite ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                <Heart className={cn("h-6 w-6", isFavorite ? "text-destructive fill-destructive" : "text-white hover:text-destructive/80")} />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/20 hover:text-white"
              onClick={handleOfflineClick}
              disabled={isLoadingOfflineViewerItem}
              aria-label={isOfflineViewerItem ? "Quitar de sin conexión" : "Marcar para sin conexión"}
              title={isOfflineViewerItem ? "Quitar de sin conexión" : "Marcar para sin conexión"}
            >
              {isLoadingOfflineViewerItem ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                isOfflineViewerItem ? <CheckCircle className="h-6 w-6 text-primary" /> : <CloudDownload className="h-6 w-6 text-white hover:text-primary/80" />
              )}
            </Button>
            <DialogClose asChild>
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/20 hover:text-white"
                onClick={onClose}
                aria-label="Cerrar visor"
              >
                <CloseIcon className="h-8 w-8" />
              </Button>
            </DialogClose>
        </div>

        <div className="relative w-full h-full flex items-center justify-center">
          {/* Previous Button */}
          {canNavigatePrev && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute left-4 top-1/2 -translate-y-1/2 z-50 text-white hover:bg-white/20 hover:text-white p-2 rounded-full disabled:opacity-50"
              onClick={() => onNavigate('prev')}
              disabled={!canNavigatePrev}
              aria-label="Anterior"
            >
              <ChevronLeft className="h-10 w-10" />
            </Button>
          )}

          {/* Media Content */}
          <div className="w-full h-full max-w-full max-h-full flex items-center justify-center overflow-hidden">
            {item.type === 'image' && item.filePath ? (
              <Image
                src={item.filePath}
                alt={item.originalFilename}
                layout="intrinsic"
                width={1920}
                height={1080}
                objectFit="contain"
                className="max-w-full max-h-full block"
                data-ai-hint="gallery image"
                priority
                onError={(e) => {
                  e.currentTarget.src = `https://placehold.co/1200x800.png?text=Error`;
                  e.currentTarget.alt = `Error loading ${item.originalFilename}`;
                }}
              />
            ) : item.type === 'video' && item.filePath ? (
               videoError ? (
                 <div className="text-white text-center">
                    <p>Error al cargar el video.</p>
                    <p className="text-sm text-gray-400">{item.originalFilename}</p>
                 </div>
               ) : (
                <video
                  key={item.id}
                  src={item.filePath}
                  controls
                  autoPlay={shouldAutoplayVideo}
                  muted={shouldAutoplayVideo}
                  preload="auto"
                  className="max-w-full max-h-full block outline-none"
                  onError={() => {
                    console.warn(`Error loading video in viewer: ${item.filePath}`);
                    setVideoError(true);
                  }}
                >
                  Tu navegador no soporta la etiqueta de video.
                </video>
               )
            ) : (
              <div className="text-white">Contenido no disponible.</div>
            )}
          </div>

          {/* Next Button */}
          {canNavigateNext && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-4 top-1/2 -translate-y-1/2 z-50 text-white hover:bg-white/20 hover:text-white p-2 rounded-full disabled:opacity-50"
              onClick={() => onNavigate('next')}
              disabled={!canNavigateNext}
              aria-label="Siguiente"
            >
              <ChevronRight className="h-10 w-10" />
            </Button>
          )}
        </div>
        {/* Optional: Filename display */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50 bg-black/50 text-white px-3 py-1.5 rounded-md text-sm">
          {item.originalFilename}
        </div>
      </DialogContent>
    </Dialog>
  );
}
