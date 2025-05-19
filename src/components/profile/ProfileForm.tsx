"use client";

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import type { User } from '@/types';
import { updateUserProfile } from '@/app/actions/authActions';
import { Loader2 } from 'lucide-react';

const profileSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters." }),
  newPassword: z.string().optional(),
  confirmNewPassword: z.string().optional(),
}).refine(data => {
  if (data.newPassword && data.newPassword.length < 6) return false; // Password min length
  return true;
}, {
  message: "New password must be at least 6 characters.",
  path: ["newPassword"],
}).refine(data => data.newPassword === data.confirmNewPassword, {
  message: "Passwords do not match.",
  path: ["confirmNewPassword"],
});

type ProfileFormValues = z.infer<typeof profileSchema>;

interface ProfileFormProps {
  currentUser: User;
  onProfileUpdate: (updatedUser: Partial<User>) => void;
}

export default function ProfileForm({ currentUser, onProfileUpdate }: ProfileFormProps) {
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: currentUser.name,
      newPassword: '',
      confirmNewPassword: '',
    },
  });

  const onSubmit = async (data: ProfileFormValues) => {
    setIsSaving(true);
    try {
      const updatedUser = await updateUserProfile(currentUser.id, data.name, data.newPassword || undefined);
      if (updatedUser) {
        onProfileUpdate(updatedUser); // Update context/local storage
        toast({ title: "Profile Updated", description: "Your profile has been successfully updated." });
        form.reset({ name: updatedUser.name, newPassword: '', confirmNewPassword: '' }); // Reset form, clear passwords
      } else {
        toast({ title: "Update Failed", description: "Could not update profile.", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error", description: "An unexpected error occurred.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Editar Perfil</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col items-center space-y-2">
            <Avatar className="h-24 w-24 text-3xl">
              <AvatarFallback className="bg-primary text-primary-foreground font-semibold">
                {currentUser.avatarLetter || currentUser.name.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <Button type="button" variant="link" className="text-sm" disabled>
              Cambiar Foto <span className="text-xs text-muted-foreground ml-1">(Máx 2MB; JPG, PNG, GIF, WEBP)</span>
            </Button>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Nombre</Label>
            <Input id="name" {...form.register('name')} className="bg-input"/>
            {form.formState.errors.name && (
              <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
            )}
          </div>

          <div className="space-y-1">
            <Label>Username</Label>
            <Input value={currentUser.username} disabled className="bg-muted/50"/>
            <p className="text-xs text-muted-foreground">El nombre de usuario no se puede cambiar.</p>
          </div>

          <div className="space-y-1">
            <Label>Email</Label>
            <Input value={currentUser.email} disabled className="bg-muted/50"/>
            <p className="text-xs text-muted-foreground">El correo electrónico no se puede cambiar.</p>
          </div>

          <CardTitle className="text-lg pt-4 border-t mt-6">Cambiar Contraseña</CardTitle>
          <div className="space-y-2">
            <Label htmlFor="newPassword">Nueva Contraseña</Label>
            <Input id="newPassword" type="password" {...form.register('newPassword')} placeholder="Dejar en blanco para no cambiar" className="bg-input"/>
            {form.formState.errors.newPassword && (
              <p className="text-sm text-destructive">{form.formState.errors.newPassword.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmNewPassword">Confirmar Nueva Contraseña</Label>
            <Input id="confirmNewPassword" type="password" {...form.register('confirmNewPassword')} className="bg-input"/>
            {form.formState.errors.confirmNewPassword && (
              <p className="text-sm text-destructive">{form.formState.errors.confirmNewPassword.message}</p>
            )}
          </div>
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button type="button" variant="destructive" disabled>Eliminar Perfil</Button>
          <Button type="submit" disabled={isSaving}>
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Guardar Cambios
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
