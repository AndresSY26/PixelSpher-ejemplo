
"use client";

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { Loader2, Link as LinkIcon, Copy, Trash2, Share2Icon, Image as ImageIcon, Film, UserPlus, ListChecks, Search, XCircle, BadgeCheck } from 'lucide-react';
import type { MediaItem, SharedLink, UserSpecificShare, User } from '@/types';
import { getGalleryItems } from '@/app/actions/galleryActions';
import { getUsersForSharing } from '@/app/actions/authActions';
import { 
  createShareLink, 
  getSharedLinksForUser, 
  revokeShareLink,
  shareItemWithSpecificUser,
  getSharesInitiatedByUser,
  revokeDirectShare
} from '@/app/actions/shareActions';
import Image from 'next/image';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';

interface MySharedLink extends SharedLink {
  itemDetails?: MediaItem; 
}

interface MyDirectShare extends UserSpecificShare {
  itemDetails?: MediaItem;
  targetUserDetails?: Pick<User, 'id' | 'name' | 'username' | 'avatarLetter'>;
}

export default function SharePage() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [userGalleryItems, setUserGalleryItems] = useState<MediaItem[]>([]);
  const [isLoadingGallery, setIsLoadingGallery] = useState(false);
  
  // For Public Links
  const [selectedItemIdForPublicShare, setSelectedItemIdForPublicShare] = useState<string | undefined>(undefined);
  const [isCreatingPublicLink, setIsCreatingPublicLink] = useState(false);
  const [newlyGeneratedPublicLink, setNewlyGeneratedPublicLink] = useState<string | null>(null);
  const [publicSharedItemPreview, setPublicSharedItemPreview] = useState<MediaItem | null>(null);
  const [myPublicSharedLinks, setMyPublicSharedLinks] = useState<MySharedLink[]>([]);
  const [isLoadingMyPublicLinks, setIsLoadingMyPublicLinks] = useState(false);
  const [isRevokingPublicLink, setIsRevokingPublicLink] = useState<string | null>(null);

  // For User-Specific Shares
  const [availableUsersForSharing, setAvailableUsersForSharing] = useState<Pick<User, 'id' | 'name' | 'username' | 'avatarLetter'>[]>([]);
  const [selectedItemIdForDirectShare, setSelectedItemIdForDirectShare] = useState<string | undefined>(undefined);
  
  const [targetUserSearchTerm, setTargetUserSearchTerm] = useState('');
  const [targetUserSearchResults, setTargetUserSearchResults] = useState<Pick<User, 'id' | 'name' | 'username' | 'avatarLetter'>[]>([]);
  const [selectedTargetUsersList, setSelectedTargetUsersList] = useState<Pick<User, 'id' | 'name' | 'username' | 'avatarLetter'>[]>([]);


  const [directShareMessage, setDirectShareMessage] = useState('');
  const [isCreatingDirectShare, setIsCreatingDirectShare] = useState(false);
  const [myDirectShares, setMyDirectShares] = useState<MyDirectShare[]>([]);
  const [isLoadingMyDirectShares, setIsLoadingMyDirectShares] = useState(false);
  const [isRevokingDirectShare, setIsRevokingDirectShare] = useState<string | null>(null);


  const fetchUserGalleryAndUsers = useCallback(async () => {
    if (!user) return;
    setIsLoadingGallery(true);
    try {
      const [items, usersToShareWith] = await Promise.all([
        getGalleryItems(user.id),
        getUsersForSharing(user.id) 
      ]);
      setUserGalleryItems(items);
      setAvailableUsersForSharing(usersToShareWith as Pick<User, 'id' | 'name' | 'username' | 'avatarLetter'>[]);
    } catch (error) {
      toast({ title: "Error", description: "No se pudieron cargar tus ítems o la lista de usuarios.", variant: "destructive" });
    } finally {
      setIsLoadingGallery(false);
    }
  }, [user, toast]);

  const fetchMySharedLinks = useCallback(async () => {
    if (!user) return;
    setIsLoadingMyPublicLinks(true);
    try {
      const links = await getSharedLinksForUser(user.id);
      const galleryItems = await getGalleryItems(user.id); 
      const populatedLinks = links.map(link => ({
        ...link,
        itemDetails: galleryItems.find(item => item.id === link.itemId)
      }));
      setMyPublicSharedLinks(populatedLinks);
    } catch (error) {
      toast({ title: "Error", description: "No se pudieron cargar tus enlaces públicos compartidos.", variant: "destructive" });
    } finally {
      setIsLoadingMyPublicLinks(false);
    }
  }, [user, toast]);
  
  const fetchMyDirectShares = useCallback(async () => {
    if (!user) return;
    setIsLoadingMyDirectShares(true);
    try {
      const directShares = await getSharesInitiatedByUser(user.id);
      const [galleryItems, allOtherUsers] = await Promise.all([
          getGalleryItems(user.id), 
          getUsersForSharing(user.id) 
      ]);

      const usersMap = new Map<string, Pick<User, 'id' | 'name' | 'username' | 'avatarLetter'>>();
      allOtherUsers.forEach(u => usersMap.set(u.id, u as Pick<User, 'id' | 'name' | 'username' | 'avatarLetter'>));


      const populatedDirectShares = directShares.map(share => ({
        ...share,
        itemDetails: galleryItems.find(item => item.id === share.itemId),
        targetUserDetails: usersMap.get(share.targetUserId)
      }));
      setMyDirectShares(populatedDirectShares);

    } catch (error) {
      console.error("Error fetching direct shares:", error);
      toast({ title: "Error", description: "No se pudieron cargar tus comparticiones directas.", variant: "destructive" });
    } finally {
      setIsLoadingMyDirectShares(false);
    }
  }, [user, toast]);


  useEffect(() => {
    fetchUserGalleryAndUsers();
    fetchMySharedLinks();
    fetchMyDirectShares();
  }, [fetchUserGalleryAndUsers, fetchMySharedLinks, fetchMyDirectShares]);

  useEffect(() => {
    if (targetUserSearchTerm.length >= 2 && availableUsersForSharing.length > 0) {
        const lowercasedTerm = targetUserSearchTerm.toLowerCase();
        const results = availableUsersForSharing.filter(u =>
            (u.name.toLowerCase().includes(lowercasedTerm) ||
            u.username.toLowerCase().includes(lowercasedTerm)) &&
            !selectedTargetUsersList.some(selectedUser => selectedUser.id === u.id) // Exclude already selected users
        );
        setTargetUserSearchResults(results);
    } else {
        setTargetUserSearchResults([]);
    }
  }, [targetUserSearchTerm, availableUsersForSharing, selectedTargetUsersList]);


  const handleGeneratePublicLink = async () => {
    if (!user || !selectedItemIdForPublicShare) {
      toast({ title: "Error", description: "Por favor, selecciona un ítem para compartir.", variant: "destructive" });
      return;
    }
    setIsCreatingPublicLink(true);
    setNewlyGeneratedPublicLink(null);
    setPublicSharedItemPreview(null);
    try {
      const result = await createShareLink(selectedItemIdForPublicShare, user.id);
      if (result.success && result.link) {
        const fullLink = `${window.location.origin}/view-share/${result.link.shareId}`;
        setNewlyGeneratedPublicLink(fullLink);
        setPublicSharedItemPreview(userGalleryItems.find(item => item.id === selectedItemIdForPublicShare) || null);
        toast({ title: "Enlace Público Generado", description: "El enlace para compartir ha sido creado." });
        fetchMySharedLinks(); 
        setSelectedItemIdForPublicShare(undefined); 
      } else {
        toast({ title: "Error al Generar Enlace Público", description: result.error || "No se pudo crear el enlace.", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error Inesperado", description: "Ocurrió un error al generar el enlace público.", variant: "destructive" });
    } finally {
      setIsCreatingPublicLink(false);
    }
  };

  const handleCopyLink = (link: string) => {
    navigator.clipboard.writeText(link)
      .then(() => toast({ title: "Enlace Copiado", description: "El enlace ha sido copiado al portapapeles." }))
      .catch(() => toast({ title: "Error al Copiar", description: "No se pudo copiar el enlace.", variant: "destructive" }));
  };

  const handleRevokePublicLink = async (shareId: string) => {
    if (!user) return;
    setIsRevokingPublicLink(shareId);
    try {
      const result = await revokeShareLink(shareId, user.id);
      if (result.success) {
        toast({ title: "Enlace Público Revocado", description: "El enlace compartido ha sido desactivado." });
        fetchMySharedLinks();
      } else {
        toast({ title: "Error al Revocar", description: result.error || "No se pudo revocar el enlace.", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error Inesperado", description: "Ocurrió un error al revocar el enlace.", variant: "destructive" });
    } finally {
      setIsRevokingPublicLink(null);
    }
  };

  const handleTargetUserSelect = (userToSelect: Pick<User, 'id' | 'name' | 'username' | 'avatarLetter'>) => {
    if (!selectedTargetUsersList.some(u => u.id === userToSelect.id)) {
      setSelectedTargetUsersList(prev => [...prev, userToSelect]);
    }
    setTargetUserSearchTerm('');
    setTargetUserSearchResults([]);
  };

  const handleRemoveTargetUser = (userIdToRemove: string) => {
    setSelectedTargetUsersList(prev => prev.filter(u => u.id !== userIdToRemove));
  };

  const handleShareWithUser = async () => {
    if (!user || !selectedItemIdForDirectShare || selectedTargetUsersList.length === 0) {
      toast({ title: "Error", description: "Por favor, selecciona un ítem y al menos un usuario.", variant: "destructive" });
      return;
    }
    setIsCreatingDirectShare(true);
    let successCount = 0;
    let errorCount = 0;
    let lastError = "";

    for (const targetUser of selectedTargetUsersList) {
      try {
        const result = await shareItemWithSpecificUser(user.id, selectedItemIdForDirectShare, targetUser.id, directShareMessage);
        if (result.success) {
          successCount++;
        } else {
          errorCount++;
          lastError = result.error || "No se pudo compartir el ítem con un usuario.";
        }
      } catch (error) {
        errorCount++;
        lastError = "Ocurrió un error inesperado al compartir con un usuario.";
      }
    }
    
    if (successCount > 0) {
      toast({ title: "Compartición Procesada", description: `${successCount} ítem(s) compartido(s) exitosamente.` });
      setSelectedItemIdForDirectShare(undefined);
      setSelectedTargetUsersList([]);
      setDirectShareMessage('');
      fetchMyDirectShares(); 
    }
    if (errorCount > 0) {
      toast({ title: "Error en Compartición", description: `${errorCount} compartición(es) fallaron. Último error: ${lastError}`, variant: "destructive", duration: 7000 });
    }

    setIsCreatingDirectShare(false);
  };

  const handleRevokeDirectShare = async (shareInstanceId: string) => {
    if (!user) return;
    setIsRevokingDirectShare(shareInstanceId);
    try {
      const result = await revokeDirectShare(shareInstanceId, user.id);
      if (result.success) {
        toast({ title: "Compartición Revocada", description: "La compartición directa ha sido revocada." });
        fetchMyDirectShares();
      } else {
        toast({ title: "Error al Revocar", description: result.error || "No se pudo revocar la compartición.", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error Inesperado", description: "Ocurrió un error al revocar la compartición.", variant: "destructive" });
    } finally {
      setIsRevokingDirectShare(null);
    }
  };
  
  if (!user) {
    return <p className="text-center py-10">Debes iniciar sesión para acceder a esta página.</p>;
  }

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-bold flex items-center gap-2"><LinkIcon className="h-6 w-6 text-primary"/>Crear Enlace Público</CardTitle>
          <CardDescription>Selecciona un archivo de tu galería para generar un enlace único y compartirlo públicamente.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoadingGallery ? (
            <div className="flex items-center justify-center h-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : userGalleryItems.length === 0 ? (
            <p className="text-muted-foreground">No tienes ítems en tu galería para compartir.</p>
          ) : (
            <div className="flex flex-col sm:flex-row items-end gap-3">
              <div className="flex-grow w-full sm:w-auto">
                <label htmlFor="item-select-public" className="block text-sm font-medium text-muted-foreground mb-1">Seleccionar Ítem:</label>
                <Select value={selectedItemIdForPublicShare} onValueChange={setSelectedItemIdForPublicShare}>
                  <SelectTrigger id="item-select-public" className="w-full">
                    <SelectValue placeholder="Elige un ítem..." />
                  </SelectTrigger>
                  <SelectContent>
                    {userGalleryItems.map(item => (
                      <SelectItem key={item.id} value={item.id}>
                        <div className="flex items-center gap-2">
                          {item.type === 'image' ? <ImageIcon className="h-4 w-4 text-muted-foreground" /> : <Film className="h-4 w-4 text-muted-foreground" />}
                          <span>{item.originalFilename}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleGeneratePublicLink} disabled={!selectedItemIdForPublicShare || isCreatingPublicLink} className="w-full sm:w-auto">
                {isCreatingPublicLink ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LinkIcon className="mr-2 h-4 w-4" />}
                Generar Enlace
              </Button>
            </div>
          )}

          {newlyGeneratedPublicLink && publicSharedItemPreview && (
            <Card className="mt-6 bg-muted/50 p-4">
              <CardDescription className="mb-2 text-sm">¡Enlace público generado con éxito!</CardDescription>
              <div className="flex items-center gap-3 mb-3">
                {publicSharedItemPreview.type === 'image' ? (
                  <Image src={publicSharedItemPreview.filePath} alt={publicSharedItemPreview.originalFilename} width={60} height={60} className="rounded object-cover aspect-square" data-ai-hint="shared media"/>
                ) : (
                  <div className="w-[60px] h-[60px] bg-slate-700 rounded flex items-center justify-center">
                    <Film className="h-8 w-8 text-slate-300"/>
                  </div>
                )}
                <div>
                  <p className="font-semibold text-sm">{publicSharedItemPreview.originalFilename}</p>
                  <p className="text-xs text-muted-foreground">Tipo: {publicSharedItemPreview.type === 'image' ? 'Imagen' : 'Video'}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Input type="text" readOnly value={newlyGeneratedPublicLink} className="bg-background text-sm" />
                <Button variant="outline" size="sm" onClick={() => handleCopyLink(newlyGeneratedPublicLink)}><Copy className="mr-2 h-3 w-3"/>Copiar</Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">Este enlace permite a cualquiera con acceso ver el archivo. Puedes revocarlo abajo.</p>
            </Card>
          )}
        </CardContent>
      </Card>

      <Separator />

       <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-bold flex items-center gap-2"><UserPlus className="h-6 w-6 text-primary"/>Compartir con Usuario(s) Específico(s)</CardTitle>
          <CardDescription>Selecciona un ítem y uno o más usuarios registrados para compartirlo directamente.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoadingGallery ? (
             <div className="flex items-center justify-center h-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : userGalleryItems.length === 0 ? (
            <p className="text-muted-foreground">No tienes ítems en tu galería para compartir.</p>
          ) : availableUsersForSharing.length === 0 ? (
             <p className="text-muted-foreground">No hay otros usuarios registrados con quien compartir.</p>
          ) : (
            <div className="space-y-3">
              <div>
                <label htmlFor="item-select-direct" className="block text-sm font-medium text-muted-foreground mb-1">Seleccionar Ítem a Compartir:</label>
                <Select value={selectedItemIdForDirectShare} onValueChange={setSelectedItemIdForDirectShare}>
                  <SelectTrigger id="item-select-direct"><SelectValue placeholder="Elige un ítem..." /></SelectTrigger>
                  <SelectContent>
                    {userGalleryItems.map(item => (
                      <SelectItem key={item.id} value={item.id}>
                        <div className="flex items-center gap-2">
                          {item.type === 'image' ? <ImageIcon className="h-4 w-4 text-muted-foreground" /> : <Film className="h-4 w-4 text-muted-foreground" />}
                          <span>{item.originalFilename}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="relative">
                <label htmlFor="user-search-direct" className="block text-sm font-medium text-muted-foreground mb-1">Buscar Usuario (Nombre o Username):</label>
                <div className="flex items-center">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground peer-focus:text-primary" style={{marginTop: '0.125rem'}}/> {/* Adjusted margin */}
                    <Input 
                        id="user-search-direct" 
                        type="text" 
                        placeholder="Escribe para buscar..."
                        value={targetUserSearchTerm}
                        onChange={(e) => setTargetUserSearchTerm(e.target.value)}
                        className="pl-10 peer"
                    />
                     {targetUserSearchTerm && (
                        <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7" style={{marginTop: '0.125rem'}} onClick={() => {setTargetUserSearchTerm(''); setTargetUserSearchResults([]);}}>
                            <XCircle className="h-4 w-4"/>
                        </Button>
                    )}
                </div>
                {targetUserSearchResults.length > 0 && (
                    <Card className="absolute z-10 w-full mt-1 max-h-48 overflow-y-auto shadow-lg border">
                        <CardContent className="p-2">
                            {targetUserSearchResults.map(u => (
                                <div 
                                    key={u.id} 
                                    className="p-2 hover:bg-accent rounded-md cursor-pointer text-sm flex items-center gap-2"
                                    onClick={() => handleTargetUserSelect(u)}
                                >
                                    <Avatar className="h-6 w-6 text-xs">
                                        <AvatarFallback className="bg-muted-foreground/20 text-muted-foreground">
                                            {u.avatarLetter || u.name.charAt(0).toUpperCase()}
                                        </AvatarFallback>
                                    </Avatar>
                                    <span>{u.name} <span className="text-muted-foreground">({u.username})</span></span>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                )}
                {targetUserSearchTerm.length >=2 && targetUserSearchResults.length === 0 && (
                    <p className="text-xs text-muted-foreground mt-1">No se encontraron usuarios.</p>
                )}
              </div>

              {selectedTargetUsersList.length > 0 && (
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-muted-foreground">Usuarios seleccionados para compartir:</label>
                  <div className="flex flex-wrap gap-2 p-2 border rounded-md bg-muted/50">
                    {selectedTargetUsersList.map(stUser => (
                      <Badge key={stUser.id} variant="secondary" className="flex items-center gap-1.5 pr-1">
                        <Avatar className="h-5 w-5 text-xs mr-1">
                          <AvatarFallback className="bg-primary/20 text-primary font-semibold">
                            {stUser.avatarLetter || stUser.name.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        {stUser.name} ({stUser.username})
                        <button
                          type="button"
                          onClick={() => handleRemoveTargetUser(stUser.id)}
                          className="ml-1 rounded-full hover:bg-destructive/20 p-0.5"
                          aria-label={`Quitar a ${stUser.name}`}
                        >
                          <XCircle className="h-3.5 w-3.5 text-destructive" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <div>
                 <label htmlFor="direct-share-message" className="block text-sm font-medium text-muted-foreground mb-1">Mensaje (Opcional):</label>
                 <Textarea id="direct-share-message" value={directShareMessage} onChange={(e) => setDirectShareMessage(e.target.value)} placeholder="Escribe un mensaje corto..." maxLength={100} />
              </div>
              <Button 
                onClick={handleShareWithUser} 
                disabled={!selectedItemIdForDirectShare || selectedTargetUsersList.length === 0 || isCreatingDirectShare}
              >
                {isCreatingDirectShare ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Share2Icon className="mr-2 h-4 w-4" />}
                Compartir con Usuario(s) ({selectedTargetUsersList.length})
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Separator />

      <Card>
        <CardHeader>
          <CardTitle className="text-xl font-bold flex items-center gap-2"><ListChecks className="h-5 w-5 text-primary"/>Mis Enlaces Públicos Activos</CardTitle>
          <CardDescription>Administra los enlaces públicos activos que has creado.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingMyPublicLinks ? (
            <div className="flex items-center justify-center h-32"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>
          ) : myPublicSharedLinks.length === 0 ? (
            <p className="text-muted-foreground text-center py-6">No tienes enlaces públicos compartidos activos.</p>
          ) : (
            <div className="space-y-4">
              {myPublicSharedLinks.map(link => (
                <Card key={link.shareId} className="p-4">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                    {link.itemDetails?.type === 'image' && link.itemDetails.filePath ? (
                      <Image src={link.itemDetails.filePath} alt={link.itemDetails.originalFilename} width={80} height={80} className="rounded object-cover aspect-square" data-ai-hint="shared media"/>
                    ) : link.itemDetails?.type === 'video' ? (
                       <div className="w-[80px] h-[80px] bg-slate-700 rounded flex items-center justify-center shrink-0">
                         <Film className="h-10 w-10 text-slate-300"/>
                       </div>
                    ) : (
                      <div className="w-[80px] h-[80px] bg-muted rounded flex items-center justify-center shrink-0">
                         <ImageIcon className="h-10 w-10 text-muted-foreground"/>
                       </div>
                    )}
                    <div className="flex-grow space-y-1">
                      <p className="font-semibold">{link.itemDetails?.originalFilename || "Ítem Desconocido"}</p>
                      <p className="text-xs text-muted-foreground">
                        Creado: {format(new Date(link.creationTimestamp), "d MMM yyyy, HH:mm", { locale: es })}
                      </p>
                      <Input 
                        type="text" 
                        readOnly 
                        value={`${window.location.origin}/view-share/${link.shareId}`} 
                        className="text-xs h-8 bg-muted mt-1"
                      />
                    </div>
                    <div className="flex sm:flex-col gap-2 items-stretch sm:items-end mt-2 sm:mt-0 shrink-0">
                      <Button variant="outline" size="sm" onClick={() => handleCopyLink(`${window.location.origin}/view-share/${link.shareId}`)}>
                        <Copy className="mr-1.5 h-3.5 w-3.5"/>Copiar
                      </Button>
                      <Button 
                        variant="destructive" 
                        size="sm" 
                        onClick={() => handleRevokePublicLink(link.shareId)}
                        disabled={isRevokingPublicLink === link.shareId}
                      >
                        {isRevokingPublicLink === link.shareId ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin"/> : <Trash2 className="mr-1.5 h-3.5 w-3.5" />}
                        Revocar
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Separator />

      <Card>
        <CardHeader>
          <CardTitle className="text-xl font-bold flex items-center gap-2"><ListChecks className="h-5 w-5 text-primary"/>Mis Comparticiones Directas Activas</CardTitle>
          <CardDescription>Administra los ítems que has compartido directamente con otros usuarios.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingMyDirectShares ? (
            <div className="flex items-center justify-center h-32"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>
          ) : myDirectShares.length === 0 ? (
            <p className="text-muted-foreground text-center py-6">No has compartido ítems directamente con otros usuarios.</p>
          ) : (
            <div className="space-y-4">
              {myDirectShares.map(share => (
                <Card key={share.shareInstanceId} className="p-4">
                   <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                    {share.itemDetails?.type === 'image' && share.itemDetails.filePath ? (
                      <Image src={share.itemDetails.filePath} alt={share.itemDetails.originalFilename} width={80} height={80} className="rounded object-cover aspect-square" data-ai-hint="shared media"/>
                    ) : share.itemDetails?.type === 'video' ? (
                       <div className="w-[80px] h-[80px] bg-slate-700 rounded flex items-center justify-center shrink-0">
                         <Film className="h-10 w-10 text-slate-300"/>
                       </div>
                    ) : (
                      <div className="w-[80px] h-[80px] bg-muted rounded flex items-center justify-center shrink-0">
                         <ImageIcon className="h-10 w-10 text-muted-foreground"/>
                       </div>
                    )}
                    <div className="flex-grow space-y-1">
                      <p className="font-semibold">{share.itemDetails?.originalFilename || "Ítem Desconocido"}</p>
                      <p className="text-sm text-muted-foreground">
                        Compartido con: <span className="font-medium text-foreground">{share.targetUserDetails?.name || share.targetUserDetails?.username || "Usuario Desconocido"}</span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Fecha: {format(new Date(share.shareTimestamp), "d MMM yyyy, HH:mm", { locale: es })}
                      </p>
                       {share.message && <p className="text-xs italic bg-muted/30 p-1 rounded">Mensaje: "{share.message}"</p>}
                    </div>
                    <Button 
                        variant="destructive" 
                        size="sm" 
                        onClick={() => handleRevokeDirectShare(share.shareInstanceId)}
                        disabled={isRevokingDirectShare === share.shareInstanceId}
                        className="mt-2 sm:mt-0 shrink-0 self-start sm:self-center"
                      >
                        {isRevokingDirectShare === share.shareInstanceId ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin"/> : <Trash2 className="mr-1.5 h-3.5 w-3.5" />}
                        Revocar
                      </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  );
}
