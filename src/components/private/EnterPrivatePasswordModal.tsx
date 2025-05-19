
"use client";

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { verifyPrivatePassword } from '@/app/actions/privateFolderActions';
import type { User } from '@/types';

const passwordSchema = z.object({
  password: z.string().min(1, { message: "La contraseña es requerida." }),
});

type PasswordFormValues = z.infer<typeof passwordSchema>;

interface EnterPrivatePasswordModalProps {
  user: User;
  isOpen: boolean;
  onClose: () => void;
  onUnlockSuccess: () => void;
}

export default function EnterPrivatePasswordModal({ user, isOpen, onClose, onUnlockSuccess }: EnterPrivatePasswordModalProps) {
  const { toast } = useToast();
  const [isVerifying, setIsVerifying] = useState(false);

  const form = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      password: '',
    },
  });

  const onSubmit = async (data: PasswordFormValues) => {
    setIsVerifying(true);
    try {
      const result = await verifyPrivatePassword(user.id, data.password);
      if (result.success) {
        toast({ title: "Carpeta Desbloqueada", description: "Has accedido a tu carpeta privada." });
        onUnlockSuccess();
        onClose();
      } else {
        toast({ title: "Error de Verificación", description: result.error || "No se pudo verificar la contraseña.", variant: "destructive" });
        form.setError("password", { type: "manual", message: result.error || "Contraseña incorrecta." });
      }
    } catch (error) {
      toast({ title: "Error Inesperado", description: "Ocurrió un error al verificar la contraseña.", variant: "destructive" });
    } finally {
      setIsVerifying(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Contraseña Carpeta Privada</DialogTitle>
          <DialogDescription>
            Ingresa la contraseña para acceder a tu carpeta privada.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
          <div className="space-y-1">
            <Label htmlFor="password">Contraseña</Label>
            <Input id="password" type="password" {...form.register('password')} />
            {form.formState.errors.password && (
              <p className="text-sm text-destructive">{form.formState.errors.password.message}</p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isVerifying}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isVerifying}>
              {isVerifying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Desbloquear
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
