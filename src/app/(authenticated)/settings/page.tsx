
"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Lock, Trash2, HardDrive, LogOut as LogOutIcon, Laptop2, Download, Upload, Info, Settings as SettingsIcon, SlidersHorizontal, SortAsc, CheckCircle2, ListVideo, MousePointerClick, History, Columns, ShieldCheck, ShieldAlert, Wifi, RefreshCw, CloudCog } from 'lucide-react'; // Added Wifi, RefreshCw, CloudCog
import ChangePrivatePasswordModal from '@/components/settings/ChangePrivatePasswordModal';
import RemovePrivatePasswordModal from '@/components/settings/RemovePrivatePasswordModal';
import TwoFactorAuthSetupModal from '@/components/settings/TwoFactorAuthSetupModal';
import ManageOfflineContentModal from '@/components/settings/ManageOfflineContentModal'; // New Import
import { useAuth } from '@/context/AuthContext';
import {
  checkPrivatePasswordStatus,
  getStorageUsage,
  getActiveSessionsForUser,
  removeActiveSession,
  removeOtherActiveSessions,
  updateUserLanguagePreference,
  exportAllUserData,
  importAllUserData,
  getUserPreferences,
  updateUserPreferences
} from '@/app/actions/settingsActions';
import type { ActiveSession, User, UserPreferences } from '@/types';
import { DEFAULT_USER_PREFERENCES } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { permanentlyDeleteMultipleTrashItems, getTrashItems } from '@/app/actions/trashActions';
import { getOfflineItemIds } from '@/app/actions/offlineActions'; // New Import
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
import { Loader2 } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { saveAs } from 'file-saver';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

