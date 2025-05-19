
"use client";

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import MediaGrid from '@/components/gallery/MediaGrid';
import MediaViewerModal from '@/components/gallery/MediaViewerModal';
import type { MediaItem, UserSpecificShare, User, UserPreferences } from '@/types';
import { DEFAULT_USER_PREFERENCES } from '@/types';
import { getSharesForUser } from '@/app/actions/shareActions';
import { getGalleryItems } from '@/app/actions/galleryActions';
import { getUserById } from '@/app/actions/authActions';
import { getFavoriteItemIds, toggleFavoriteStatus } from '@/app/actions/favoritesActions';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { Loader2, Users, Info, Film, Image as LucideImageIcon } from 'lucide-react';
import Image from 'next/image'; // Added for direct thumbnail display
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader as AlertDialogHeaderComponent,
  AlertDialogTitle as AlertDialogTitleComponent,
} from "@/components/ui/alert-dialog";
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils'; // For conditional blurring

interface SharedWithMeItem extends MediaItem {
  sharedByUsername: string;
  sharedByUserId: string;
  shareTimestamp: string;
  shareMessage?: string;
}

function SharedItemThumbnail({ item, onOpenViewer }: { item: SharedWithMeItem; onOpenViewer: (item: MediaItem) => void; }) {
  const [videoError, setVideoError] = useState(false);

  // Handle adult content blur for the thumbnail itself if desired, or rely on lightbox
  const isAdultAndShouldBlur = item.adultContent; // Simplified: direct blur if adult

  return (
    <div 
      className="w-24 h-24 sm:w-32 sm:h-32 shrink-0 rounded-md overflow-hidden bg-muted cursor-pointer relative group"
      onClick={() => onOpenViewer(item)}
    >
      {item.type === 'image' && item.filePath ? (
        <Image
          src={item.filePath}
          alt={item.originalFilename}
          fill
          sizes="(max-width: 640px) 10vw, 8rem"
          className={cn("object-cover", isAdultAndShouldBlur && "filter blur-sm group-hover:blur-none transition-all")}
          data-ai-hint="shared media"
          onError={(e) => {
            e.currentTarget.src = `https://placehold.co/128x128.png?text=Error`;
            e.currentTarget.alt = `Error loading ${item.originalFilename}`;
          }}
        />
      ) : item.type === 'video' && item.filePath ? (
        videoError ? (
          <div className="w-full h-full flex items-center justify-center bg-muted">
            <Film className="w-10 h-10 text-muted-foreground" />
          </div>
        ) : (
          <video
            key={item.filePath || item.id}
            src={item.filePath}
            muted
            preload="metadata"
            className={cn("object-cover w-full h-full", isAdultAndShouldBlur && "filter blur-sm group-hover:blur-none transition-all")}
            onLoadedData={(e) => { e.currentTarget.currentTime = 0.1; }}
            onError={() => { console.warn(`Failed to load video preview: ${item.filePath}`); setVideoError(true); }}
            controls={false}
            playsInline
          />
        )
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-muted">
          {item.type === 'video' ? <Film className="w-10 h-10 text-muted-foreground" /> : <LucideImageIcon className="w-10 h-10 text-muted-foreground" />}
        </div>
      )}
      {isAdultAndShouldBlur && (
        <div className="absolute inset-0 z-5 flex items-center justify-center bg-black/30 opacity-100 group-hover:opacity-0 transition-opacity">
           {/* Optionally add an icon here if the blur isn't enough */}
        </div>
      )}
    </div>
  );
}


