
"use client";

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Loader2, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getOfflineItemIds, toggleOfflineItem, removeAllOfflineForUser } from '@/app/actions/offlineActions';
import { getGalleryItems } from '@/app/actions/galleryActions'; // To get item details
import type { MediaItem } from '@/types';
import Image from 'next/image';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader as AlertDialogHeaderComponent,
  AlertDialogTitle as AlertDialogTitleComponent,
} from "@/components/ui/alert-dialog";


interface OfflineItemWithDetails extends MediaItem {
  isCurrentlyOffline: boolean;
}

interface ManageOfflineContentModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  onOfflineContentChanged?: () => void; // Callback after clearing all or changing an item
}

export default function ManageOfflineContentModal({ isOpen, onClose, userId, onOfflineContentChanged }: ManageOfflineContentModalProps) {
  const { toast } = useToast();
  const [offlineItemsDetails, setOfflineItemsDetails] = useState<OfflineItemWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showClearAllConfirm, setShowClearAllConfirm] = useState(false);


  const fetchOfflineDetails = useCallback(async () => {
    if (!userId) return;
    setIsLoading(true);
    try {
      const [offlineIds, allGalleryItems] = await Promise.all([
        getOfflineItemIds(userId),
        getGalleryItems(userId) // Fetch only user's gallery items
      ]);

      const details = offlineIds.map(id => {
        const item = allGalleryItems.find(galleryItem => galleryItem.id === id);
        return item ? { ...item, isCurrentlyOffline: true } : null;
      }).filter((item): item is OfflineItemWithDetails => item !== null)
        .sort((a,b) => new Date(b.uploadTimestamp).getTime() - new Date(a.uploadTimestamp).getTime());
      
      setOfflineItemsDetails(details);
    } catch (error) {
      toast({ title: "Error", description: "No se pudieron cargar los detalles del contenido sin conexión.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [userId, toast]);

  useEffect(() => {
    if (isOpen) {
      fetchOfflineDetails();
    }
  }, [isOpen, fetchOfflineDetails]);

  const handleToggleOffline = async (itemId: string) => {
    setIsProcessing(true);
    try {
      const result = await toggleOfflineItem(userId, itemId);
      if (result.success) {
        toast({ title: result.isOffline ? "Marcado para Sin Conexión" : "Quitado de Sin Conexión" });
        // Re-fetch or update local state
        setOfflineItemsDetails(prev => 
            prev.map(item => item.id === itemId ? {...item, isCurrentlyOffline: result.isOffline} : item)
                .filter(item => item.isCurrentlyOffline) // Keep only items that are still offline
        );
        if (onOfflineContentChanged) onOfflineContentChanged(); 
      } else {
        toast({ title: "Error", description: result.error, variant: "destructive" });
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClearAllOffline = async () => {
    setShowClearAllConfirm(false);
    setIsProcessing(true);
    const result = await removeAllOfflineForUser(userId);
    if (result.success) {
        toast({ title: "Contenido Sin Conexión Eliminado", description: "Todos los ítems marcados para uso sin conexión han sido quitados." });
        setOfflineItemsDetails([]); // Clear the list
        if (onOfflineContentChanged) onOfflineContentChanged();
    } else {
        toast({ title: "Error", description: result.error || "No se pudo eliminar el contenido sin conexión.", variant: "destructive" });
    }
    setIsProcessing(false);
  };


  if (!isOpen) return null;

  return (
    <>
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Administrar Contenido Sin Conexión</DialogTitle>
          <DialogDescription>
            Aquí puedes ver y quitar ítems que has marcado para acceso sin conexión.
          </DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <div className="flex justify-center items-center h-40">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : offlineItemsDetails.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-10">
            No tienes ítems marcados para acceso sin conexión.
          </p>
        ) : (
          <ScrollArea className="h-72 my-4">
            <div className="space-y-3 pr-3">
              {offlineItemsDetails.map(item => (
                <div key={item.id} className="flex items-center justify-between p-2 border rounded-md">
                  <div className="flex items-center gap-2 overflow-hidden">
                    <Image 
                        src={item.filePath || `https://placehold.co/40x40.png?text=${item.type.charAt(0).toUpperCase()}`} 
                        alt={item.originalFilename} 
                        width={40} height={40} 
                        className="rounded object-cover aspect-square bg-muted"
                        data-ai-hint="offline media thumbnail"
                    />
                    <span className="text-sm truncate" title={item.originalFilename}>{item.originalFilename}</span>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => handleToggleOffline(item.id)}
                    disabled={isProcessing}
                  >
                    {isProcessing ? <Loader2 className="h-4 w-4 animate-spin"/> : "Quitar"}
                  </Button>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
        <DialogFooter className="sm:justify-between mt-2">
          <Button 
            variant="destructive" 
            onClick={() => setShowClearAllConfirm(true)}
            disabled={isLoading || isProcessing || offlineItemsDetails.length === 0}
          >
             {isProcessing && !showClearAllConfirm ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Trash2 className="mr-2 h-4 w-4" />}
            Borrar Todo
          </Button>
          <DialogClose asChild>
            <Button type="button" variant="outline" onClick={onClose}>
              Cerrar
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <AlertDialog open={showClearAllConfirm} onOpenChange={setShowClearAllConfirm}>
        <AlertDialogContent>
        <AlertDialogHeaderComponent>
            <AlertDialogTitleComponent>Confirmar Acción</AlertDialogTitleComponent>
            <AlertDialogDescription>
            ¿Estás seguro de que quieres borrar todo el contenido sin conexión? Los archivos no se eliminarán de tu galería, solo se quitará su disponibilidad sin conexión.
            </AlertDialogDescription>
        </AlertDialogHeaderComponent>
        <AlertDialogFooter>
            <AlertDialogCancel asChild>
              <Button variant="outline" onClick={() => setShowClearAllConfirm(false)} disabled={isProcessing}>
                Cancelar
              </Button>
            </AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button onClick={handleClearAllOffline} disabled={isProcessing} className="bg-destructive hover:bg-destructive/90">
                {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Borrar Todo Sin Conexión"}
              </Button>
            </AlertDialogAction>
        </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
