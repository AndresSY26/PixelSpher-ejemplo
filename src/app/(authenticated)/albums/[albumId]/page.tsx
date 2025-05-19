
"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import MediaGrid from '@/components/gallery/MediaGrid';
import MediaViewerModal from '@/components/gallery/MediaViewerModal';
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
import type { Album, MediaItem, UserPreferences } from '@/types';
import { DEFAULT_USER_PREFERENCES } from '@/types';
import { getMediaItemsForAlbum, removeItemFromAlbum } from '@/app/actions/albumActions';
import { getFavoriteItemIds, toggleFavoriteStatus } from '@/app/actions/favoritesActions'; 
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { Loader2, ArrowLeft, Trash2, CheckSquare, XCircle } from 'lucide-react';

export default function AlbumContentPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const userPreferences = user?.preferences || DEFAULT_USER_PREFERENCES;
  const albumId = typeof params.albumId === 'string' ? params.albumId : '';
  
  const [album, setAlbum] = useState<Album | null>(null);
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [favoriteItemIds, setFavoriteItemIds] = useState<Set<string>>(new Set()); 
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [currentViewItem, setCurrentViewItem] = useState<MediaItem | null>(null);
  const [currentViewItemIndex, setCurrentViewItemIndex] = useState<number>(-1);
  
  const [showAdultConfirmation, setShowAdultConfirmation] = useState(false);
  const [itemPendingConfirmation, setItemPendingConfirmation] = useState<MediaItem | null>(null);
  const [pendingNavigationArgs, setPendingNavigationArgs] = useState<{ item: MediaItem, index: number } | null>(null);
  
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [isProcessingAction, setIsProcessingAction] = useState(false);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);


  const fetchAlbumContentAndFavorites = useCallback(async () => {
    if (!user) { // Ensure user context before fetching
        setIsLoading(false);
        toast({ title: "Autenticación Requerida", description: "Por favor, inicia sesión para ver los álbumes.", variant: "destructive" });
        router.push('/login');
        return;
    }
    if (!albumId) {
      setIsLoading(false);
      toast({ title: "Error", description: "ID de álbum no válido.", variant: "destructive" });
      router.push('/albums');
      return;
    }
    setIsLoading(true);
    try {
      const [{ album: fetchedAlbum, items: fetchedItems }, favIds] = await Promise.all([
        getMediaItemsForAlbum(albumId, user.id), // Pass userId
        getFavoriteItemIds(user.id) // Pass userId
      ]);

      if (!fetchedAlbum) {
        toast({ title: "Error", description: "Álbum no encontrado.", variant: "destructive" });
        router.push('/albums');
        return;
      }
      setAlbum(fetchedAlbum);
      setMediaItems(fetchedItems); 
      setFavoriteItemIds(new Set(favIds));
    } catch (error) {
      toast({ title: "Error", description: "No se pudo cargar el contenido del álbum o favoritos.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [albumId, router, toast, user]); // Added user dependency

  useEffect(() => {
    fetchAlbumContentAndFavorites();
  }, [fetchAlbumContentAndFavorites]);

  const handleFavoriteToggledInAlbum = async (itemId: string, isNowFavorite: boolean) => {
    if (!user) return;
    
    // Optimistic UI Update
    setFavoriteItemIds(prevIds => {
      const newIds = new Set(prevIds);
      if (isNowFavorite) newIds.add(itemId);
      else newIds.delete(itemId);
      return newIds;
    });

    // Server action
    const result = await toggleFavoriteStatus(itemId, user.id); // Pass userId
    if (!result.success) {
        toast({ title: "Error", description: result.error || "No se pudo actualizar el estado de favorito.", variant: "destructive" });
        // Revert UI on error by refetching (could be more granular)
        fetchAlbumContentAndFavorites(); 
    }
  };

  const openViewerWithItem = (item: MediaItem, index: number) => {
    setCurrentViewItem(item);
    setCurrentViewItemIndex(index); 
    setIsViewerOpen(true);
  };

  const handleOpenViewer = (item: MediaItem) => {
    const itemIndex = mediaItems.findIndex(i => i.id === item.id);
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
    if (baseIndex === -1) return;

    targetIndex = direction === 'prev' ? baseIndex - 1 : baseIndex + 1;
    
    if (targetIndex >= 0 && targetIndex < mediaItems.length) {
      const newItem = mediaItems[targetIndex];
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
  
  const toggleSelectMode = () => {
    setIsSelectMode(!isSelectMode);
    setSelectedItems(new Set());
  };

  const handleItemSelect = (itemId: string) => {
    setSelectedItems(prevSelected => {
      const newSelected = new Set(prevSelected);
      if (newSelected.has(itemId)) newSelected.delete(itemId);
      else newSelected.add(itemId);
      return newSelected;
    });
  };

  const requestRemoveItemsFromAlbum = () => {
    if(selectedItems.size === 0) return;
    setShowRemoveConfirm(true);
  }

  const handleRemoveItemsFromAlbum = async () => {
    if (!user || !albumId || selectedItems.size === 0) return; // Check for user
    setShowRemoveConfirm(false);
    setIsProcessingAction(true);
    try {
      let successCount = 0;
      for (const itemId of selectedItems) {
        const result = await removeItemFromAlbum(albumId, itemId, user.id); // Pass userId
        if (result.success) {
          successCount++;
        } else {
          toast({ title: "Error Parcial", description: `No se pudo quitar un ítem: ${result.error}`, variant: "destructive" });
        }
      }
      if (successCount > 0) {
        toast({ title: "Ítems Quitado(s)", description: `${successCount} ítem(s) quitado(s) de este álbum.` });
      }
      fetchAlbumContentAndFavorites(); 
      setIsSelectMode(false);
      setSelectedItems(new Set());
    } catch (error) {
      toast({ title: "Error Inesperado", description: "Ocurrió un error al quitar ítems del álbum.", variant: "destructive" });
    } finally {
      setIsProcessingAction(false);
    }
  };


  if (isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }
  
  if (!user) { // Added check for user before rendering album content
     return (
      <div className="text-center py-10">
        <p>Por favor, inicia sesión para ver el contenido del álbum.</p>
         <Link href="/login">
          <Button variant="link" className="mt-4">Ir a Inicio de Sesión</Button>
        </Link>
      </div>
    );
  }


  if (!album) {
    return (
      <div className="text-center py-10">
        <p>Álbum no encontrado.</p>
        <Link href="/albums">
          <Button variant="link" className="mt-4">Volver a Álbumes</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => router.push('/albums')} aria-label="Volver a Álbumes">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-3xl font-bold">{album.name}</h1>
      </div>

      <Card>
        <CardHeader>
            <div className="flex items-center justify-between">
                <CardTitle>Contenido del Álbum</CardTitle>
                {mediaItems.length > 0 && (
                <Button variant="outline" onClick={toggleSelectMode} size="sm">
                  <CheckSquare className="mr-2 h-4 w-4" /> {isSelectMode ? "Cancelar" : "Seleccionar"}
                </Button>
              )}
            </div>
            <CardDescription>
              {mediaItems.length > 0 
                ? `Mostrando ${mediaItems.length} ítem(s) en este álbum.` 
                : "Este álbum está vacío."}
            </CardDescription>
        </CardHeader>
        <CardContent>
          {isSelectMode && selectedItems.size > 0 && (
              <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm p-4 mb-4 border rounded-lg shadow flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium">{selectedItems.size} ítem(s) seleccionados</p>
                <div className="flex gap-2 flex-wrap">
                  <Button onClick={requestRemoveItemsFromAlbum} variant="destructive" size="sm" disabled={isProcessingAction}>
                    {isProcessingAction ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />} 
                    Quitar del Álbum ({selectedItems.size})
                  </Button>
                   <Button variant="ghost" onClick={toggleSelectMode} size="sm" disabled={isProcessingAction}>
                    <XCircle className="mr-2 h-4 w-4" /> Cancelar
                  </Button>
                </div>
              </div>
            )}
          {mediaItems.length > 0 ? (
            <MediaGrid
              items={mediaItems}
              isSelectMode={isSelectMode}
              selectedItems={selectedItems}
              onItemSelect={handleItemSelect}
              onOpenViewer={handleOpenViewer}
              passPropsToCards={{
                getInitialIsFavorite: (itemId: string) => favoriteItemIds.has(itemId),
                onFavoriteToggle: handleFavoriteToggledInAlbum
              }}
              gallerySortOrder={'chronological_desc'} 
            />
          ) : (
            !isLoading && <p className="text-center text-muted-foreground py-10">Este álbum no contiene ningún ítem.</p>
          )}
        </CardContent>
      </Card>

      <MediaViewerModal
        isOpen={isViewerOpen}
        item={currentViewItem}
        onClose={handleCloseViewer}
        onNavigate={handleNavigateViewer}
        canNavigatePrev={currentViewItemIndex > 0}
        canNavigateNext={currentViewItemIndex < mediaItems.length - 1}
        onFavoriteToggledInModal={handleFavoriteToggledInAlbum}
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

      <AlertDialog open={showRemoveConfirm} onOpenChange={setShowRemoveConfirm}>
        <AlertDialogContent>
        <AlertDialogHeaderComponent>
            <AlertDialogTitleComponent>Confirmar Acción</AlertDialogTitleComponent>
            <AlertDialogDescription>
            ¿Estás seguro de que quieres quitar {selectedItems.size} ítem(s) de este álbum? Los ítems no serán eliminados de tu galería.
            </AlertDialogDescription>
        </AlertDialogHeaderComponent>
        <AlertDialogFooter>
            <AlertDialogCancel asChild>
              <Button variant="outline" onClick={() => setShowRemoveConfirm(false)} disabled={isProcessingAction}>
                Cancelar
              </Button>
            </AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button onClick={handleRemoveItemsFromAlbum} disabled={isProcessingAction} className="bg-destructive hover:bg-destructive/90">
                {isProcessingAction ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Quitar del Álbum"}
              </Button>
            </AlertDialogAction>
        </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>

    </div>
  );
}

