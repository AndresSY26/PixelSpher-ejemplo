
"use client";

import { useState, useEffect, useMemo, useCallback } from 'react'; // Added useCallback
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
import type { TrashItem, GroupedTrash } from '@/types';
import { getTrashItems, restoreTrashItem, permanentlyDeleteMultipleTrashItems, autoDeleteOldTrashItems } from '@/app/actions/trashActions';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Trash2, Undo, XCircle, Film, Image as LucideImageIcon } from 'lucide-react';
import Image from 'next/image';
import { format, parseISO, isValid } from 'date-fns'; // Added isValid
import { es } from 'date-fns/locale';
import { Checkbox } from '@/components/ui/checkbox';
import { useAuth } from '@/context/AuthContext'; // Added useAuth

function TrashMediaItemDisplay({ item }: { item: TrashItem }) {
  const [videoError, setVideoError] = useState(false);

  useEffect(() => {
    setVideoError(false);
  }, [item.filePath, item.id]);

  return (
    <div className="aspect-square w-full relative bg-muted">
      {item.type === 'image' && item.filePath ? (
        <Image
          src={item.filePath}
          alt={item.originalFilename}
          fill
          sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 20vw"
          className="object-cover"
          data-ai-hint="trashed image"
          onError={(e) => {
            // Fallback for broken image links, ensures component doesn't break
            e.currentTarget.src = `https://placehold.co/200x200.png?text=Error`;
            e.currentTarget.alt = `Error loading ${item.originalFilename}`;
          }}
        />
      ) : item.type === 'video' && item.filePath ? (
        videoError ? (
          <div className="w-full h-full flex items-center justify-center bg-muted">
            <Film className="w-12 h-12 text-muted-foreground" />
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
              console.warn(`Failed to load video preview in trash: ${item.filePath}`);
              setVideoError(true);
            }}
            controls={false}
            playsInline
          >
            Tu navegador no soporta la etiqueta de video.
          </video>
        )
      ) : ( // Fallback for missing path or unknown type
        <div className="w-full h-full flex items-center justify-center bg-muted">
          {item.type === 'video' ? (
            <Film className="w-12 h-12 text-muted-foreground" />
          ) : (
            <LucideImageIcon className="w-12 h-12 text-muted-foreground" />
          )}
        </div>
      )}
       {item.adultContent && (
          <div className="absolute inset-0 z-5 flex items-center justify-center bg-black/30 filter blur-sm">
          </div>
        )}
    </div>
  );
}


