
"use client";

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

interface TwoFactorAuthSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function TwoFactorAuthSetupModal({ isOpen, onClose }: TwoFactorAuthSetupModalProps) {
  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Configurar Autenticación de Dos Pasos (2FA)</DialogTitle>
          <DialogDescription>
            La funcionalidad para configurar 2FA (por ejemplo, escaneo de código QR para una aplicación de autenticación) se implementará aquí.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <p className="text-sm text-muted-foreground">
            Este es un marcador de posición. En una implementación real, aquí verías instrucciones para escanear un código QR con tu aplicación de autenticación (como Google Authenticator, Authy, etc.) y luego ingresar un código de verificación.
          </p>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" onClick={onClose}>
              Cerrar
            </Button>
          </DialogClose>
          {/* <Button type="button" disabled>Verificar (Deshabilitado)</Button> */}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
