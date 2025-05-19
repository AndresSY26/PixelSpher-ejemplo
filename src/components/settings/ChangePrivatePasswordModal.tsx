
"use client";

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { changePrivatePassword, setPrivatePassword, verifyPrivatePassword } from '@/app/actions/settingsActions'; // Updated import
import type { User } from '@/types';

const passwordChangeSchemaBase = {
  newPassword: z.string().min(6, { message: "La nueva contraseña debe tener al menos 6 caracteres." }),
  confirmNewPassword: z.string(),
};

const passwordChangeSchema = z.object({
  currentPassword: z.string().optional(), // Optional for initial setup
  ...passwordChangeSchemaBase
}).refine((data) => data.newPassword === data.confirmNewPassword, {
  message: "Las nuevas contraseñas no coinciden.",
  path: ["confirmNewPassword"],
});

const initialPasswordSetupSchema = z.object(passwordChangeSchemaBase)
.refine((data) => data.newPassword === data.confirmNewPassword, {
  message: "Las contraseñas no coinciden.",
  path: ["confirmNewPassword"],
});


type PasswordFormValues = z.infer<typeof passwordChangeSchema>;

interface ChangePrivatePasswordModalProps {
  user: User;
  isOpen: boolean;
  isPasswordInitiallySet: boolean;
  onClose: () => void;
  onPasswordChanged: () => void;
}

export default function ChangePrivatePasswordModal({ user, isOpen, isPasswordInitiallySet, onClose, onPasswordChanged }: ChangePrivatePasswordModalProps) {
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);

  const activeSchema = isPasswordInitiallySet ? passwordChangeSchema : initialPasswordSetupSchema;

  const form = useForm<PasswordFormValues>({
    resolver: zodResolver(activeSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmNewPassword: '',
    },
  });

  const onSubmit = async (data: PasswordFormValues) => {
    setIsSaving(true);
    try {
      let result;
      if (isPasswordInitiallySet) {
        if (!data.currentPassword) {
            form.setError("currentPassword", { type: "manual", message: "La contraseña actual es requerida." });
            setIsSaving(false);
            return;
        }
        // Verify current password first
        const verificationResult = await verifyPrivatePassword(user.id, data.currentPassword);
        if (!verificationResult.success) {
          form.setError("currentPassword", { type: "manual", message: verificationResult.error || "Contraseña actual incorrecta." });
          setIsSaving(false);
          return;
        }
        result = await changePrivatePassword(user.id, data.currentPassword, data.newPassword);
      } else {
        result = await setPrivatePassword(user.id, data.newPassword);
      }

      if (result.success) {
        toast({ title: "Contraseña Actualizada", description: "La contraseña de tu carpeta privada ha sido actualizada." });
        onPasswordChanged();
        onClose();
      } else {
        toast({ title: "Error al Actualizar", description: result.error || "No se pudo actualizar la contraseña.", variant: "destructive" });
        if (result.error?.toLowerCase().includes("actual")) {
             form.setError("currentPassword", { type: "manual", message: result.error });
        } else {
             form.setError("newPassword", { type: "manual", message: result.error });
        }
      }
    } catch (error) {
      toast({ title: "Error Inesperado", description: "Ocurrió un error al cambiar la contraseña.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) { form.reset(); onClose(); } }}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{isPasswordInitiallySet ? "Cambiar Contraseña" : "Configurar Contraseña"} de Carpeta Privada</DialogTitle>
          <DialogDescription>
            {isPasswordInitiallySet ? "Ingresa tu contraseña actual y la nueva contraseña." : "Establece una nueva contraseña para tu carpeta privada."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
          {isPasswordInitiallySet && (
            <div className="space-y-1">
              <Label htmlFor="currentPassword">Contraseña Actual</Label>
              <Input id="currentPassword" type="password" {...form.register('currentPassword')} />
              {form.formState.errors.currentPassword && (
                <p className="text-sm text-destructive">{form.formState.errors.currentPassword.message}</p>
              )}
            </div>
          )}
          <div className="space-y-1">
            <Label htmlFor="newPassword">Nueva Contraseña</Label>
            <Input id="newPassword" type="password" {...form.register('newPassword')} />
            {form.formState.errors.newPassword && (
              <p className="text-sm text-destructive">{form.formState.errors.newPassword.message}</p>
            )}
          </div>
          <div className="space-y-1">
            <Label htmlFor="confirmNewPassword">Confirmar Nueva Contraseña</Label>
            <Input id="confirmNewPassword" type="password" {...form.register('confirmNewPassword')} />
            {form.formState.errors.confirmNewPassword && (
              <p className="text-sm text-destructive">{form.formState.errors.confirmNewPassword.message}</p>
            )}
          </div>
          <p className="text-xs text-muted-foreground">La nueva contraseña debe tener al menos 6 caracteres.</p>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" onClick={() => { form.reset(); onClose(); }} disabled={isSaving}>
                Cancelar
              </Button>
            </DialogClose>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Guardar Nueva Contraseña
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
