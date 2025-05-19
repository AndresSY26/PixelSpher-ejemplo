
"use client";

import { useState, useEffect, useCallback } from 'react'; 
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Loader2, PlusCircle, Album as AlbumIcon, Image as ImageIcon, MoreHorizontal, Trash2, Edit3, EyeOff } from 'lucide-react';
import CreateAlbumModal from '@/components/albums/CreateAlbumModal';
import type { Album, MediaItem } from '@/types';
import { getAlbums, getMediaItemsForAlbum, removeAlbum, renameAlbum } from '@/app/actions/albumActions';
import { useToast } from '@/hooks/use-toast';
import Image from 'next/image';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';


interface AlbumCardProps {
  album: Album;
  onAlbumDeleted: (albumId: string) => void;
  onAlbumRenamed: (album: Album) => void;
}

function AlbumCard({ album, onAlbumDeleted, onAlbumRenamed }: AlbumCardProps) {
  const [firstItem, setFirstItem] = useState<MediaItem | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(true);
  const { toast } = useToast();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [newAlbumName, setNewAlbumName] = useState(album.name);
  const [isProcessing, setIsProcessing] = useState(false);
  const { user } = useAuth();

  const [isCoverRevealed, setIsCoverRevealed] = useState(false);
  const [showCoverAdultConfirmation, setShowCoverAdultConfirmation] = useState(false);


  useEffect(() => {
    async function fetchPreview() {
      if (album.itemIds.length > 0 && user) { // Check for user
        setIsLoadingPreview(true);
        try {
          // Pass userId to getMediaItemsForAlbum
          const { items } = await getMediaItemsForAlbum(album.id, user.id); 
          if (items.length > 0) {
            setFirstItem(items[0]);
          } else {
            setFirstItem(null); 
          }
        } catch (error) {
          console.error("Error fetching album preview:", error);
          setFirstItem(null);
        } finally {
          setIsLoadingPreview(false);
        }
      } else {
        setIsLoadingPreview(false);
        setFirstItem(null);
      }
    }
    fetchPreview();
  }, [album.id, album.itemIds, user]); // Added user dependency

  const handleDeleteAlbum = async () => {
    if (!user) return;
    setIsProcessing(true);
    const result = await removeAlbum(album.id, user.id); // Pass userId
    if (result.success) {
      toast({ title: "Álbum Eliminado", description: `El álbum "${album.name}" ha sido eliminado.` });
      onAlbumDeleted(album.id);
    } else {
      toast({ title: "Error", description: result.error || "No se pudo eliminar el álbum.", variant: "destructive" });
    }
    setShowDeleteConfirm(false);
    setIsProcessing(false);
  };

  const handleRenameAlbum = async (e?: React.FormEvent<HTMLFormElement>) => {
    e?.preventDefault();
    if (!user) return;
    if (!newAlbumName.trim() || newAlbumName.trim() === album.name) {
      setShowRenameModal(false);
      return;
    }
    setIsProcessing(true);
    const result = await renameAlbum(album.id, newAlbumName.trim(), user.id); // Pass userId
    if (result.success && result.album) {
      toast({ title: "Álbum Renombrado", description: `El álbum ha sido renombrado a "${result.album.name}".` });
      onAlbumRenamed(result.album);
    } else {
      toast({ title: "Error", description: result.error || "No se pudo renombrar el álbum.", variant: "destructive" });
    }
    setShowRenameModal(false);
    setIsProcessing(false);
  };

  const handleAlbumCardClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (firstItem?.adultContent && !isCoverRevealed) {
      e.preventDefault(); 
      setShowCoverAdultConfirmation(true);
    }
  };

  const handleConfirmCoverAdultContent = () => {
    setIsCoverRevealed(true); 
    setShowCoverAdultConfirmation(false);
  };

  const handleCancelCoverAdultContent = () => {
    setShowCoverAdultConfirmation(false);
  };


  return (
    <>
      <Card className="overflow-hidden transition-all hover:shadow-lg group">
        <div onClick={handleAlbumCardClick} className="cursor-pointer"> 
          <Link href={firstItem?.adultContent && !isCoverRevealed ? "#" : `/albums/${album.id}`} className="block">
            <div className="aspect-video bg-muted flex items-center justify-center relative">
              {isLoadingPreview ? (
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              ) : firstItem && firstItem.filePath && firstItem.type === 'image' ? (
                <Image
                  src={firstItem.filePath}
                  alt={`Preview de ${album.name}`}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
                  className={cn("object-cover", firstItem.adultContent && !isCoverRevealed && "filter blur-md")}
                  data-ai-hint="album cover"
                />
              ) : firstItem && firstItem.filePath && firstItem.type === 'video' ? (
                <video 
                  src={firstItem.filePath} 
                  muted 
                  className={cn("object-cover w-full h-full", firstItem.adultContent && !isCoverRevealed && "filter blur-md")}
                  preload="metadata" 
                  onLoadedData={(e)=> e.currentTarget.currentTime = 0.1} 
                />
              ) : (
                <AlbumIcon className="h-16 w-16 text-muted-foreground" />
              )}
              {firstItem?.adultContent && !isCoverRevealed && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/50 text-white p-2 select-none">
                  <EyeOff className="h-8 w-8 mb-1" />
                  <p className="text-center text-xs font-semibold">Contenido Adulto</p>
                   <p className="text-center text-xs opacity-80">(Clic para ver)</p>
                </div>
              )}
            </div>
          </Link>
        </div>
        <CardContent className="p-4">
          <div className="flex justify-between items-start">
            <div>
              <Link href={`/albums/${album.id}`} className="block cursor-pointer">
                <CardTitle className="text-lg hover:text-primary transition-colors">{album.name}</CardTitle>
              </Link>
              <CardDescription>{album.itemIds.length} ítem(s)</CardDescription>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => { setNewAlbumName(album.name); setShowRenameModal(true); }}>
                  <Edit3 className="mr-2 h-4 w-4" />
                  Renombrar
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShowDeleteConfirm(true)} className="text-destructive focus:text-destructive focus:bg-destructive/10">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Eliminar Álbum
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={showCoverAdultConfirmation} onOpenChange={setShowCoverAdultConfirmation}>
        <AlertDialogContent>
          <AlertDialogHeaderComponent>
            <AlertDialogTitleComponent>Confirmación de Contenido</AlertDialogTitleComponent>
            <AlertDialogDescription>
              La portada de este álbum es contenido marcado como +18. ¿Deseas continuar y ver la portada?
            </AlertDialogDescription>
          </AlertDialogHeaderComponent>
          <AlertDialogFooter>
            <AlertDialogCancel asChild><Button variant="outline" onClick={handleCancelCoverAdultContent}>Cancelar</Button></AlertDialogCancel>
            <AlertDialogAction asChild><Button onClick={handleConfirmCoverAdultContent}>Ver Portada</Button></AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeaderComponent>
            <AlertDialogTitleComponent>Confirmar Eliminación</AlertDialogTitleComponent>
            <AlertDialogDescription>
              ¿Estás seguro de que quieres eliminar el álbum "{album.name}"? Los ítems dentro del álbum no serán eliminados de tu galería.
            </AlertDialogDescription>
          </AlertDialogHeaderComponent>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowDeleteConfirm(false)} disabled={isProcessing}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteAlbum} className="bg-destructive hover:bg-destructive/90" disabled={isProcessing}>
              {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      <Dialog open={showRenameModal} onOpenChange={(open) => {if(!open) setNewAlbumName(album.name); setShowRenameModal(open);}}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Renombrar Álbum</DialogTitle>
            <DialogDescription>Ingresa el nuevo nombre para el álbum "{album.name}".</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleRenameAlbum} className="space-y-4 py-2">
            <Input 
              value={newAlbumName} 
              onChange={(e) => setNewAlbumName(e.target.value)} 
              placeholder="Nuevo nombre del álbum"
              autoFocus
              maxLength={50}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => {setNewAlbumName(album.name); setShowRenameModal(false);}} disabled={isProcessing}>Cancelar</Button>
              <Button type="submit" disabled={isProcessing || !newAlbumName.trim() || newAlbumName.trim() === album.name}>
                {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : "Guardar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}


export default function AlbumsPage() {
  const [albums, setAlbums] = useState<Album[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const fetchAlbumsList = useCallback(async () => { 
    if (!user) {
      setIsLoading(false);
      setAlbums([]);
      return;
    }
    setIsLoading(true);
    try {
      const fetchedAlbums = await getAlbums(user.id); // Pass userId
      setAlbums(fetchedAlbums);
    } catch (error) {
      toast({ title: "Error", description: "No se pudieron cargar los álbumes.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [toast, user]); // Added user dependency

  useEffect(() => {
    fetchAlbumsList();
  }, [fetchAlbumsList]);

  const handleAlbumCreated = (newAlbum: Album) => {
    setAlbums(prev => [...prev, newAlbum].sort((a,b) => a.name.localeCompare(b.name)));
  };

  const handleAlbumDeleted = (deletedAlbumId: string) => {
    setAlbums(prev => prev.filter(album => album.id !== deletedAlbumId));
  };
  
  const handleAlbumRenamed = (updatedAlbum: Album) => {
    setAlbums(prev => 
      prev.map(album => album.id === updatedAlbum.id ? updatedAlbum : album)
        .sort((a,b) => a.name.localeCompare(b.name))
    );
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
        <p>Por favor, inicia sesión para ver tus álbumes.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <h1 className="text-3xl font-bold">Álbumes</h1>
        <Button onClick={() => setShowCreateModal(true)}>
          <PlusCircle className="mr-2 h-5 w-5" /> Crear Nuevo Álbum
        </Button>
      </div>

      {albums.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {albums.map(album => (
            <AlbumCard 
              key={album.id} 
              album={album} 
              onAlbumDeleted={handleAlbumDeleted}
              onAlbumRenamed={handleAlbumRenamed}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-10">
          <AlbumIcon className="mx-auto h-24 w-24 text-muted-foreground" />
          <p className="mt-4 text-xl font-semibold text-muted-foreground">No has creado ningún álbum todavía.</p>
          <p className="text-sm text-muted-foreground">Empieza por crear uno para organizar tus recuerdos.</p>
          <Button onClick={() => setShowCreateModal(true)} className="mt-6">
            <PlusCircle className="mr-2 h-5 w-5" /> Crear Álbum
          </Button>
        </div>
      )}

      {user && (
        <CreateAlbumModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onAlbumCreated={handleAlbumCreated}
          userId={user.id}
        />
      )}
    </div>
  );
}