export default function SettingsPage() {
  const { user, logout, getCurrentSessionId, updateUserInContext } = useAuth();
  const { toast } = useToast();
  const [isChangePasswordModalOpen, setIsChangePasswordModalOpen] = useState(false);
  const [isRemovePasswordModalOpen, setIsRemovePasswordModalOpen] = useState(false);
  const [isPasswordSet, setIsPasswordSet] = useState(false);
  const [storageInfo, setStorageInfo] = useState<{ used: string; total: string; percentage: number, usedBytes: number } | null>(null);
  const [isLoadingStorage, setIsLoadingStorage] = useState(true);

  const [showEmptyTrashConfirm, setShowEmptyTrashConfirm] = useState(false);
  const [isProcessingTrash, setIsProcessingTrash] = useState(false);

  const [activeSessions, setActiveSessions] = useState<ActiveSession[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(true);
  const [currentSessionIdValue, setCurrentSessionIdValue] = useState<string | null>(null);
  const [showTerminateSessionConfirm, setShowTerminateSessionConfirm] = useState<ActiveSession | null>(null);
  const [isProcessingSessionAction, setIsProcessingSessionAction] = useState(false);
  const [showTerminateOtherSessionsConfirm, setShowTerminateOtherSessionsConfirm] = useState(false);

  const [currentSelectedLanguage, setCurrentSelectedLanguage] = useState(user?.preferences?.languagePreference || 'es');
  const [isSavingLanguage, setIsSavingLanguage] = useState(false);

  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [selectedImportFile, setSelectedImportFile] = useState<File | null>(null);
  const [showImportConfirmModal, setShowImportConfirmModal] = useState(false);
  const importFileInputRef = useRef<HTMLInputElement>(null);

  const [appPreferences, setAppPreferences] = useState<UserPreferences>(DEFAULT_USER_PREFERENCES);
  const [isLoadingPreferences, setIsLoadingPreferences] = useState(true);
  const [isSavingPreference, setIsSavingPreference] = useState(false);

  const [isTwoFactorAuthEnabled, setIsTwoFactorAuthEnabled] = useState(false); // Visual only for now
  const [isTwoFactorSetupModalOpen, setIsTwoFactorSetupModalOpen] = useState(false);

  const [isManageOfflineModalOpen, setIsManageOfflineModalOpen] = useState(false); // New state
  const [offlineItemCount, setOfflineItemCount] = useState(0); // New state
  const [isLoadingOfflineCount, setIsLoadingOfflineCount] = useState(true); // New state


  const fetchActiveSessions = useCallback(async () => {
    if (user) {
      setIsLoadingSessions(true);
      try {
        const sessions = await getActiveSessionsForUser(user.id);
        setActiveSessions(sessions);
      } catch (error) {
        toast({ title: "Error", description: "No se pudieron cargar las sesiones activas.", variant: "destructive" });
      } finally {
        setIsLoadingSessions(false);
      }
    }
  }, [user, toast]);

  const fetchOfflineCount = useCallback(async () => {
    if (user) {
      setIsLoadingOfflineCount(true);
      try {
        const ids = await getOfflineItemIds(user.id);
        setOfflineItemCount(ids.length);
      } catch (error) {
        toast({ title: "Error", description: "No se pudo obtener el conteo de ítems sin conexión.", variant: "destructive" });
      } finally {
        setIsLoadingOfflineCount(false);
      }
    }
  }, [user, toast]);


  const fetchInitialSettingsAndPreferences = useCallback(async () => {
    if (user) {
      setIsLoadingStorage(true);
      setIsLoadingPreferences(true);
      try {
        const [passwordStatus, usage, preferences] = await Promise.all([
          checkPrivatePasswordStatus(user.id),
          getStorageUsage(),
          getUserPreferences(user.id)
        ]);

        setIsPasswordSet(passwordStatus.isPasswordSet);
        const totalBytes = 26 * 1024 * 1024 * 1024;
        const percentage = totalBytes > 0 ? (usage.usedBytes / totalBytes) * 100 : 0;
        setStorageInfo({
          used: usage.readableUsed,
          total: "26 GB",
          percentage: Math.min(100, Math.round(percentage)),
          usedBytes: usage.usedBytes,
        });
        setCurrentSelectedLanguage(preferences.languagePreference || 'es');
        setAppPreferences(preferences);
      } catch (error) {
        console.error("Error fetching settings data:", error);
        toast({ title: "Error", description: "No se pudieron cargar los datos de configuración.", variant: "destructive" });
        setStorageInfo({ used: "Cálculo no disponible", total: "26 GB", percentage: 0, usedBytes: 0 });
        setAppPreferences(DEFAULT_USER_PREFERENCES);
      } finally {
        setIsLoadingStorage(false);
        setIsLoadingPreferences(false);
      }
    } else {
      setIsLoadingStorage(false);
      setIsLoadingPreferences(false);
      setStorageInfo({ used: "N/A", total: "26 GB", percentage: 0, usedBytes: 0 });
      setAppPreferences(DEFAULT_USER_PREFERENCES);
    }
  }, [user, toast]);

  useEffect(() => {
    fetchInitialSettingsAndPreferences();
    fetchActiveSessions();
    fetchOfflineCount(); // Fetch on initial load
    setCurrentSessionIdValue(getCurrentSessionId());
  }, [user, fetchInitialSettingsAndPreferences, fetchActiveSessions, fetchOfflineCount, getCurrentSessionId]);


  const handlePasswordChanged = () => {
    setIsPasswordSet(true);
  };

  const handlePasswordRemoved = () => {
    setIsPasswordSet(false);
  };

  const refreshStorageInfo = async () => {
    setIsLoadingStorage(true);
    if (user) {
      try {
        const usage = await getStorageUsage();
        const totalBytes = 26 * 1024 * 1024 * 1024;
        const percentage = totalBytes > 0 ? (usage.usedBytes / totalBytes) * 100 : 0;
        setStorageInfo({
          used: usage.readableUsed,
          total: "26 GB",
          percentage: Math.min(100, Math.round(percentage)),
          usedBytes: usage.usedBytes,
        });
      } catch (error) {
        console.error("Error fetching storage usage:", error);
        setStorageInfo({ used: "Cálculo no disponible", total: "26 GB", percentage: 0, usedBytes: 0 });
      } finally {
        setIsLoadingStorage(false);
      }
    } else {
        setIsLoadingStorage(false);
    }
  };

  const handleEmptyTrash = async () => {
    setShowEmptyTrashConfirm(false);
    setIsProcessingTrash(true);
    if (!user) {
      toast({ title: "Error", description: "Usuario no autenticado.", variant: "destructive" });
      setIsProcessingTrash(false);
      return;
    }
    try {
      const trashItems = await getTrashItems(user.id);
      if (trashItems.length === 0) {
        toast({ title: "Papelera Vacía", description: "No hay ítems en la papelera para eliminar." });
        setIsProcessingTrash(false);
        return;
      }
      const itemIds = trashItems.map(item => item.id);
      const result = await permanentlyDeleteMultipleTrashItems(itemIds, user.id);
      if (result.success) {
        toast({ title: "Papelera Vaciada", description: `${result.deletedCount} ítem(s) eliminado(s) permanentemente.` });
      } else {
        toast({ title: "Error al Vaciar Papelera", description: result.error || "No se pudieron eliminar todos los ítems.", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error Inesperado", description: "No se pudo vaciar la papelera.", variant: "destructive" });
    } finally {
      setIsProcessingTrash(false);
      refreshStorageInfo();
    }
  };

  const handleLanguageChange = async (newLang: string) => {
    if (!user) return;
    setIsSavingLanguage(true);
    const result = await updateUserLanguagePreference(user.id, newLang);
    if (result.success && result.user?.preferences) {
      updateUserInContext({ preferences: { ...user.preferences, languagePreference: newLang } });
      setCurrentSelectedLanguage(newLang);
      toast({ title: "Idioma Guardado", description: "Preferencia de idioma actualizada." });
    } else {
      toast({ title: "Error", description: result.error || "No se pudo guardar la preferencia de idioma.", variant: "destructive" });
    }
    setIsSavingLanguage(false);
  };

  const handlePreferenceChange = async (key: keyof UserPreferences, value: any) => {
    if (!user) return;
    setIsSavingPreference(true);

    let processedValue = value;
    if (key === 'galleryItemsPerPage' && typeof value === 'string') {
      processedValue = parseInt(value, 10);
      if (isNaN(processedValue)) {
        processedValue = DEFAULT_USER_PREFERENCES.galleryItemsPerPage;
      }
    }

    const newPrefs = { ...appPreferences, [key]: processedValue };
    const result = await updateUserPreferences(user.id, { [key]: processedValue });
    if (result.success && result.preferences) {
      setAppPreferences(result.preferences);
      updateUserInContext({ preferences: result.preferences });
      toast({ title: "Preferencia Guardada", description: "La configuración de comportamiento ha sido actualizada.", icon: <CheckCircle2 className="h-5 w-5 text-green-500" /> });
    } else {
      toast({ title: "Error", description: result.error || "No se pudo guardar la preferencia.", variant: "destructive" });
      setAppPreferences(prev => ({ ...prev }));
    }
    setIsSavingPreference(false);
  };


  const handleTerminateSession = async () => {
    if (!showTerminateSessionConfirm) return;
    const sessionToTerminate = showTerminateSessionConfirm;
    setShowTerminateSessionConfirm(null);
    setIsProcessingSessionAction(true);

    try {
      const result = await removeActiveSession(sessionToTerminate.sessionId);
      if (result.success) {
        toast({ title: "Sesión Cerrada", description: "La sesión ha sido cerrada." });
        if (sessionToTerminate.sessionId === currentSessionIdValue) {
          logout();
        } else {
          fetchActiveSessions();
        }
      } else {
        toast({ title: "Error", description: result.error || "No se pudo cerrar la sesión.", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error Inesperado", description: "Ocurrió un error al cerrar la sesión.", variant: "destructive" });
    } finally {
      setIsProcessingSessionAction(false);
    }
  };

  const handleTerminateOtherSessions = async () => {
    if (!user || !currentSessionIdValue) return;
    setShowTerminateOtherSessionsConfirm(false);
    setIsProcessingSessionAction(true);
    try {
      const result = await removeOtherActiveSessions(user.id, currentSessionIdValue);
      if (result.success) {
        toast({ title: "Sesiones Cerradas", description: "Todas las demás sesiones han sido cerradas." });
        fetchActiveSessions();
      } else {
        toast({ title: "Error", description: result.error || "No se pudieron cerrar las demás sesiones.", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error Inesperado", description: "Ocurrió un error al cerrar las demás sesiones.", variant: "destructive" });
    } finally {
      setIsProcessingSessionAction(false);
    }
  };

  const handleExportData = async () => {
    if (!user) {
      toast({ title: "Error", description: "Usuario no autenticado.", variant: "destructive" });
      return;
    }
    setIsExporting(true);
    toast({ title: "Exportación Iniciada", description: "Preparando tus datos para la descarga..." });
    try {
      const result = await exportAllUserData(user.id);
      if ('error' in result) {
        toast({ title: "Error de Exportación", description: result.error, variant: "destructive" });
        return;
      }

      const dataStr = JSON.stringify(result, null, 2);
      const blob = new Blob([dataStr], { type: "application/json" });
      const dateSuffix = new Date().toISOString().split('T')[0];
      saveAs(blob, `pixelsphere_backup_${dateSuffix}.json`);

      toast({ title: "Exportación Completada", description: "Tus datos han sido descargados como pixelsphere_backup.json." });

    } catch (error) {
      console.error("Export error:", error);
      toast({ title: "Error de Exportación", description: `Ocurrió un error inesperado: ${error instanceof Error ? error.message : 'Error desconocido'}`, variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      if (file.type === "application/json" || file.name.endsWith(".json")) {
        setSelectedImportFile(file);
      } else {
        toast({ title: "Archivo Inválido", description: "Por favor, selecciona un archivo .json.", variant: "destructive" });
        setSelectedImportFile(null);
        if (importFileInputRef.current) importFileInputRef.current.value = "";
      }
    } else {
      setSelectedImportFile(null);
    }
  };

  const handleConfirmImport = async () => {
    if (!selectedImportFile || !user) return;
    setShowImportConfirmModal(false);
    setIsImporting(true);
    toast({ title: "Importación Iniciada", description: "Procesando el archivo de respaldo..." });

    try {
      const fileContent = await selectedImportFile.text();
      const dataToImport = JSON.parse(fileContent);

      const expectedKeys = ["users.json", "gallery.json"];
      const missingKeys = expectedKeys.filter(key => !(key in dataToImport));
      if (missingKeys.length > 0) {
        toast({ title: "Archivo de Importación Inválido", description: `Faltan datos esenciales: ${missingKeys.join(', ')}.`, variant: "destructive", duration: 10000 });
        setIsImporting(false);
        return;
      }

      const result = await importAllUserData(dataToImport, user.id);

      if (result.success) {
        toast({ title: "Importación Completada", description: "Datos importados con éxito. Se recomienda recargar la aplicación o cerrar y volver a iniciar sesión.", duration: 7000 });
        window.location.reload();
      } else {
        let errorDescription = result.error || "Ocurrió un error desconocido durante la importación.";
        if (result.details) {
          errorDescription += ` Detalles: ` + Object.entries(result.details).map(([file, msg]) => `${file}: ${msg}`).join("; ");
        }
        toast({ title: "Error de Importación", description: errorDescription, variant: "destructive", duration: 10000 });
      }
    } catch (error) {
      console.error("Import error:", error);
      toast({ title: "Error de Importación", description: `Error al procesar el archivo JSON: ${error instanceof Error ? error.message : 'Error desconocido'}`, variant: "destructive" });
    } finally {
      setIsImporting(false);
      setSelectedImportFile(null);
      if (importFileInputRef.current) importFileInputRef.current.value = "";
    }
  };


  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold">Configuración</h1>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><SettingsIcon className="h-6 w-6 text-primary" />Idioma</CardTitle>
          <CardDescription>Selecciona tu idioma preferido para la aplicación.</CardDescription>
        </CardHeader>
        <CardContent>
          <Select
            value={currentSelectedLanguage}
            onValueChange={handleLanguageChange}
            disabled={isSavingLanguage}
          >
            <SelectTrigger className="w-[280px]">
              <SelectValue placeholder="Selecciona un idioma" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="es">Español</SelectItem>
              <SelectItem value="en">Inglés (English)</SelectItem>
              <SelectItem value="fr">Francés (French)</SelectItem>
              <SelectItem value="ja">Japonés (Japanese)</SelectItem>
            </SelectContent>
          </Select>
          {isSavingLanguage && <Loader2 className="ml-2 h-5 w-5 animate-spin inline-block" />}
        </CardContent>
      </Card>
      <Separator />

      <div>
        <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2"><ShieldAlert className="h-7 w-7 text-primary" />Seguridad</h2>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Lock className="h-6 w-6 text-primary" />Carpeta Privada</CardTitle>
            <CardDescription>Administra la seguridad de tu carpeta privada.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 md:space-y-0 md:flex md:flex-row md:gap-4">
            {isPasswordSet ? (
              <>
                <Button onClick={() => setIsChangePasswordModalOpen(true)} className="w-full md:w-auto">
                  Cambiar Contraseña
                </Button>
                <Button onClick={() => setIsRemovePasswordModalOpen(true)} variant="destructive" className="w-full md:w-auto">
                  Eliminar Contraseña
                </Button>
              </>
            ) : (
              <div className="text-center p-4 border border-dashed rounded-md w-full">
                <p className="text-muted-foreground mb-2">No has configurado una contraseña para tu carpeta privada.</p>
                <Button onClick={() => setIsChangePasswordModalOpen(true)}>
                  Configurar Contraseña
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-6 w-6 text-primary" />Autenticación de Dos Pasos (2FA)</CardTitle>
            <CardDescription>Añade una capa extra de seguridad a tu cuenta. Al iniciar sesión, además de tu contraseña, se te pedirá un código de una aplicación de autenticación o enviado a tu dispositivo.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="2fa-toggle" className="text-base">Activar Autenticación de Dos Pasos</Label>
              <Switch
                id="2fa-toggle"
                checked={isTwoFactorAuthEnabled}
                onCheckedChange={setIsTwoFactorAuthEnabled} // Visual toggle only
              />
            </div>
            <div>
              {isTwoFactorAuthEnabled ? (
                <Button variant="outline" onClick={() => setIsTwoFactorSetupModalOpen(true)}>Administrar 2FA</Button>
              ) : (
                <Button onClick={() => setIsTwoFactorSetupModalOpen(true)}>Configurar 2FA</Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>


      {user && isChangePasswordModalOpen && (
        <ChangePrivatePasswordModal
          user={user}
          isOpen={isChangePasswordModalOpen}
          isPasswordInitiallySet={isPasswordSet}
          onClose={() => setIsChangePasswordModalOpen(false)}
          onPasswordChanged={handlePasswordChanged}
        />
      )}
      {user && isRemovePasswordModalOpen && (
        <RemovePrivatePasswordModal
          user={user}
          isOpen={isRemovePasswordModalOpen}
          onClose={() => setIsRemovePasswordModalOpen(false)}
          onPasswordRemoved={handlePasswordRemoved}
        />
      )}
      {isTwoFactorSetupModalOpen && (
        <TwoFactorAuthSetupModal
          isOpen={isTwoFactorSetupModalOpen}
          onClose={() => setIsTwoFactorSetupModalOpen(false)}
        />
      )}
      <Separator />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><SlidersHorizontal className="h-6 w-6 text-primary" />Comportamiento de la Aplicación</CardTitle>
          <CardDescription>Personaliza cómo interactúa la aplicación.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {isLoadingPreferences ? (
            <div className="flex items-center justify-center h-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /><p className="ml-2 text-muted-foreground">Cargando preferencias...</p></div>
          ) : (
            <>
              <div className="space-y-2">
                <Label className="text-base font-medium flex items-center gap-2"><MousePointerClick className="h-5 w-5 text-muted-foreground" />Confirmaciones de Acciones</Label>
                <div className="flex items-center justify-between p-3 border rounded-md">
                  <Label htmlFor="confirmMoveToTrash" className="flex-1 cursor-pointer">Confirmar antes de mover a la Papelera desde Galería</Label>
                  <Switch
                    id="confirmMoveToTrash"
                    checked={appPreferences.confirmMoveToTrash ?? DEFAULT_USER_PREFERENCES.confirmMoveToTrash}
                    onCheckedChange={(checked) => handlePreferenceChange('confirmMoveToTrash', checked)}
                    disabled={isSavingPreference}
                  />
                </div>
                <div className="flex items-center justify-between p-3 border rounded-md">
                  <Label htmlFor="confirmMoveToPrivate" className="flex-1 cursor-pointer">Confirmar antes de mover a la Carpeta Privada desde Galería</Label>
                  <Switch
                    id="confirmMoveToPrivate"
                    checked={appPreferences.confirmMoveToPrivate ?? DEFAULT_USER_PREFERENCES.confirmMoveToPrivate}
                    onCheckedChange={(checked) => handlePreferenceChange('confirmMoveToPrivate', checked)}
                    disabled={isSavingPreference}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-base font-medium flex items-center gap-2"><SortAsc className="h-5 w-5 text-muted-foreground" />Galería Principal</Label>
                <div className="p-3 border rounded-md space-y-2">
                  <Label htmlFor="defaultGallerySort" className="font-normal">Orden por defecto de los elementos:</Label>
                  <Select
                    value={appPreferences.defaultGallerySort || DEFAULT_USER_PREFERENCES.defaultGallerySort}
                    onValueChange={(value) => handlePreferenceChange('defaultGallerySort', value as UserPreferences['defaultGallerySort'])}
                    disabled={isSavingPreference}
                  >
                    <SelectTrigger className="w-full md:w-[320px]">
                      <SelectValue placeholder="Seleccionar orden" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="chronological_desc">Fecha de subida (más recientes primero)</SelectItem>
                      <SelectItem value="chronological_asc">Fecha de subida (más antiguos primero)</SelectItem>
                      <SelectItem value="name_asc">Nombre (A-Z)</SelectItem>
                      <SelectItem value="name_desc">Nombre (Z-A)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="p-3 border rounded-md space-y-2">
                  <Label htmlFor="galleryItemsPerPage" className="font-normal">Items por página en Galería:</Label>
                  <Select
                    value={String(appPreferences.galleryItemsPerPage || DEFAULT_USER_PREFERENCES.galleryItemsPerPage)}
                    onValueChange={(value) => handlePreferenceChange('galleryItemsPerPage', parseInt(value, 10))}
                    disabled={isSavingPreference}
                  >
                    <SelectTrigger className="w-full md:w-[180px]">
                      <SelectValue placeholder="Seleccionar cantidad" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="26">26</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                      <SelectItem value="100">100</SelectItem>
                      <SelectItem value="999999">Todos</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-base font-medium flex items-center gap-2"><ListVideo className="h-5 w-5 text-muted-foreground" />Multimedia</Label>
                <div className="flex items-center justify-between p-3 border rounded-md">
                  <Label htmlFor="lightboxVideoAutoplay" className="flex-1 cursor-pointer">Reproducir videos automáticamente al abrirlos</Label>
                  <Switch
                    id="lightboxVideoAutoplay"
                    checked={appPreferences.lightboxVideoAutoplay ?? DEFAULT_USER_PREFERENCES.lightboxVideoAutoplay}
                    onCheckedChange={(checked) => handlePreferenceChange('lightboxVideoAutoplay', checked)}
                    disabled={isSavingPreference}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-base font-medium flex items-center gap-2"><History className="h-5 w-5 text-muted-foreground" />Navegación</Label>
                <div className="flex items-center justify-between p-3 border rounded-md">
                  <Label htmlFor="rememberLastSection" className="flex-1 cursor-pointer">Al iniciar, abrir la última sección visitada</Label>
                  <Switch
                    id="rememberLastSection"
                    checked={appPreferences.rememberLastSection ?? DEFAULT_USER_PREFERENCES.rememberLastSection}
                    onCheckedChange={(checked) => handlePreferenceChange('rememberLastSection', checked)}
                    disabled={isSavingPreference}
                  />
                </div>
              </div>
            </>
          )}
          {isSavingPreference && <p className="text-sm text-muted-foreground flex items-center"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Guardando preferencia...</p>}
        </CardContent>
      </Card>
      <Separator />
      
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><CloudCog className="h-6 w-6 text-primary" />Acceso Sin Conexión</CardTitle>
          <CardDescription>Gestiona el contenido disponible sin conexión a internet.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
                {isLoadingOfflineCount ? <Loader2 className="inline-block mr-2 h-4 w-4 animate-spin" /> : 
                `Tienes ${offlineItemCount} elemento(s) marcado(s) para acceso sin conexión.`
                }
            </p>
            <Button variant="outline" onClick={() => setIsManageOfflineModalOpen(true)}>
                Administrar Contenido Sin Conexión
            </Button>
            <div className="pt-4 space-y-4">
                <div className="flex items-center justify-between p-3 border rounded-md">
                    <Label htmlFor="downloadOnlyOnWifi" className="flex-1 cursor-pointer flex items-center gap-2">
                        <Wifi className="h-5 w-5 text-muted-foreground" />
                        Descargar solo con Wi-Fi
                    </Label>
                    <Switch
                        id="downloadOnlyOnWifi"
                        checked={appPreferences.downloadOnlyOnWifi ?? DEFAULT_USER_PREFERENCES.downloadOnlyOnWifi}
                        onCheckedChange={(checked) => handlePreferenceChange('downloadOnlyOnWifi', checked)}
                        disabled={isSavingPreference}
                    />
                </div>
                <div className="flex items-center justify-between p-3 border rounded-md">
                     <Label htmlFor="autoUpdateOfflineContent" className="flex-1 cursor-pointer flex items-center gap-2">
                        <RefreshCw className="h-5 w-5 text-muted-foreground" />
                        Actualizar contenido sin conexión automáticamente
                    </Label>
                    <Switch
                        id="autoUpdateOfflineContent"
                        checked={appPreferences.autoUpdateOfflineContent ?? DEFAULT_USER_PREFERENCES.autoUpdateOfflineContent}
                        onCheckedChange={(checked) => handlePreferenceChange('autoUpdateOfflineContent', checked)}
                        disabled={isSavingPreference}
                    />
                </div>
            </div>
        </CardContent>
      </Card>
      {user && isManageOfflineModalOpen && (
        <ManageOfflineContentModal 
            isOpen={isManageOfflineModalOpen} 
            onClose={() => setIsManageOfflineModalOpen(false)} 
            userId={user.id}
            onOfflineContentChanged={fetchOfflineCount} // Refresh count when modal makes changes
        />
      )}

      <Separator />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><HardDrive className="h-6 w-6 text-primary" />Almacenamiento</CardTitle>
          <CardDescription>Consulta el uso de almacenamiento de tus archivos.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoadingStorage ? (
            <div className="flex items-center justify-center h-20">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-2 text-muted-foreground">Calculando uso...</p>
            </div>
          ) : storageInfo ? (
            <div className="space-y-2">
              <div className="flex justify-between text-sm font-medium items-center">
                <span>Total Utilizado: {storageInfo.usedBytes > 0 ? storageInfo.used : "0 Bytes"}</span>
                <span className="text-muted-foreground">de {storageInfo.total}</span>
              </div>
              <Progress value={storageInfo.percentage} className="h-2.5" />
              {storageInfo.used === "Cálculo no disponible" &&
                <p className="text-xs text-muted-foreground">No se pudo calcular el uso del almacenamiento en este momento.</p>
              }
            </div>
          ) : (
            <p className="text-muted-foreground">No se pudo cargar la información de almacenamiento.</p>
          )}
          <Button variant="outline" onClick={() => setShowEmptyTrashConfirm(true)} disabled={isProcessingTrash || isLoadingStorage}>
            {isProcessingTrash ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
            Vaciar Papelera
          </Button>
        </CardContent>
      </Card>

      <Separator />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Laptop2 className="h-6 w-6 text-primary" />Sesiones Activas</CardTitle>
          <CardDescription>Aquí puedes ver y administrar dónde está iniciada tu sesión.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoadingSessions ? (
            <div className="flex items-center justify-center h-20">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-2 text-muted-foreground">Cargando sesiones...</p>
            </div>
          ) : activeSessions.length > 0 ? (
            <div className="space-y-3">
              {activeSessions.map(session => (
                <div key={session.sessionId} className="flex items-center justify-between p-3 border rounded-md bg-muted/30">
                  <div>
                    <p className="font-medium">{session.deviceInfo} {session.sessionId === currentSessionIdValue && <span className="text-xs text-primary font-semibold ml-1">(Sesión Actual)</span>}</p>
                    <p className="text-xs text-muted-foreground">
                      Iniciado el: {format(parseISO(session.loginTimestamp), "PPPp", { locale: es })}
                    </p>
                    {session.ipAddress && <p className="text-xs text-muted-foreground">IP: {session.ipAddress}</p>}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowTerminateSessionConfirm(session)}
                    disabled={isProcessingSessionAction}
                  >
                    <LogOutIcon className="mr-2 h-4 w-4" /> Cerrar Sesión
                  </Button>
                </div>
              ))}
              {activeSessions.length > 1 && (
                <Button
                  variant="destructive"
                  onClick={() => setShowTerminateOtherSessionsConfirm(true)}
                  className="w-full mt-4"
                  disabled={isProcessingSessionAction}
                >
                  {isProcessingSessionAction && activeSessions.some(s => s.sessionId !== currentSessionIdValue) ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Cerrar Todas las Demás Sesiones
                </Button>
              )}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-4">No hay otras sesiones activas.</p>
          )}
        </CardContent>
      </Card>

      <Separator />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Info className="h-6 w-6 text-primary" />Copia de Seguridad y Restauración</CardTitle>
          <CardDescription>Realiza una copia de seguridad de tus datos de configuración y metadatos, o restaura desde una copia anterior. Esta acción no incluye tus archivos multimedia.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <h3 className="font-medium">Exportar Datos</h3>
            <p className="text-sm text-muted-foreground">Descarga un archivo JSON con todos tus datos de configuración y metadatos de la galería. Guarda este archivo de forma segura.</p>
            <Button onClick={handleExportData} disabled={isExporting || isImporting}>
              {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
              Exportar Mis Datos
            </Button>
          </div>
          <div className="space-y-2">
            <h3 className="font-medium">Importar Datos</h3>
            <p className="text-sm text-muted-foreground">
              Selecciona un archivo <code>.json</code> de copia de seguridad de PixelSphere. <strong className="text-destructive">La importación reemplazará tus datos actuales. ¡Usa con precaución!</strong>
            </p>
            <Input
              type="file"
              accept=".json"
              onChange={handleImportFileChange}
              ref={importFileInputRef}
              className="max-w-sm"
              disabled={isImporting || isExporting}
            />
            {selectedImportFile && (
              <div className="mt-2 text-sm text-muted-foreground">Archivo seleccionado: {selectedImportFile.name}</div>
            )}
            <Button onClick={() => setShowImportConfirmModal(true)} disabled={!selectedImportFile || isImporting || isExporting}>
              {isImporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
              Confirmar Importación
            </Button>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={showEmptyTrashConfirm} onOpenChange={setShowEmptyTrashConfirm}>
        <AlertDialogContent>
          <AlertDialogHeaderComponent>
            <AlertDialogTitleComponent>Confirmar Vaciar Papelera</AlertDialogTitleComponent>
            <AlertDialogDescription>
              ¿Estás seguro de que quieres eliminar permanentemente todos los ítems de la papelera? Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeaderComponent>
          <AlertDialogFooter>
            <AlertDialogCancel asChild>
              <Button variant="outline" onClick={() => setShowEmptyTrashConfirm(false)} disabled={isProcessingTrash}>
                Cancelar
              </Button>
            </AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button onClick={handleEmptyTrash} disabled={isProcessingTrash} className="bg-destructive hover:bg-destructive/90">
                {isProcessingTrash ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                Vaciar Papelera
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {showTerminateSessionConfirm && (
        <AlertDialog open={!!showTerminateSessionConfirm} onOpenChange={(open) => !open && setShowTerminateSessionConfirm(null)}>
          <AlertDialogContent>
            <AlertDialogHeaderComponent>
              <AlertDialogTitleComponent>Confirmar Cerrar Sesión</AlertDialogTitleComponent>
              <AlertDialogDescription>
                ¿Estás seguro de que quieres cerrar esta sesión en {showTerminateSessionConfirm.deviceInfo}?
                {showTerminateSessionConfirm.sessionId === currentSessionIdValue && ` Serás desconectado de tu cuenta.`}
              </AlertDialogDescription>
            </AlertDialogHeaderComponent>
            <AlertDialogFooter>
              <AlertDialogCancel asChild>
                <Button variant="outline" onClick={() => setShowTerminateSessionConfirm(null)} disabled={isProcessingSessionAction}>
                  Cancelar
                </Button>
              </AlertDialogCancel>
              <AlertDialogAction asChild>
                <Button onClick={handleTerminateSession} disabled={isProcessingSessionAction} className="bg-destructive hover:bg-destructive/90">
                  {isProcessingSessionAction ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Cerrar Sesión
                </Button>
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      <AlertDialog open={showTerminateOtherSessionsConfirm} onOpenChange={setShowTerminateOtherSessionsConfirm}>
        <AlertDialogContent>
          <AlertDialogHeaderComponent>
            <AlertDialogTitleComponent>Confirmar Acción</AlertDialogTitleComponent>
            <AlertDialogDescription>
              ¿Estás seguro de que quieres cerrar todas las demás sesiones activas? Tu sesión actual permanecerá activa.
            </AlertDialogDescription>
          </AlertDialogHeaderComponent>
          <AlertDialogFooter>
            <AlertDialogCancel asChild>
              <Button variant="outline" onClick={() => setShowTerminateOtherSessionsConfirm(false)} disabled={isProcessingSessionAction}>
                Cancelar
              </Button>
            </AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button onClick={handleTerminateOtherSessions} disabled={isProcessingSessionAction} className="bg-destructive hover:bg-destructive/90">
                {isProcessingSessionAction ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Cerrar Otras Sesiones
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showImportConfirmModal} onOpenChange={setShowImportConfirmModal}>
        <AlertDialogContent>
          <AlertDialogHeaderComponent>
            <AlertDialogTitleComponent>¡ADVERTENCIA!</AlertDialogTitleComponent>
            <AlertDialogDescription>
              Estás a punto de reemplazar tus datos actuales de PixelSphere con el contenido del archivo seleccionado. Esta acción es irreversible y podría llevar a la pérdida de datos si el archivo es incorrecto o antiguo. Tus archivos multimedia no se verán afectados. ¿Estás seguro de que deseas continuar?
            </AlertDialogDescription>
          </AlertDialogHeaderComponent>
          <AlertDialogFooter>
            <AlertDialogCancel asChild>
              <Button variant="outline" onClick={() => {
                setShowImportConfirmModal(false);
                setSelectedImportFile(null);
                if (importFileInputRef.current) importFileInputRef.current.value = "";
              }} disabled={isImporting}>
                Cancelar
              </Button>
            </AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button onClick={handleConfirmImport} className="bg-destructive hover:bg-destructive/90" disabled={isImporting}>
                {isImporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Confirmar e Importar
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
