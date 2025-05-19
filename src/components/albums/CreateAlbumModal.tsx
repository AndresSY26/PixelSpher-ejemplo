
"use client";

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { createAlbum } from '@/app/actions/albumActions';
import type { Album } from '@/types';

const albumSchema = z.object({
  name: z.string().min(1, { message: "El nombre del álbum es requerido." }).max(50, { message: "El nombre no puede exceder los 50 caracteres." }),
});

type AlbumFormValues = z.infer<typeof albumSchema>;

interface CreateAlbumModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAlbumCreated: (newAlbum: Album) => void;
  userId: string; // Added userId prop
}

export default function CreateAlbumModal({ isOpen, onClose, onAlbumCreated, userId }: CreateAlbumModalProps) {
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);

  const form = useForm<AlbumFormValues>({
    resolver: zodResolver(albumSchema),
    defaultValues: {
      name: '',
    },
  });

  const onSubmit = async (data: AlbumFormValues) => {
    setIsSaving(true);
    try {
      const result = await createAlbum(data.name, userId); // Pass userId to createAlbum
      if ('id' in result) { 
        toast({ title: "Álbum Creado", description: `El álbum "${result.name}" ha sido creado.` });
        onAlbumCreated(result);
        form.reset();
        onClose();
      } else { 
        toast({ title: "Error al Crear Álbum", description: result.error, variant: "destructive" });
        form.setError("name", { type: "manual", message: result.error });
      }
    } catch (error) {
      toast({ title: "Error Inesperado", description: "Ocurrió un error al crear el álbum.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) { form.reset(); onClose(); } }}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Crear Nuevo Álbum</DialogTitle>
          <DialogDescription>
            Ingresa un nombre para tu nuevo álbum.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
          <div className="space-y-1">
            <Label htmlFor="name">Nombre del Álbum</Label>
            <Input id="name" {...form.register('name')} autoFocus />
            {form.formState.errors.name && (
              <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
            )}
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" onClick={() => { form.reset(); onClose(); }} disabled={isSaving}>
                Cancelar
              </Button>
            </DialogClose>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Crear Álbum
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
