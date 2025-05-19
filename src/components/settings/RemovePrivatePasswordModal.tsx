
"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { removePrivatePassword } from '@/app/actions/settingsActions'; // Updated import
import type { User } from '@/types';

interface RemovePrivatePasswordModalProps {
  user: User;
  isOpen: boolean;
  onClose: () => void;
  onPasswordRemoved: () => void;
}

export default function RemovePrivatePasswordModal({ user, isOpen, onClose, onPasswordRemoved }: RemovePrivatePasswordModalProps) {
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleRemovePassword = async () => {
    setIsProcessing(true);
    try {
      const result = await removePrivatePassword(user.id);
      if (result.success) {
        toast({ title: "Contraseña Eliminada", description: "La contraseña de tu carpeta privada ha sido eliminada." });
        onPasswordRemoved();
        onClose();
      } else {
        toast({ title: "Error al Eliminar", description: result.error || "No se pudo eliminar la contraseña.", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error Inesperado", description: "Ocurrió un error al eliminar la contraseña.", variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Confirmar Eliminación de Contraseña</AlertDialogTitle>
          <AlertDialogDescription>
            ¿Estás seguro de que deseas eliminar la contraseña de la carpeta privada? 
            Esto hará que la carpeta y su contenido ya no estén protegidos por contraseña. 
            Cualquier archivo en ella podría ser movido a la galería general sin necesidad de una contraseña.
            Los archivos actualmente en la carpeta privada permanecerán allí hasta que los muevas.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel asChild>
            <Button variant="outline" onClick={onClose} disabled={isProcessing}>
              Cancelar
            </Button>
          </AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button onClick={handleRemovePassword} variant="destructive" disabled={isProcessing}>
              {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Eliminar Contraseña
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