export default function SharedWithMePage() {
  const { user } = useAuth();
  const userPreferences = user?.preferences || DEFAULT_USER_PREFERENCES;

  const [sharedItems, setSharedItems] = useState<SharedWithMeItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [currentViewItem, setCurrentViewItem] = useState<SharedWithMeItem | null>(null);
  const [currentViewItemIndex, setCurrentViewItemIndex] = useState<number>(-1);
  
  const [showAdultConfirmation, setShowAdultConfirmation] = useState(false);
  const [itemPendingConfirmation, setItemPendingConfirmation] = useState<SharedWithMeItem | null>(null);
  const [pendingNavigationArgs, setPendingNavigationArgs] = useState<{ item: SharedWithMeItem, index: number } | null>(null);
  const [favoriteItemIds, setFavoriteItemIds] = useState<Set<string>>(new Set());


  const fetchSharedItems = useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      setSharedItems([]);
      return;
    }
    setIsLoading(true);
    try {
      const shares = await getSharesForUser(user.id);
      if (shares.length === 0) {
        setSharedItems([]);
        setIsLoading(false);
        return;
      }

      const ownerIds = [...new Set(shares.map(s => s.ownerUserId))];
      // const itemIds = shares.map(s => s.itemId); // Not directly used for fetching all gallery items

      const [allGalleryItems, favIds, ...ownerDetailsArr] = await Promise.all([
        getGalleryItems(), // Get all gallery items, then filter
        getFavoriteItemIds(user.id),
        ...ownerIds.map(id => getUserById(id))
      ]);
      
      const ownersMap = new Map<string, User>();
      ownerDetailsArr.forEach(owner => {
        if (owner) ownersMap.set(owner.id, owner);
      });

      const populatedItems: SharedWithMeItem[] = [];
      for (const share of shares) {
        const item = allGalleryItems.find(i => i.id === share.itemId && i.ownerUserId === share.ownerUserId);
        const owner = ownersMap.get(share.ownerUserId);
        if (item && owner) {
          populatedItems.push({
            ...item,
            sharedByUsername: owner.name || owner.username,
            sharedByUserId: owner.id,
            shareTimestamp: share.shareTimestamp,
            shareMessage: share.message,
          });
        }
      }
      setSharedItems(populatedItems.sort((a, b) => new Date(b.shareTimestamp).getTime() - new Date(a.shareTimestamp).getTime()));
      setFavoriteItemIds(new Set(favIds));

    } catch (error) {
      console.error("Error fetching shared items:", error);
      toast({ title: "Error", description: "No se pudieron cargar los ítems compartidos contigo.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [user, toast]);

  useEffect(() => {
    fetchSharedItems();
  }, [fetchSharedItems]);
  
  const handleFavoriteToggled = async (itemId: string, isNowFavorite: boolean) => {
    if (!user) return;
    setFavoriteItemIds(prevIds => {
      const newIds = new Set(prevIds);
      if (isNowFavorite) newIds.add(itemId);
      else newIds.delete(itemId);
      return newIds;
    });

    const result = await toggleFavoriteStatus(itemId, user.id);
    if (!result.success) {
        toast({ title: "Error", description: result.error || "No se pudo actualizar el estado de favorito.", variant: "destructive" });
        fetchSharedItems(); 
    }
  };


  const openViewerWithItem = (item: SharedWithMeItem, index: number) => {
    setCurrentViewItem(item);
    setCurrentViewItemIndex(index);
    setIsViewerOpen(true);
  };

  const handleOpenViewer = (itemFromCard: MediaItem) => { 
    const item = sharedItems.find(si => si.id === itemFromCard.id); 
    if (!item) return;
    const itemIndex = sharedItems.findIndex(i => i.id === item.id);
    if (itemIndex === -1) return;

    if (item.adultContent && !isViewerOpen) {
      setItemPendingConfirmation(item);
      setPendingNavigationArgs({ item, index: itemIndex });
      setShowAdultConfirmation(true);
    } else {
      openViewerWithItem(item, itemIndex);
    }
  };

  const handleCloseViewer = () => {
    setIsViewerOpen(false);
    setCurrentViewItem(null);
    setCurrentViewItemIndex(-1);
    setItemPendingConfirmation(null);
    setPendingNavigationArgs(null);
  };

  const handleNavigateViewer = (direction: 'prev' | 'next') => {
    let targetIndex: number;
    const baseIndex = currentViewItemIndex !== -1 ? currentViewItemIndex : (pendingNavigationArgs ? pendingNavigationArgs.index : -1);
    if(baseIndex === -1) return;

    targetIndex = direction === 'prev' ? baseIndex - 1 : baseIndex + 1;
    
    if (targetIndex >= 0 && targetIndex < sharedItems.length) {
      const newItem = sharedItems[targetIndex];
      if (newItem.adultContent && !isViewerOpen) { 
        setItemPendingConfirmation(newItem);
        setPendingNavigationArgs({ item: newItem, index: targetIndex });
        setShowAdultConfirmation(true);
      } else {
        openViewerWithItem(newItem, targetIndex);
      }
    }
  };

  const handleConfirmAdultContent = () => {
    if (pendingNavigationArgs) {
      openViewerWithItem(pendingNavigationArgs.item, pendingNavigationArgs.index);
    }
    setShowAdultConfirmation(false);
    setItemPendingConfirmation(null);
    setPendingNavigationArgs(null);
  };

  const handleCancelAdultContent = () => {
    setShowAdultConfirmation(false);
    setItemPendingConfirmation(null);
    setPendingNavigationArgs(null);
  };

  if (isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }
  
  if (!user) {
     return (
      <div className="text-center py-10">
        <p>Por favor, inicia sesión para ver los ítems compartidos contigo.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-3xl font-bold flex items-center gap-2">
            <Users className="h-8 w-8 text-primary" />
            Compartido Conmigo
          </CardTitle>
          <CardDescription>
            {sharedItems.length > 0 
              ? `Mostrando ${sharedItems.length} ítem(s) que otros usuarios han compartido contigo.`
              : "Nadie ha compartido nada contigo todavía."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sharedItems.length > 0 ? (
            <div className="space-y-4">
              {sharedItems.map(item => (
                <Card key={item.id} className="p-4 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex flex-col sm:flex-row gap-4 items-start">
                    <SharedItemThumbnail item={item} onOpenViewer={() => handleOpenViewer(item)} />
                    <div className="flex-grow">
                      <h3 
                        className="text-lg font-semibold hover:text-primary cursor-pointer truncate" 
                        onClick={() => handleOpenViewer(item)}
                        title={item.originalFilename}
                      >
                        {item.originalFilename}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Compartido por: <span className="font-medium text-foreground">{item.sharedByUsername}</span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Fecha de compartición: {format(new Date(item.shareTimestamp), "d MMM yyyy, HH:mm", { locale: es })}
                      </p>
                      {item.shareMessage && (
                        <p className="mt-2 text-sm italic bg-muted/30 p-2 rounded-md">{item.shareMessage}</p>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            !isLoading && (
              <div className="text-center py-10">
                <Info className="mx-auto h-24 w-24 text-muted-foreground" />
                <p className="mt-4 text-xl font-semibold text-muted-foreground">Nada compartido contigo aún.</p>
                <p className="text-sm text-muted-foreground">Cuando otros usuarios compartan ítems contigo, aparecerán aquí.</p>
              </div>
            )
          )}
        </CardContent>
      </Card>

      {currentViewItem && (
        <MediaViewerModal
          isOpen={isViewerOpen}
          item={currentViewItem} 
          onClose={handleCloseViewer}
          onNavigate={handleNavigateViewer}
          canNavigatePrev={currentViewItemIndex > 0}
          canNavigateNext={currentViewItemIndex < sharedItems.length - 1}
          onFavoriteToggledInModal={handleFavoriteToggled}
          userPreferences={userPreferences}
        />
      )}

      <AlertDialog open={showAdultConfirmation} onOpenChange={(open) => {
          if (!open) handleCancelAdultContent(); 
          setShowAdultConfirmation(open);
      }}>
        <AlertDialogContent>
          <AlertDialogHeaderComponent>
            <AlertDialogTitleComponent>Confirmación de Contenido</AlertDialogTitleComponent>
            <AlertDialogDescription>
              Este contenido está marcado como +18. ¿Deseas continuar y ver el contenido?
            </AlertDialogDescription>
          </AlertDialogHeaderComponent>
          <AlertDialogFooter>
            <AlertDialogCancel asChild><Button variant="outline" onClick={handleCancelAdultContent}>Cancelar</Button></AlertDialogCancel>
            <AlertDialogAction asChild><Button onClick={handleConfirmAdultContent}>Ver Contenido</Button></AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}


    