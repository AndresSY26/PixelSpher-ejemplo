
"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger
} from '@/components/ui/dialog';
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
import UploadForm from '@/components/gallery/UploadForm';
import MediaGrid from '@/components/gallery/MediaGrid';
import MediaViewerModal from '@/components/gallery/MediaViewerModal';
import AddToAlbumModal from '@/components/albums/AddToAlbumModal';
import type { MediaItem, UserPreferences } from '@/types';
import { DEFAULT_USER_PREFERENCES } from '@/types';
import { getGalleryItems, deleteGalleryItemsAndMoveToTrash, moveItemsToPrivateFolder } from '@/app/actions/galleryActions';
import { getFavoriteItemIds, toggleFavoriteStatus } from '@/app/actions/favoritesActions';
import { useToast } from '@/hooks/use-toast';
import { PlusCircle, Image as ImageIcon, Video as VideoIcon, CheckSquare, ListFilter, Loader2, Trash2, Plus, Lock, Album, ShieldAlert, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';

export type FilterType = "all" | "images" | "videos";

export default function GalleryPage() {
  const { user } = useAuth();
  const userPreferences = user?.preferences || DEFAULT_USER_PREFERENCES;

  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [favoriteItemIds, setFavoriteItemIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<FilterType>("all");
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [currentViewItem, setCurrentViewItem] = useState<MediaItem | null>(null);
  const [currentViewItemIndex, setCurrentViewItemIndex] = useState<number>(-1);

  const [showAdultConfirmation, setShowAdultConfirmation] = useState(false);
  const [itemPendingConfirmation, setItemPendingConfirmation] = useState<MediaItem | null>(null);
  const [pendingNavigationArgs, setPendingNavigationArgs] = useState<{ item: MediaItem, index: number } | null>(null);

  const [isProcessing, setIsProcessing] = useState(false); 
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [showMoveToPrivateConfirmation, setShowMoveToPrivateConfirmation] = useState(false);

  const [showFab, setShowFab] = useState(false);
  const mainUploadButtonRef = useRef<HTMLButtonElement>(null);

  const [isAddToAlbumModalOpen, setIsAddToAlbumModalOpen] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = userPreferences.galleryItemsPerPage || DEFAULT_USER_PREFERENCES.galleryItemsPerPage || 50;


  const { toast } = useToast();

  const fetchMediaAndFavorites = useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      setMediaItems([]);
      setFavoriteItemIds(new Set());
      return;
    }
    setIsLoading(true);
    try {
      const [items, favIds] = await Promise.all([
        getGalleryItems(user.id),
        getFavoriteItemIds(user.id)
      ]);
      setMediaItems(items);
      setFavoriteItemIds(new Set(favIds));
      setCurrentPage(1); 
    } catch (error) {
      toast({ title: "Error", description: "No se pudieron cargar los elementos de la galería.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [toast, user]);

  useEffect(() => {
    fetchMediaAndFavorites();
  }, [fetchMediaAndFavorites]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setShowFab(!entry.isIntersecting);
      },
      { root: null, threshold: 0 }
    );
    const currentButton = mainUploadButtonRef.current;
    if (currentButton && !isLoading) { 
        observer.observe(currentButton);
    }
    return () => { if (currentButton) observer.unobserve(currentButton); };
  }, [isLoading]); 

  const sortedAndFilteredMediaItems = useMemo(() => {
    let itemsToProcess = [...mediaItems];
    
    const sortOrder = userPreferences.defaultGallerySort || 'chronological_desc';
    itemsToProcess.sort((a, b) => {
      switch (sortOrder) {
        case 'chronological_asc':
          return new Date(a.uploadTimestamp).getTime() - new Date(b.uploadTimestamp).getTime();
        case 'name_asc':
          return a.originalFilename.localeCompare(b.originalFilename);
        case 'name_desc':
          return b.originalFilename.localeCompare(a.originalFilename);
        case 'chronological_desc':
        default:
          return new Date(b.uploadTimestamp).getTime() - new Date(a.uploadTimestamp).getTime();
      }
    });
    
    return itemsToProcess.filter(item => {
      if (filter === "images") return item.type === "image";
      if (filter === "videos") return item.type === "video";
      return true;
    });
  }, [mediaItems, filter, userPreferences.defaultGallerySort]);

  const paginatedMediaItems = useMemo(() => {
    if (itemsPerPage === 999999) return sortedAndFilteredMediaItems; 
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return sortedAndFilteredMediaItems.slice(startIndex, endIndex);
  }, [sortedAndFilteredMediaItems, currentPage, itemsPerPage]);

  const totalPages = useMemo(() => {
    if (itemsPerPage === 999999) return 1;
    return Math.ceil(sortedAndFilteredMediaItems.length / itemsPerPage);
  }, [sortedAndFilteredMediaItems.length, itemsPerPage]);

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1);
    } else if (totalPages === 0 && currentPage !== 1) {
        setCurrentPage(1); 
    }
  }, [filter, totalPages, currentPage]);



  const handleUploadSuccess = (newItems: MediaItem[]) => {
    fetchMediaAndFavorites(); 
    setIsUploadDialogOpen(false);
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

  const openViewerWithItem = (item: MediaItem, index: number) => {
    setCurrentViewItem(item);
    const globalIndex = sortedAndFilteredMediaItems.findIndex(i => i.id === item.id);
    setCurrentViewItemIndex(globalIndex);
    setIsViewerOpen(true);
  };
  
  const handleOpenViewer = (item: MediaItem) => {
    const itemIndexInPage = paginatedMediaItems.findIndex(i => i.id === item.id);
    if (itemIndexInPage === -1) return;

    if (item.adultContent && !isViewerOpen) { 
      setItemPendingConfirmation(item);
      const globalIndex = sortedAndFilteredMediaItems.findIndex(i => i.id === item.id);
      setPendingNavigationArgs({ item, index: globalIndex });
      setShowAdultConfirmation(true);
    } else {
      openViewerWithItem(item, itemIndexInPage);
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
    if (currentViewItemIndex === -1) { 
      if (pendingNavigationArgs) targetIndex = pendingNavigationArgs.index;
      else return;
    } else targetIndex = direction === 'prev' ? currentViewItemIndex - 1 : currentViewItemIndex + 1;
  
    if (targetIndex >= 0 && targetIndex < sortedAndFilteredMediaItems.length) {
      const newItem = sortedAndFilteredMediaItems[targetIndex];
      if (newItem.adultContent && !isViewerOpen) { 
        setItemPendingConfirmation(newItem);
        setPendingNavigationArgs({ item: newItem, index: targetIndex });
        setShowAdultConfirmation(true);
      } else {
        const pageForItem = Math.floor(targetIndex / itemsPerPage) + 1;
        if (pageForItem !== currentPage && itemsPerPage !== 999999) {
          setCurrentPage(pageForItem); 
        }
        openViewerWithItem(newItem, targetIndex % itemsPerPage); 
      }
    }
  };
  
  const handleConfirmAdultContent = () => {
    if (pendingNavigationArgs) {
        const {item, index} = pendingNavigationArgs;
        const pageForItem = Math.floor(index / itemsPerPage) + 1;
        if (pageForItem !== currentPage && itemsPerPage !== 999999) {
          setCurrentPage(pageForItem);
        }
        setCurrentViewItem(item);
        setCurrentViewItemIndex(index);
        setIsViewerOpen(true);
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

  const handleDeleteRequest = () => {
    if (selectedItems.size === 0) return;
    if (userPreferences.confirmMoveToTrash) {
      setShowDeleteConfirmation(true);
    } else {
      confirmDeleteSelected();
    }
  };

  const confirmDeleteSelected = async () => {
    if (!user) return;
    setShowDeleteConfirmation(false);
    if (selectedItems.size === 0) return;
    setIsProcessing(true);
    try {
      const itemIds = Array.from(selectedItems);
      const result = await deleteGalleryItemsAndMoveToTrash(itemIds, user.id);
      if (result.success) {
        toast({ title: "Elementos Movidos a la Papelera", description: `${result.movedCount} elemento(s) movido(s) a la papelera.` });
        fetchMediaAndFavorites(); 
        setIsSelectMode(false); setSelectedItems(new Set()); 
      } else toast({ title: "Error al Mover a la Papelera", description: result.error || "No se pudieron mover los elementos a la papelera.", variant: "destructive" });
    } catch (error) {
      toast({ title: "Error Inesperado", description: "Ocurrió un error inesperado al mover elementos a la papelera.", variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleMoveToPrivateRequest = () => {
    if (selectedItems.size === 0) return;
    if (userPreferences.confirmMoveToPrivate) {
        setShowMoveToPrivateConfirmation(true);
    } else {
        confirmMoveToPrivateSelected();
    }
  };
  
  const confirmMoveToPrivateSelected = async () => {
    if (!user) return;
    setShowMoveToPrivateConfirmation(false);
    if (selectedItems.size === 0) return;
    setIsProcessing(true);
    try {
      const itemIds = Array.from(selectedItems);
      const result = await moveItemsToPrivateFolder(itemIds, user.id);
      if (result.success) {
        toast({ title: "Elementos Movidos a Privada", description: `${result.movedCount} elemento(s) movido(s) a la carpeta privada.` });
        fetchMediaAndFavorites(); 
        setIsSelectMode(false); setSelectedItems(new Set()); 
      } else toast({ title: "Error al Mover a Privada", description: result.error || "No se pudieron mover los elementos a la carpeta privada.", variant: "destructive" });
    } catch (error) {
      toast({ title: "Error Inesperado", description: "Ocurrió un error inesperado al mover elementos a la carpeta privada.", variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleOpenAddToAlbumModal = () => {
    if (selectedItems.size === 0) {
      toast({ title: "Sin Elementos Seleccionados", description: "Por favor, selecciona elementos para añadir a un álbum." });
      return;
    }
    setIsAddToAlbumModalOpen(true);
  };

  const handleItemsAddedToAlbum = () => {
    setIsSelectMode(false);
    setSelectedItems(new Set());
  };

  const handleFavoriteToggledInGallery = async (itemId: string, isNowFavorite: boolean) => {
    if (!user) return;
    // Optimistic UI update
    setFavoriteItemIds(prevIds => {
      const newIds = new Set(prevIds);
      if (isNowFavorite) newIds.add(itemId);
      else newIds.delete(itemId);
      return newIds;
    });

    // Server action
    const result = await toggleFavoriteStatus(itemId, user.id);
    if (!result.success) {
        toast({ title: "Error", description: result.error || "No se pudo actualizar el estado de favorito.", variant: "destructive" });
        // Revert UI on error by refetching
        fetchMediaAndFavorites(); 
    }
  };
  
  if (!user) {
     return (
      <div className="text-center py-10">
        <p>Por favor, inicia sesión para ver tu galería.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-background py-4 border-b mb-2 flex flex-col md:flex-row justify-between items-center gap-4">
        <h1 className="text-3xl font-bold">Galería</h1>
        <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
          <DialogTrigger asChild>
            <Button ref={mainUploadButtonRef}>
              <PlusCircle className="mr-2 h-5 w-5" /> Subir Archivos
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[625px]">
            <DialogHeader><DialogTitle className="text-2xl">Subir Archivos</DialogTitle></DialogHeader>
            <UploadForm onUploadSuccess={handleUploadSuccess} />
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
            {!isSelectMode ? (
              <div className="flex items-center gap-2">
                <Button variant={filter === "all" ? "default" : "outline"} onClick={() => setFilter("all")} size="sm"><ListFilter className="mr-2 h-4 w-4" /> Todos</Button>
                <Button variant={filter === "images" ? "default" : "outline"} onClick={() => setFilter("images")} size="sm"><ImageIcon className="mr-2 h-4 w-4" /> Imágenes</Button>
                <Button variant={filter === "videos" ? "default" : "outline"} onClick={() => setFilter("videos")} size="sm"><VideoIcon className="mr-2 h-4 w-4" /> Videos</Button>
              </div>
            ) : (
              <div className="flex items-center gap-2 flex-wrap">
                <Button variant="destructive" onClick={handleDeleteRequest} size="sm" disabled={selectedItems.size === 0 || isProcessing}>
                  {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />} Eliminar ({selectedItems.size})
                </Button>
                <Button variant="outline" onClick={handleMoveToPrivateRequest} size="sm" disabled={selectedItems.size === 0 || isProcessing}>
                  {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Lock className="mr-2 h-4 w-4" />} Mover a Privada ({selectedItems.size})
                </Button>
                <Button variant="outline" onClick={handleOpenAddToAlbumModal} size="sm" disabled={selectedItems.size === 0 || isProcessing}>
                  {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Album className="mr-2 h-4 w-4" />} Añadir a Álbum ({selectedItems.size})
                </Button>
              </div>
            )}
            <Button variant="outline" onClick={toggleSelectMode} size="sm">
              <CheckSquare className="mr-2 h-4 w-4" /> {isSelectMode ? "Cancelar Selección" : "Seleccionar"}
            </Button>
          </div>

          {isLoading ? (
            <div className="flex justify-center items-center h-64"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>
          ) : paginatedMediaItems.length === 0 ? (
             <p className="text-center text-muted-foreground py-10">No se encontraron elementos con los filtros actuales o la galería está vacía.</p>
          ) : (
            <MediaGrid 
              items={paginatedMediaItems} 
              isSelectMode={isSelectMode}
              selectedItems={selectedItems}
              onItemSelect={handleItemSelect}
              onOpenViewer={handleOpenViewer}
              passPropsToCards={{
                getInitialIsFavorite: (itemId: string) => favoriteItemIds.has(itemId),
                onFavoriteToggle: handleFavoriteToggledInGallery
              }}
              gallerySortOrder={userPreferences.defaultGallerySort || 'chronological_desc'} 
            />
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-8">
              <Button 
                variant="outline" 
                size="icon" 
                onClick={() => handlePageChange(currentPage - 1)} 
                disabled={currentPage === 1}
                aria-label="Página anterior"
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <span className="text-sm font-medium">
                Página {currentPage} de {totalPages}
              </span>
              <Button 
                variant="outline" 
                size="icon" 
                onClick={() => handlePageChange(currentPage + 1)} 
                disabled={currentPage === totalPages}
                aria-label="Página siguiente"
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>
          )}

        </CardContent>
      </Card>

      <MediaViewerModal
        isOpen={isViewerOpen}
        item={currentViewItem}
        onClose={handleCloseViewer}
        onNavigate={handleNavigateViewer}
        canNavigatePrev={currentViewItemIndex > 0}
        canNavigateNext={currentViewItemIndex < sortedAndFilteredMediaItems.length - 1}
        onFavoriteToggledInModal={handleFavoriteToggledInGallery}
        userPreferences={userPreferences}
      />

      <AlertDialog open={showAdultConfirmation} onOpenChange={(open) => { if (!open) handleCancelAdultContent(); setShowAdultConfirmation(open); }}>
        <AlertDialogContent>
          <AlertDialogHeaderComponent><AlertDialogTitleComponent>Confirmación de Contenido</AlertDialogTitleComponent>
            <AlertDialogDescription>Este contenido está marcado como +18. ¿Deseas continuar y ver el contenido?</AlertDialogDescription>
          </AlertDialogHeaderComponent>
          <AlertDialogFooter>
            <AlertDialogCancel asChild><Button variant="outline" onClick={handleCancelAdultContent}>Cancelar</Button></AlertDialogCancel>
            <AlertDialogAction asChild><Button onClick={handleConfirmAdultContent}>Ver Contenido</Button></AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showDeleteConfirmation} onOpenChange={setShowDeleteConfirmation}>
        <AlertDialogContent>
          <AlertDialogHeaderComponent><AlertDialogTitleComponent>Confirmar Eliminación</AlertDialogTitleComponent>
            <AlertDialogDescription>¿Estás seguro de que quieres mover {selectedItems.size} elemento(s) a la papelera?</AlertDialogDescription>
          </AlertDialogHeaderComponent>
          <AlertDialogFooter>
            <AlertDialogCancel asChild><Button variant="outline" onClick={() => setShowDeleteConfirmation(false)} disabled={isProcessing}>Cancelar</Button></AlertDialogCancel>
            <AlertDialogAction asChild><Button onClick={confirmDeleteSelected} disabled={isProcessing} className="bg-destructive hover:bg-destructive/90">{isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Mover a Papelera"}</Button></AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showMoveToPrivateConfirmation} onOpenChange={setShowMoveToPrivateConfirmation}>
        <AlertDialogContent>
          <AlertDialogHeaderComponent>
            <AlertDialogTitleComponent className="flex items-center gap-2"><ShieldAlert className="h-6 w-6 text-amber-500" /> Confirmar Movimiento a Carpeta Privada</AlertDialogTitleComponent>
            <AlertDialogDescription>¿Estás seguro de que quieres mover {selectedItems.size} elemento(s) a tu carpeta privada? Serán protegidos por contraseña.</AlertDialogDescription>
          </AlertDialogHeaderComponent>
          <AlertDialogFooter>
            <AlertDialogCancel asChild><Button variant="outline" onClick={() => setShowMoveToPrivateConfirmation(false)} disabled={isProcessing}>Cancelar</Button></AlertDialogCancel>
            <AlertDialogAction asChild><Button onClick={confirmMoveToPrivateSelected} disabled={isProcessing}> {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Mover a Privada"}</Button></AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {user && isAddToAlbumModalOpen && (
        <AddToAlbumModal isOpen={isAddToAlbumModalOpen} onClose={() => setIsAddToAlbumModalOpen(false)} itemIdsToAdd={Array.from(selectedItems)} onItemsAdded={handleItemsAddedToAlbum} userId={user.id} />
      )}

      <Button
        className={cn(
          'fixed bottom-6 right-6 z-[1000] h-14 w-14 rounded-full shadow-lg transition-all duration-300 ease-in-out',
          'flex items-center justify-center bg-primary text-primary-foreground hover:bg-primary/90', 
          showFab ? 'opacity-100 scale-100 pointer-events-auto' : 'opacity-0 scale-90 pointer-events-none'
        )}
        onClick={() => setIsUploadDialogOpen(true)} aria-label="Subir nuevos archivos" title="Subir nuevos archivos"
      >
        <Plus />
      </Button>
    </div>
  );
}

