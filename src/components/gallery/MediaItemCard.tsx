
"use client";

import Image from 'next/image';
import type { MediaItem } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Film, ImageIcon as LucideImageIcon, EyeOff, Heart, Loader2, CloudDownload, CheckCircle } from 'lucide-react'; // Changed CheckCloud to CheckCircle
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useState, useEffect } from 'react';
import { toggleFavoriteStatus, isItemFavorite } from '@/app/actions/favoritesActions';
import { toggleOfflineItem, isItemOffline } from '@/app/actions/offlineActions'; 
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';

interface MediaItemCardProps {
  item: MediaItem;
  isSelectMode: boolean;
  isSelected: boolean;
  onSelect: (itemId: string) => void;
  onOpenViewer: (item: MediaItem) => void;
  initialIsFavorite?: boolean;
  onFavoriteToggle?: (itemId: string, isFavorite: boolean) => void;
}

export default function MediaItemCard({
  item,
  isSelectMode,
  isSelected,
  onSelect,
  onOpenViewer,
  initialIsFavorite,
  onFavoriteToggle
}: MediaItemCardProps) {
  const [videoError, setVideoError] = useState(false);
  const [isFavorite, setIsFavorite] = useState(initialIsFavorite ?? false);
  const [isLoadingFavorite, setIsLoadingFavorite] = useState(initialIsFavorite === undefined);
  const [isOffline, setIsOffline] = useState(false); 
  const [isLoadingOffline, setIsLoadingOffline] = useState(true); 
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      // Fetch Favorite Status
      if (initialIsFavorite === undefined) {
        setIsLoadingFavorite(true);
        isItemFavorite(item.id, user.id).then(status => {
          setIsFavorite(status);
          setIsLoadingFavorite(false);
        });
      } else {
        setIsFavorite(initialIsFavorite);
        setIsLoadingFavorite(false);
      }
      // Fetch Offline Status
      setIsLoadingOffline(true);
      isItemOffline(user.id, item.id).then(status => {
        setIsOffline(status);
        setIsLoadingOffline(false);
      });
    }
  }, [item.id, initialIsFavorite, user]);

  useEffect(() => {
    setVideoError(false);
  }, [item.id]);

  const handleCardClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('.action-button-area')) {
      return;
    }
    if (isSelectMode) {
      onSelect(item.id);
    } else {
      onOpenViewer(item);
    }
  };

  const handleFavoriteClick = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (!user) return;
    setIsLoadingFavorite(true);
    const result = await toggleFavoriteStatus(item.id, user.id);
    if (result.success) {
      setIsFavorite(result.isFavorite);
      toast({
        title: result.isFavorite ? "Añadido a Favoritos" : "Quitado de Favoritos",
        description: `"${item.originalFilename}" ${result.isFavorite ? 'ahora está en tus favoritos.' : 'ya no está en tus favoritos.'}`,
      });
      if (onFavoriteToggle) {
        onFavoriteToggle(item.id, result.isFavorite);
      }
    } else {
      toast({ title: "Error", description: result.error || "No se pudo actualizar el estado de favorito.", variant: "destructive" });
    }
    setIsLoadingFavorite(false);
  };

  const handleOfflineClick = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (!user) return;
    setIsLoadingOffline(true);
    const result = await toggleOfflineItem(user.id, item.id);
    if (result.success) {
        setIsOffline(result.isOffline);
        toast({
            title: result.isOffline ? "Marcado para Sin Conexión" : "Quitado de Sin Conexión",
            description: `"${item.originalFilename}" ${result.isOffline ? 'ahora está disponible sin conexión.' : 'ya no está marcado para uso sin conexión.'}`,
        });
    } else {
        toast({ title: "Error", description: result.error || "No se pudo actualizar el estado sin conexión.", variant: "destructive" });
    }
    setIsLoadingOffline(false);
  };

  const formattedDate = format(new Date(item.uploadTimestamp), "d MMM yyyy", { locale: es });

  return (
    <Card
      className={cn(
        'overflow-hidden group relative transition-all duration-200 ease-in-out transform hover:scale-105',
        isSelected && isSelectMode ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : '',
        'cursor-pointer'
      )}
      onClick={handleCardClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleCardClick(e as any); }}
    >
      {isSelectMode && (
        <div className="absolute top-2 right-2 z-20">
          <Checkbox
            checked={isSelected}
            onCheckedChange={() => onSelect(item.id)}
            aria-label={`Select ${item.originalFilename}`}
            className="bg-background border-foreground data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
          />
        </div>
      )}

      {!isSelectMode && (
        <div className="action-button-area absolute top-2 right-2 z-20 flex flex-col space-y-1.5">
            <button
              onClick={handleFavoriteClick}
              disabled={isLoadingFavorite}
              className={cn(
                  "p-1.5 rounded-full bg-black/40 hover:bg-black/60 transition-colors",
                  isLoadingFavorite ? "cursor-wait" : ""
              )}
              aria-label={isFavorite ? "Quitar de favoritos" : "Añadir a favoritos"}
              title={isFavorite ? "Quitar de favoritos" : "Añadir a favoritos"}
            >
              {isLoadingFavorite ? <Loader2 className="h-5 w-5 animate-spin text-white" /> :
                <Heart
                    className={cn(
                        "h-5 w-5",
                        isFavorite ? "text-destructive fill-destructive" : "text-white hover:text-destructive/80"
                    )}
                />
              }
            </button>
            <button
              onClick={handleOfflineClick}
              disabled={isLoadingOffline}
              className={cn(
                  "p-1.5 rounded-full bg-black/40 hover:bg-black/60 transition-colors",
                  isLoadingOffline ? "cursor-wait" : ""
              )}
              aria-label={isOffline ? "Quitar de sin conexión" : "Marcar para sin conexión"}
              title={isOffline ? "Quitar de sin conexión" : "Marcar para sin conexión"}
            >
              {isLoadingOffline ? <Loader2 className="h-5 w-5 animate-spin text-white" /> :
                isOffline ? <CheckCircle className="h-5 w-5 text-primary" /> : <CloudDownload className="h-5 w-5 text-white hover:text-primary/80" /> 
              }
            </button>
        </div>
      )}

      <div className={`aspect-square w-full relative bg-muted ${item.adultContent ? 'filter blur-md' : ''}`}>
        {item.type === 'image' && item.filePath ? (
          <Image
            src={item.filePath}
            alt={item.originalFilename}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 20vw"
            className="object-cover"
            data-ai-hint="uploaded image"
            onError={(e) => {
              e.currentTarget.src = `https://placehold.co/300x300.png?text=Error`;
              e.currentTarget.alt = `Error loading ${item.originalFilename}`;
            }}
          />
        ) : item.type === 'video' && item.filePath ? (
          videoError ? (
            <div className="w-full h-full flex items-center justify-center bg-muted">
              <Film className="w-16 h-16 text-muted-foreground" />
            </div>
          ) : (
            <video
              key={item.filePath || item.id}
              src={item.filePath}
              muted
              preload="metadata"
              className="object-cover w-full h-full"
              onLoadedData={(e) => {
                e.currentTarget.currentTime = 0.1;
              }}
              onError={() => {
                console.warn(`Failed to load video preview: ${item.filePath}`);
                setVideoError(true);
              }}
              controls={false}
              playsInline
              loop={false}
            >
              Tu navegador no soporta la etiqueta de video.
            </video>
          )
        ) : item.type === 'video' ? (
            <div className="w-full h-full flex items-center justify-center bg-muted">
                <Film className="w-16 h-16 text-muted-foreground" />
            </div>
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-muted">
            <LucideImageIcon className="w-16 h-16 text-muted-foreground" />
          </div>
        )}

        {item.adultContent && (
          <div
            className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/70 text-gray-100 p-2 select-none"
          >
            <EyeOff className="h-8 w-8 mb-2" />
            <p className="text-center text-sm font-semibold">Contenido para Adultos</p>
            <p className="text-center text-xs">(Clic para ver)</p>
          </div>
        )}
      </div>
      <CardContent className="p-2 text-xs">
        <div className="flex items-center justify-between">
          <p className="font-medium truncate flex-1" title={item.originalFilename}>{item.originalFilename}</p>
          {item.type === 'image' ? <LucideImageIcon className="h-4 w-4 text-muted-foreground ml-1 shrink-0" /> : <Film className="h-4 w-4 text-muted-foreground ml-1 shrink-0" />}
        </div>
        <p className="text-muted-foreground">{formattedDate}</p>
      </CardContent>
    </Card>
  );
}