export default function TrashPage() {
  const [trashItems, setTrashItems] = useState<TrashItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [showPermanentDeleteConfirm, setShowPermanentDeleteConfirm] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth(); // Get current user

  const fetchTrashAndRunCleanup = useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      setTrashItems([]);
      return;
    }
    setIsLoading(true);
    try {
      await autoDeleteOldTrashItems(user.id); // Run cleanup for the current user
      const items = await getTrashItems(user.id); // Fetch trash items for the current user
      setTrashItems(items);
    } catch (error) {
      toast({ title: "Error", description: "No se pudieron cargar los ítems de la papelera o ejecutar la limpieza.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [user, toast]); // Add user and toast to dependencies

  useEffect(() => {
    fetchTrashAndRunCleanup();
  }, [fetchTrashAndRunCleanup]); // fetchTrashAndRunCleanup is now memoized

  const handleItemSelect = (itemId: string) => {
    setSelectedItems(prevSelected => {
      const newSelected = new Set(prevSelected);
      if (newSelected.has(itemId)) {
        newSelected.delete(itemId);
      } else {
        newSelected.add(itemId);
      }
      return newSelected;
    });
  };

  const handleRestoreSelected = async () => {
    if (selectedItems.size === 0 || !user) return;
    setIsProcessing(true);
    try {
      const results = await Promise.allSettled(Array.from(selectedItems).map(id => restoreTrashItem(id, user.id))); // Pass userId
      
      const restoredCount = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
      const failedCount = selectedItems.size - restoredCount;

      if (restoredCount > 0) {
        toast({ title: "Ítems Restaurados", description: `${restoredCount} ítem(s) restaurado(s) a la galería.` });
      }
      if (failedCount > 0) {
         toast({ title: "Error Parcial", description: `${failedCount} ítem(s) no pudieron ser restaurados.`, variant: "destructive" });
      }
      
      setSelectedItems(new Set());
      fetchTrashAndRunCleanup();
    } catch (error) {
      toast({ title: "Error", description: "Ocurrió un error general al restaurar los ítems.", variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  const requestPermanentDelete = () => {
    if (selectedItems.size === 0) return;
    setShowPermanentDeleteConfirm(true);
  };

  const confirmPermanentDeleteSelected = async () => {
    if (selectedItems.size === 0 || !user) return;
    setShowPermanentDeleteConfirm(false);
    setIsProcessing(true);
    try {
      const result = await permanentlyDeleteMultipleTrashItems(Array.from(selectedItems), user.id); // Pass userId
      if (result.success) {
        toast({ title: "Ítems Eliminados Permanentemente", description: `${result.deletedCount} ítem(s) eliminado(s) permanentemente.` });
      } else {
        toast({ title: "Error al Eliminar", description: result.error || "No se pudieron eliminar algunos ítems.", variant: "destructive" });
      }
      setSelectedItems(new Set());
      fetchTrashAndRunCleanup();
    } catch (error) {
      toast({ title: "Error Inesperado", description: "No se pudieron eliminar los ítems permanentemente.", variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  const groupedTrashItems: GroupedTrash[] = useMemo(() => {
    const groups: { [key: string]: TrashItem[] } = {};
    
    // Filter items to ensure they are valid and have a deletionTimestamp
    const validTrashItems = trashItems.filter(
      item => item && typeof item.deletionTimestamp === 'string' && item.deletionTimestamp.trim() !== '' && isValid(parseISO(item.deletionTimestamp))
    );

    validTrashItems.forEach(item => {
      try {
        const dateStr = format(parseISO(item.deletionTimestamp), "EEEE, d 'de' MMMM 'de' yyyy", { locale: es });
        if (!groups[dateStr]) {
          groups[dateStr] = [];
        }
        groups[dateStr].push(item);
      } catch (e) {
        console.error("Error formatting date for trash item:", item, e);
        // Optionally, group problematic items under a special key or skip them
        // For now, skipping to prevent crashes.
      }
    });

    return Object.entries(groups)
      .map(([date, items]) => ({ date, items }))
      .sort((a, b) => {
        // Ensure items[0] and deletionTimestamp exist before trying to parse for robust sorting
        const dateA = a.items.length > 0 && a.items[0].deletionTimestamp && isValid(parseISO(a.items[0].deletionTimestamp)) 
                      ? parseISO(a.items[0].deletionTimestamp).getTime() 
                      : 0;
        const dateB = b.items.length > 0 && b.items[0].deletionTimestamp && isValid(parseISO(b.items[0].deletionTimestamp))
                      ? parseISO(b.items[0].deletionTimestamp).getTime()
                      : 0;
        return dateB - dateA;
      });
  }, [trashItems]);


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
        <p>Por favor, inicia sesión para ver la papelera.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-3xl font-bold">Papelera</CardTitle>
          <CardDescription>
            Los ítems aquí se eliminarán permanentemente después de 30 días (o manualmente). <br/>
            Haz clic en los ítems para seleccionarlos y realizar acciones.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {selectedItems.size > 0 && (
            <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm p-4 mb-4 border rounded-lg shadow flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium">{selectedItems.size} ítem(s) seleccionados</p>
              <div className="flex gap-2">
                <Button onClick={handleRestoreSelected} variant="outline" size="sm" disabled={isProcessing}>
                  {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Undo className="mr-2 h-4 w-4" />} 
                  Restaurar ({selectedItems.size})
                </Button>
                <Button onClick={requestPermanentDelete} variant="destructive" size="sm" disabled={isProcessing}>
                  {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />} 
                  Eliminar Permanentemente ({selectedItems.size})
                </Button>
                <Button onClick={() => setSelectedItems(new Set())} variant="ghost" size="sm" disabled={isProcessing}>
                  <XCircle className="mr-2 h-4 w-4" /> Cancelar
                </Button>
              </div>
            </div>
          )}

          {trashItems.length === 0 ? (
            <p className="text-muted-foreground text-center py-10">La papelera está vacía.</p>
          ) : (
            groupedTrashItems.length === 0 && trashItems.length > 0 ? (
                 <p className="text-muted-foreground text-center py-10">No hay ítems válidos para mostrar en la papelera. Algunos datos podrían estar corruptos.</p>
            ) : (
              <div className="space-y-8">
                {groupedTrashItems.map(group => (
                  <div key={group.date}>
                    <h2 className="text-xl font-semibold mb-4 capitalize">Eliminado: {group.date}</h2>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                      {group.items.map(item => (
                        <div key={item.id} className="relative group">
                          <div 
                            className="absolute top-2 right-2 z-10"
                            onClick={(e) => { e.stopPropagation(); handleItemSelect(item.id); }}
                          >
                             <Checkbox
                              checked={selectedItems.has(item.id)}
                              onCheckedChange={() => handleItemSelect(item.id)}
                              aria-label={`Select ${item.originalFilename}`}
                              className="bg-background border-foreground data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground shadow-md"
                            />
                          </div>
                          <Card 
                            className={`overflow-hidden cursor-pointer transition-all ${selectedItems.has(item.id) ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : 'hover:shadow-md'}`}
                            onClick={() => handleItemSelect(item.id)}
                          >
                            <TrashMediaItemDisplay item={item} />
                            <CardContent className="p-2 text-xs truncate">
                              <p className="font-medium truncate" title={item.originalFilename}>{item.originalFilename}</p>
                              <p className="text-muted-foreground">{item.type}</p>
                            </CardContent>
                          </Card>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </CardContent>
      </Card>

      <AlertDialog open={showPermanentDeleteConfirm} onOpenChange={setShowPermanentDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeaderComponent>
            <AlertDialogTitleComponent>Confirmar Eliminación Permanente</AlertDialogTitleComponent>
            <AlertDialogDescription>
              Estás a punto de eliminar {selectedItems.size} ítem(s) permanentemente. 
              Esta acción no se puede deshacer y los archivos serán borrados del servidor.
              ¿Deseas continuar?
            </AlertDialogDescription>
          </AlertDialogHeaderComponent>
          <AlertDialogFooter>
            <AlertDialogCancel asChild>
              <Button variant="outline" onClick={() => setShowPermanentDeleteConfirm(false)} disabled={isProcessing}>
                Cancelar
              </Button>
            </AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button onClick={confirmPermanentDeleteSelected} disabled={isProcessing} className="bg-destructive hover:bg-destructive/90">
                {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4"/>} 
                Eliminar Permanentemente
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}

