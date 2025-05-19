
"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Loader2, Lock, CheckSquare, ArrowLeftRight, Trash2 as TrashIcon, XCircle } from 'lucide-react';
import SetupPrivatePasswordModal from '@/components/private/SetupPrivatePasswordModal';
import EnterPrivatePasswordModal from '@/components/private/EnterPrivatePasswordModal';
import MediaGrid from '@/components/gallery/MediaGrid'; 
import MediaViewerModal from '@/components/gallery/MediaViewerModal';
import { 
  checkPrivatePasswordStatus, 
  getPrivateFolderItems,
  moveItemsFromPrivateToGallery,
  moveItemsFromPrivateToTrash
} from '@/app/actions/privateFolderActions';
import { getFavoriteItemIds } from '@/app/actions/favoritesActions'; 
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
import type { MediaItem, UserPreferences } from '@/types';
import { DEFAULT_USER_PREFERENCES } from '@/types';
import { useToast } from '@/hooks/use-toast';

export default function PrivateFolderPage() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const userPreferences = user?.preferences || DEFAULT_USER_PREFERENCES;
  const { toast } = useToast();
  
  const [isCheckingPassword, setIsCheckingPassword] = useState(true);
  const [isPasswordSet, setIsPasswordSet] = useState(false);
  const [isAuthenticatedToView, setIsAuthenticatedToView] = useState(false);

  const [showSetupModal, setShowSetupModal] = useState(false);
  const [showEnterModal, setShowEnterModal] = useState(false);

  const [privateItems, setPrivateItems] = useState<MediaItem[]>([]);
  const [favoriteItemIds, setFavoriteItemIds] = useState<Set<string>>(new Set()); 
  const [isLoadingItems, setIsLoadingItems] = useState(false);

  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [isProcessingAction, setIsProcessingAction] = useState(false);

  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [currentViewItem, setCurrentViewItem] = useState<MediaItem | null>(null);
  const [currentViewItemIndex, setCurrentViewItemIndex] = useState<number>(-1);

  const [showAdultConfirmation, setShowAdultConfirmation] = useState(false);
  const [itemPendingConfirmation, setItemPendingConfirmation] = useState<MediaItem | null>(null);
  const [pendingNavigationArgs, setPendingNavigationArgs] = useState<{ item: MediaItem, index: number } | null>(null);

  const [showMoveToTrashConfirm, setShowMoveToTrashConfirm] = useState(false);

  const fetchPrivateContentAndFavorites = useCallback(async () => {
    if (!user || !isAuthenticatedToView) return;
    setIsLoadingItems(true);
    try {
      const [items, favIds] = await Promise.all([
        getPrivateFolderItems(user.id),
        getFavoriteItemIds()
      ]);
      setPrivateItems(items); // Items are already sorted by server action
      setFavoriteItemIds(new Set(favIds));
    } catch (error) {
      toast({ title: "Error", description: "No se pudieron cargar los elementos de la carpeta privada.", variant: "destructive" });
    } finally {
      setIsLoadingItems(false);
    }
  }, [user, isAuthenticatedToView, toast]);

  useEffect(() => {
    if (user && !isAuthLoading) {
      const checkStatus = async () => {
        setIsCheckingPassword(true);
        try {
          const status = await checkPrivatePasswordStatus(user.id);
          setIsPasswordSet(status.isPasswordSet);
          if (status.isPasswordSet) setShowEnterModal(true);
          else setShowSetupModal(true); 
        } catch (error) {
          toast({ title: "Error", description: "No se pudo verificar el estado de la carpeta privada.", variant: "destructive" });
        } finally {
          setIsCheckingPassword(false);
        }
      };
      checkStatus();
    }
  }, [user, isAuthLoading, toast]);

  useEffect(() => {
    if (isAuthenticatedToView) {
      fetchPrivateContentAndFavorites();
    }
  }, [isAuthenticatedToView, fetchPrivateContentAndFavorites]);

  const handlePasswordSet = () => {
    setIsPasswordSet(true);
    setShowSetupModal(false);
    setIsAuthenticatedToView(true); 
  };

  const handleUnlockSuccess = () => {
    setShowEnterModal(false);
    setIsAuthenticatedToView(true);
  };

  const handleFavoriteToggledInPrivate = (itemId: string, isNowFavorite: boolean) => {
    setFavoriteItemIds(prevIds => {
      const newIds = new Set(prevIds);
      if (isNowFavorite) newIds.add(itemId);
      else newIds.delete(itemId);
      return newIds;
    });
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
    setCurrentViewItemIndex(index); // index relative to current `privateItems`
    setIsViewerOpen(true);
  };

  const handleOpenViewer = (item: MediaItem) => {
    const itemIndex = privateItems.findIndex(i => i.id === item.id);
    if (itemIndex === -1) return;
    if (item.adultContent && !isViewerOpen) {
      setItemPendingConfirmation(item);
      setPendingNavigationArgs({ item, index: itemIndex });
      setShowAdultConfirmation(true);
    } else openViewerWithItem(item, itemIndex);
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

    if (targetIndex >= 0 && targetIndex < privateItems.length) {
      const newItem = privateItems[targetIndex];
      if (newItem.adultContent && !isViewerOpen) {
        setItemPendingConfirmation(newItem);
        setPendingNavigationArgs({ item: newItem, index: targetIndex });
        setShowAdultConfirmation(true);
      } else openViewerWithItem(newItem, targetIndex);
    }
  };
  
  const handleConfirmAdultContent = () => {
    if (pendingNavigationArgs) openViewerWithItem(pendingNavigationArgs.item, pendingNavigationArgs.index);
    setShowAdultConfirmation(false);
    setItemPendingConfirmation(null);
    setPendingNavigationArgs(null);
  };

  const handleCancelAdultContent = () => {
    setShowAdultConfirmation(false);
    setItemPendingConfirmation(null);
    setPendingNavigationArgs(null);
  };

  const handleMoveToGallery = async () => {
    if (selectedItems.size === 0 || !user) return;
    setIsProcessingAction(true);
    try {
      const result = await moveItemsFromPrivateToGallery(Array.from(selectedItems), user.id);
      if (result.success) {
        toast({ title: "Elementos Movidos", description: `${result.movedCount} elemento(s) movido(s) a la galería.` });
        fetchPrivateContentAndFavorites();
        setIsSelectMode(false); setSelectedItems(new Set());
      } else toast({ title: "Error al Mover Elementos", description: result.error || "No se pudieron mover los elementos a la galería.", variant: "destructive" });
    } catch (error) {
      toast({ title: "Error Inesperado", description: "Ocurrió un error inesperado.", variant: "destructive" });
    } finally {
      setIsProcessingAction(false);
    }
  };

  const requestMoveToTrash = () => {
    if(selectedItems.size === 0) return;
    setShowMoveToTrashConfirm(true);
  }

  const handleMoveToTrash = async () => {
    if (selectedItems.size === 0 || !user) return;
    setShowMoveToTrashConfirm(false);
    setIsProcessingAction(true);
    try {
      const result = await moveItemsFromPrivateToTrash(Array.from(selectedItems), user.id);
      if (result.success) {
        toast({ title: "Elementos Movidos a la Papelera", description: `${result.movedCount} elemento(s) movido(s) a la papelera.` });
        fetchPrivateContentAndFavorites();
        setIsSelectMode(false); setSelectedItems(new Set());
      } else toast({ title: "Error al Mover a la Papelera", description: result.error || "No se pudieron mover los elementos a la papelera.", variant: "destructive" });
    } catch (error) {
      toast({ title: "Error Inesperado", description: "Ocurrió un error inesperado.", variant: "destructive" });
    } finally {
      setIsProcessingAction(false);
    }
  };

  if (isAuthLoading || (user && isCheckingPassword)) {
    return <div className="flex h-full w-full items-center justify-center"><Loader2 className="h-12 w-12 animate-spin text-primary" /><p className="ml-2 text-muted-foreground">Cargando carpeta privada...</p></div>;
  }
  if (!user) return <p>Debes iniciar sesión para acceder a la carpeta privada.</p>;
  
  if (isAuthenticatedToView) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2"><Lock className="h-8 w-8 text-primary" /><CardTitle className="text-3xl font-bold">Carpeta Privada</CardTitle></div>
              {privateItems.length > 0 && (<Button variant="outline" onClick={toggleSelectMode} size="sm"><CheckSquare className="mr-2 h-4 w-4" /> {isSelectMode ? "Cancelar Selección" : "Seleccionar"}</Button>)}
            </div>
            <CardDescription>El contenido en esta carpeta está protegido por contraseña.</CardDescription>
          </CardHeader>
          <CardContent>
            {isSelectMode && selectedItems.size > 0 && (
              <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm p-4 mb-4 border rounded-lg shadow flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium">{selectedItems.size} elemento(s) seleccionado(s)</p>
                <div className="flex gap-2 flex-wrap">
                  <Button onClick={handleMoveToGallery} variant="outline" size="sm" disabled={isProcessingAction}>{isProcessingAction ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowLeftRight className="mr-2 h-4 w-4" />} Mover a Galería ({selectedItems.size})</Button>
                  <Button onClick={requestMoveToTrash} variant="destructive" size="sm" disabled={isProcessingAction}>{isProcessingAction ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <TrashIcon className="mr-2 h-4 w-4" />} Eliminar ({selectedItems.size})</Button>
                  <Button variant="ghost" onClick={toggleSelectMode} size="sm" disabled={isProcessingAction}><XCircle className="mr-2 h-4 w-4" /> Cancelar</Button>
                </div>
              </div>
            )}
            {isLoadingItems ? <div className="flex justify-center items-center h-64"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>
            : <MediaGrid 
                items={privateItems} 
                isSelectMode={isSelectMode} 
                selectedItems={selectedItems} 
                onItemSelect={handleItemSelect} 
                onOpenViewer={handleOpenViewer} 
                passPropsToCards={{ getInitialIsFavorite: (itemId: string) => favoriteItemIds.has(itemId), onFavoriteToggle: handleFavoriteToggledInPrivate }}
                gallerySortOrder={'chronological_desc'} // Private items are typically sorted by upload date
              />}
            {privateItems.length === 0 && !isLoadingItems && (<p className="text-center text-muted-foreground py-10">Esta carpeta está vacía. Añade elementos de tu galería para mantenerlos privados.</p>)}
          </CardContent>
        </Card>
        <MediaViewerModal 
            isOpen={isViewerOpen} 
            item={currentViewItem} 
            onClose={handleCloseViewer} 
            onNavigate={handleNavigateViewer} 
            canNavigatePrev={currentViewItemIndex > 0} 
            canNavigateNext={currentViewItemIndex < privateItems.length - 1} 
            onFavoriteToggledInModal={handleFavoriteToggledInPrivate}
            userPreferences={userPreferences} 
        />
        <AlertDialog open={showAdultConfirmation} onOpenChange={(open) => { if (!open) handleCancelAdultContent(); setShowAdultConfirmation(open);}}>
          <AlertDialogContent><AlertDialogHeaderComponent><AlertDialogTitleComponent>Confirmación de Contenido</AlertDialogTitleComponent><AlertDialogDescription>Este contenido está marcado como +18. ¿Deseas continuar y ver el contenido?</AlertDialogDescription></AlertDialogHeaderComponent><AlertDialogFooter><AlertDialogCancel asChild><Button variant="outline" onClick={handleCancelAdultContent}>Cancelar</Button></AlertDialogCancel><AlertDialogAction asChild><Button onClick={handleConfirmAdultContent}>Ver Contenido</Button></AlertDialogAction></AlertDialogFooter></AlertDialogContent>
        </AlertDialog>
        <AlertDialog open={showMoveToTrashConfirm} onOpenChange={setShowMoveToTrashConfirm}>
          <AlertDialogContent>
            <AlertDialogHeaderComponent>
                <AlertDialogTitleComponent>Confirmar Eliminación</AlertDialogTitleComponent>
                <AlertDialogDescription>¿Estás seguro de que quieres mover {selectedItems.size} elemento(s) a la papelera? Serán recuperables desde la Papelera durante 30 días.</AlertDialogDescription>
            </AlertDialogHeaderComponent>
            <AlertDialogFooter>
                <AlertDialogCancel asChild><Button variant="outline" onClick={() => setShowMoveToTrashConfirm(false)} disabled={isProcessingAction}>Cancelar</Button></AlertDialogCancel>
                <AlertDialogAction asChild><Button onClick={handleMoveToTrash} disabled={isProcessingAction} className="bg-destructive hover:bg-destructive/90">{isProcessingAction ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Mover a Papelera"}</Button></AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  return (
    <>
      {showSetupModal && user && (<SetupPrivatePasswordModal user={user} isOpen={showSetupModal} onClose={() => setShowSetupModal(false)} onPasswordSet={handlePasswordSet} />)}
      {showEnterModal && user && (<EnterPrivatePasswordModal user={user} isOpen={showEnterModal} onClose={() => setShowEnterModal(false)} onUnlockSuccess={handleUnlockSuccess} />)}
      {!isAuthenticatedToView && !isCheckingPassword && !showSetupModal && !showEnterModal && (
         <div className="flex h-full w-full flex-col items-center justify-center space-y-4"><Lock className="h-16 w-16 text-primary" /><p className="text-xl text-muted-foreground">Acceso Restringido</p><p className="text-sm text-center max-w-md text-muted-foreground">Por favor, configura o ingresa la contraseña de tu carpeta privada para ver su contenido.</p></div>
      )}
    </>
  );
}
