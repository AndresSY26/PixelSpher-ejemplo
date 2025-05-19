
"use client";

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import MediaGrid from '@/components/gallery/MediaGrid';
import MediaViewerModal from '@/components/gallery/MediaViewerModal';
import type { MediaItem, UserPreferences } from '@/types';
import { DEFAULT_USER_PREFERENCES } from '@/types';
import { getFavoriteMediaItems, getFavoriteItemIds, toggleFavoriteStatus } from '@/app/actions/favoritesActions';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { Loader2, Heart } from 'lucide-react';
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

export default function FavoritesPage() {
  const { user } = useAuth();
  const userPreferences = user?.preferences || DEFAULT_USER_PREFERENCES;

  const [favoriteItems, setFavoriteItems] = useState<MediaItem[]>([]);
  const [favoriteItemIds, setFavoriteItemIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [currentViewItem, setCurrentViewItem] = useState<MediaItem | null>(null);
  const [currentViewItemIndex, setCurrentViewItemIndex] = useState<number>(-1);
  
  const [showAdultConfirmation, setShowAdultConfirmation] = useState(false);
  const [itemPendingConfirmation, setItemPendingConfirmation] = useState<MediaItem | null>(null);
  const [pendingNavigationArgs, setPendingNavigationArgs] = useState<{ item: MediaItem, index: number } | null>(null);


  const fetchFavorites = useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      setFavoriteItems([]);
      setFavoriteItemIds(new Set());
      return;
    }
    setIsLoading(true);
    try {
      const items = await getFavoriteMediaItems(user.id);
      setFavoriteItems(items);
      const ids = await getFavoriteItemIds(user.id);
      setFavoriteItemIds(new Set(ids));
    } catch (error) {
      toast({ title: "Error", description: "No se pudieron cargar los favoritos.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [toast, user]);

  useEffect(() => {
    fetchFavorites();
  }, [fetchFavorites]);

  const handleFavoriteToggled = async (itemId: string, isNowFavorite: boolean) => {
    if (!user) return;
    
    // Optimistic UI update for speed
    if (!isNowFavorite) { // If un-favoriting
      setFavoriteItems(prevItems => prevItems.filter(item => item.id !== itemId));
      setFavoriteItemIds(prevIds => {
        const newIds = new Set(prevIds);
        newIds.delete(itemId);
        return newIds;
      });
    } else { // If favoriting (should not happen from this page if item is already fav)
        // To handle this edge case, we can refetch or add item locally if we have its data
    }

    // Server action
    const result = await toggleFavoriteStatus(itemId, user.id);
    if (!result.success) {
        toast({ title: "Error", description: result.error || "No se pudo actualizar el estado de favorito.", variant: "destructive" });
        fetchFavorites(); // Revert UI on error by refetching
    } else {
       // If operation was to favorite and it's not on the list yet (e.g., edge case)
       if (result.isFavorite && !favoriteItems.find(item => item.id === itemId)) {
           fetchFavorites(); // Refresh to add it if it's not already there.
       }
    }
  };

  const openViewerWithItem = (item: MediaItem, index: number) => {
    setCurrentViewItem(item);
    setCurrentViewItemIndex(index);
    setIsViewerOpen(true);
  };

  const handleOpenViewer = (item: MediaItem) => {
    const itemIndex = favoriteItems.findIndex(i => i.id === item.id);
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
    
    if (targetIndex >= 0 && targetIndex < favoriteItems.length) {
      const newItem = favoriteItems[targetIndex];
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
        <p>Por favor, inicia sesión para ver tus favoritos.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-3xl font-bold">Favoritos</CardTitle>
          <CardDescription>
            {favoriteItems.length > 0 
              ? `Mostrando ${favoriteItems.length} ítem(s) marcado(s) como favoritos.`
              : "No has añadido nada a favoritos todavía."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {favoriteItems.length > 0 ? (
            <MediaGrid
              items={favoriteItems}
              isSelectMode={false} 
              selectedItems={new Set()}
              onItemSelect={() => {}} 
              onOpenViewer={handleOpenViewer}
              passPropsToCards={{ 
                getInitialIsFavorite: (itemId: string) => favoriteItemIds.has(itemId),
                onFavoriteToggle: handleFavoriteToggled 
              }}
              gallerySortOrder={userPreferences.defaultGallerySort}
            />
          ) : (
            !isLoading && (
              <div className="text-center py-10">
                <Heart className="mx-auto h-24 w-24 text-muted-foreground" />
                <p className="mt-4 text-xl font-semibold text-muted-foreground">Tu lista de favoritos está vacía.</p>
                <p className="text-sm text-muted-foreground">Marca ítems como favoritos en la galería para verlos aquí.</p>
              </div>
            )
          )}
        </CardContent>
      </Card>

      <MediaViewerModal
        isOpen={isViewerOpen}
        item={currentViewItem}
        onClose={handleCloseViewer}
        onNavigate={handleNavigateViewer}
        canNavigatePrev={currentViewItemIndex > 0}
        canNavigateNext={currentViewItemIndex < favoriteItems.length - 1}
        onFavoriteToggledInModal={handleFavoriteToggled}
        userPreferences={userPreferences}
      />

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

