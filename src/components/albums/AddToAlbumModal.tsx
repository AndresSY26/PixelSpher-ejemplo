
"use client";

import { useState, useEffect } from 'react';
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useToast } from '@/hooks/use-toast';
import { Loader2, PlusCircle } from 'lucide-react';
import { getAlbums, addItemsToAlbum } from '@/app/actions/albumActions'; 
import type { Album } from '@/types';
import CreateAlbumModal from './CreateAlbumModal'; 
import { useAuth } from '@/context/AuthContext';


interface AddToAlbumModalProps {
  isOpen: boolean;
  onClose: () => void;
  itemIdsToAdd: string[];
  onItemsAdded: () => void; 
  userId: string; // Added userId to ensure correct album context
}

export default function AddToAlbumModal({ isOpen, onClose, itemIdsToAdd, onItemsAdded, userId }: AddToAlbumModalProps) {
  const { toast } = useToast();
  // const { user } = useAuth(); // userId is now passed as a prop
  const [albums, setAlbums] = useState<Album[]>([]);
  const [selectedAlbumId, setSelectedAlbumId] = useState<string | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showCreateAlbumModal, setShowCreateAlbumModal] = useState(false);

  const fetchAlbumsList = async () => {
    if (!userId) { // Use passed userId
      setIsLoading(false);
      setAlbums([]);
      return;
    }
    setIsLoading(true);
    try {
      const fetchedAlbums = await getAlbums(userId); // Pass userId
      setAlbums(fetchedAlbums);
    } catch (error) {
      toast({ title: "Error", description: "No se pudieron cargar los álbumes.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchAlbumsList();
      setSelectedAlbumId(undefined); 
    }
  }, [isOpen, userId]); // Use passed userId in dependency array

  const handleAddToAlbum = async () => {
    if (!userId) {
        toast({ title: "Error de Autenticación", description: "Debes iniciar sesión.", variant: "destructive"});
        return;
    }
    if (!selectedAlbumId) {
      toast({ title: "Selección Requerida", description: "Por favor, selecciona un álbum.", variant: "destructive" });
      return;
    }
    if (itemIdsToAdd.length === 0) {
      toast({ title: "Sin Ítems", description: "No hay ítems seleccionados para añadir.", variant: "destructive" });
      return;
    }

    setIsSaving(true);
    try {
      const result = await addItemsToAlbum(selectedAlbumId, itemIdsToAdd, userId); // Pass userId
      if (result.success) {
        toast({ title: "Ítems Añadidos", description: `${result.addedCount} ítem(s) añadido(s) al álbum.` });
        onItemsAdded();
        onClose();
      } else {
        toast({ title: "Error al Añadir", description: result.error || "No se pudieron añadir los ítems.", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error Inesperado", description: "Ocurrió un error al añadir ítems al álbum.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };
  
  const handleAlbumCreatedInModal = (newAlbum: Album) => {
    setAlbums(prev => [...prev, newAlbum].sort((a, b) => a.name.localeCompare(b.name)));
    setSelectedAlbumId(newAlbum.id); 
    setShowCreateAlbumModal(false);
  };


  if (!isOpen) return null;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Añadir a Álbum</DialogTitle>
            <DialogDescription>
              Selecciona un álbum para añadir {itemIdsToAdd.length} ítem(s) o crea uno nuevo.
            </DialogDescription>
          </DialogHeader>
          
          {isLoading ? (
            <div className="flex justify-center items-center h-40">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : !userId ? ( // Check passed userId
             <p className="text-sm text-muted-foreground text-center py-4">Debes iniciar sesión para gestionar álbumes.</p>
          ) : (
            <div className="py-4 space-y-4">
              <Button 
                variant="outline" 
                className="w-full" 
                onClick={() => setShowCreateAlbumModal(true)}
                disabled={isSaving}
              >
                <PlusCircle className="mr-2 h-4 w-4" /> Crear Nuevo Álbum
              </Button>
              
              {albums.length > 0 ? (
                <ScrollArea className="h-48 border rounded-md p-2">
                  <RadioGroup value={selectedAlbumId} onValueChange={setSelectedAlbumId} className="space-y-1">
                    {albums.map(album => (
                      <Label
                        key={album.id}
                        htmlFor={album.id}
                        className={`flex items-center space-x-2 p-2 rounded-md cursor-pointer hover:bg-muted/50 transition-colors ${selectedAlbumId === album.id ? 'bg-muted font-medium' : ''}`}
                      >
                        <RadioGroupItem value={album.id} id={album.id} />
                        <span>{album.name}</span>
                        <span className="text-xs text-muted-foreground ml-auto">({album.itemIds.length} ítems)</span>
                      </Label>
                    ))}
                  </RadioGroup>
                </ScrollArea>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">No has creado ningún álbum todavía.</p>
              )}
            </div>
          )}

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
                Cancelar
              </Button>
            </DialogClose>
            <Button type="button" onClick={handleAddToAlbum} disabled={isLoading || isSaving || !selectedAlbumId || albums.length === 0 || !userId}>
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Añadir a Álbum
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {showCreateAlbumModal && userId && ( // Check passed userId
        <CreateAlbumModal
          isOpen={showCreateAlbumModal}
          onClose={() => setShowCreateAlbumModal(false)}
          onAlbumCreated={handleAlbumCreatedInModal}
          userId={userId} // Pass userId
        />
      )}
    </>
  );
}

