
"use server";

import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import type { SharedLink, MediaItem, UserSpecificShare, User } from '@/types';
import { getGalleryItems } from './galleryActions'; 
import { getUsersForSharing } from './authActions'; // Assuming this function exists

const dataDir = path.join(process.cwd(), 'src', 'data');
const sharedLinksFilePath = path.join(dataDir, 'shared_links.json');
const userSpecificSharesFilePath = path.join(dataDir, 'user_specific_shares.json');

async function readSharedLinks(): Promise<SharedLink[]> {
  try {
    await fs.mkdir(path.dirname(sharedLinksFilePath), { recursive: true });
    const jsonData = await fs.readFile(sharedLinksFilePath, 'utf-8');
    if (jsonData.trim() === "") {
      await fs.writeFile(sharedLinksFilePath, JSON.stringify([]));
      return [];
    }
    return JSON.parse(jsonData) as SharedLink[];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      await fs.writeFile(sharedLinksFilePath, JSON.stringify([]));
      return [];
    }
    console.error('Error reading shared_links.json:', error);
    throw new Error('Could not read shared links data.');
  }
}

async function writeSharedLinks(links: SharedLink[]): Promise<void> {
  try {
    await fs.mkdir(path.dirname(sharedLinksFilePath), { recursive: true });
    await fs.writeFile(sharedLinksFilePath, JSON.stringify(links, null, 2), 'utf-8');
  } catch (error) {
    console.error('Error writing shared_links.json:', error);
    throw new Error('Could not save shared links data.');
  }
}

async function readUserSpecificShares(): Promise<UserSpecificShare[]> {
  try {
    await fs.mkdir(path.dirname(userSpecificSharesFilePath), { recursive: true });
    const jsonData = await fs.readFile(userSpecificSharesFilePath, 'utf-8');
    if (jsonData.trim() === "") {
      await fs.writeFile(userSpecificSharesFilePath, JSON.stringify([]));
      return [];
    }
    return JSON.parse(jsonData) as UserSpecificShare[];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      await fs.writeFile(userSpecificSharesFilePath, JSON.stringify([]));
      return [];
    }
    console.error('Error reading user_specific_shares.json:', error);
    throw new Error('Could not read user-specific shares data.');
  }
}

async function writeUserSpecificShares(shares: UserSpecificShare[]): Promise<void> {
  try {
    await fs.mkdir(path.dirname(userSpecificSharesFilePath), { recursive: true });
    await fs.writeFile(userSpecificSharesFilePath, JSON.stringify(shares, null, 2), 'utf-8');
  } catch (error) {
    console.error('Error writing user_specific_shares.json:', error);
    throw new Error('Could not save user-specific shares data.');
  }
}


export async function createShareLink(itemId: string, ownerUserId: string): Promise<{ success: boolean; link?: SharedLink; error?: string }> {
  if (!itemId || !ownerUserId) {
    return { success: false, error: "Item ID y User ID son requeridos." };
  }

  try {
    const userGallery = await getGalleryItems(ownerUserId);
    if (!userGallery.find(item => item.id === itemId)) {
      return { success: false, error: "El ítem seleccionado no pertenece al usuario o no existe." };
    }

    const links = await readSharedLinks();
    const newShareId = uuidv4() + '-' + Math.random().toString(36).substring(2, 10);

    const newLink: SharedLink = {
      shareId: newShareId,
      ownerUserId,
      itemId,
      creationTimestamp: new Date().toISOString(),
      isActive: true,
    };

    links.push(newLink);
    await writeSharedLinks(links);
    return { success: true, link: newLink };
  } catch (error) {
    console.error("Error creating share link:", error);
    return { success: false, error: "No se pudo crear el enlace para compartir." };
  }
}

export async function getSharedLinksForUser(ownerUserId: string): Promise<SharedLink[]> {
  if (!ownerUserId) return [];
  const links = await readSharedLinks();
  return links.filter(link => link.ownerUserId === ownerUserId && link.isActive)
              .sort((a,b) => new Date(b.creationTimestamp).getTime() - new Date(a.creationTimestamp).getTime());
}

export async function revokeShareLink(shareId: string, ownerUserId: string): Promise<{ success: boolean; error?: string }> {
  if (!shareId || !ownerUserId) {
    return { success: false, error: "Share ID y User ID son requeridos." };
  }
  try {
    const links = await readSharedLinks();
    const linkIndex = links.findIndex(link => link.shareId === shareId && link.ownerUserId === ownerUserId);

    if (linkIndex === -1) {
      return { success: false, error: "Enlace no encontrado o no pertenece al usuario." };
    }

    links[linkIndex].isActive = false;
    await writeSharedLinks(links);
    return { success: true };
  } catch (error) {
    console.error("Error revoking share link:", error);
    return { success: false, error: "No se pudo revocar el enlace." };
  }
}

export async function getSharedItemDetails(shareId: string): Promise<{ link?: SharedLink; item?: MediaItem; error?: string }> {
  if (!shareId) return { error: "Share ID es requerido." };
  try {
    const links = await readSharedLinks();
    const link = links.find(l => l.shareId === shareId);

    if (!link || !link.isActive) {
      return { error: "Enlace no válido o ha sido revocado." };
    }

    const gallery = await getGalleryItems(link.ownerUserId); 
    const item = gallery.find(i => i.id === link.itemId);

    if (!item) {
      await revokeShareLink(shareId, link.ownerUserId); 
      return { error: "El ítem compartido ya no está disponible." };
    }
    
    if (item.ownerUserId !== link.ownerUserId) {
        console.warn(`Mismatch ownerUserId for shareId ${shareId}. Item owner: ${item.ownerUserId}, Link owner: ${link.ownerUserId}`);
        return { error: "Error de inconsistencia de datos." };
    }

    return { link, item };
  } catch (error) {
    console.error("Error getting shared item details:", error);
    return { error: "No se pudo obtener la información del enlace compartido." };
  }
}

// --- User Specific Shares ---

export async function shareItemWithSpecificUser(
  ownerUserId: string,
  itemId: string,
  targetUserId: string,
  message?: string
): Promise<{ success: boolean; share?: UserSpecificShare; error?: string }> {
  if (!ownerUserId || !itemId || !targetUserId) {
    return { success: false, error: "Owner ID, Item ID, y Target User ID son requeridos." };
  }
  if (ownerUserId === targetUserId) {
    return { success: false, error: "No puedes compartir un ítem contigo mismo." };
  }

  try {
    const userGallery = await getGalleryItems(ownerUserId);
    if (!userGallery.find(item => item.id === itemId)) {
      return { success: false, error: "El ítem seleccionado no pertenece al usuario o no existe." };
    }
    
    // Check if target user exists
    const allUsers = await getUsersForSharing(ownerUserId); // This fetches all users *except* current
    const targetUserExists = allUsers.some(user => user.id === targetUserId) || 
                             (await getUsersForSharing(targetUserId)).some(u => u.id === ownerUserId); // Bit hacky, better to have a generic getUserById

    if (!targetUserExists && targetUserId !== ownerUserId) { // Ensure target user is not the owner
        // A more direct getUserById would be better. For now, if targetUserId is not in the list of *other* users,
        // and is not the owner, then they don't exist or are the owner.
        const allUsersForTargetCheck = await getUsersForSharing("any_other_id_not_target"); // Get all users
        if (!allUsersForTargetCheck.find(u=> u.id === targetUserId)) {
             return { success: false, error: "El usuario destinatario no existe." };
        }
    }


    const shares = await readUserSpecificShares();
    // Optional: Check if already shared with this user
    const existingShare = shares.find(s => s.itemId === itemId && s.ownerUserId === ownerUserId && s.targetUserId === targetUserId && s.status === 'active');
    if (existingShare) {
      return { success: false, error: "Este ítem ya ha sido compartido con este usuario." };
    }

    const newShare: UserSpecificShare = {
      shareInstanceId: uuidv4(),
      ownerUserId,
      itemId,
      targetUserId,
      shareTimestamp: new Date().toISOString(),
      message: message?.trim() || undefined,
      status: 'active',
    };

    shares.push(newShare);
    await writeUserSpecificShares(shares);
    return { success: true, share: newShare };
  } catch (error) {
    console.error("Error sharing item with specific user:", error);
    return { success: false, error: "No se pudo compartir el ítem." };
  }
}

export async function getSharesForUser(currentUserId: string): Promise<UserSpecificShare[]> {
  if (!currentUserId) return [];
  const shares = await readUserSpecificShares();
  return shares.filter(share => share.targetUserId === currentUserId && share.status === 'active')
               .sort((a,b) => new Date(b.shareTimestamp).getTime() - new Date(a.shareTimestamp).getTime());
}

export async function getSharesInitiatedByUser(ownerUserId: string): Promise<UserSpecificShare[]> {
  if (!ownerUserId) return [];
  const shares = await readUserSpecificShares();
  return shares.filter(share => share.ownerUserId === ownerUserId && share.status === 'active')
               .sort((a,b) => new Date(b.shareTimestamp).getTime() - new Date(a.shareTimestamp).getTime());
}

export async function revokeDirectShare(shareInstanceId: string, currentUserId: string): Promise<{ success: boolean; error?: string }> {
  if (!shareInstanceId || !currentUserId) {
    return { success: false, error: "Share Instance ID y User ID son requeridos." };
  }
  try {
    const shares = await readUserSpecificShares();
    const shareIndex = shares.findIndex(share => share.shareInstanceId === shareInstanceId && share.ownerUserId === currentUserId);

    if (shareIndex === -1) {
      return { success: false, error: "Compartición no encontrada o no tienes permiso para revocarla." };
    }

    shares[shareIndex].status = 'revoked'; 
    // Alternatively, remove it: shares.splice(shareIndex, 1);
    await writeUserSpecificShares(shares);
    return { success: true };
  } catch (error) {
    console.error("Error revoking direct share:", error);
    return { success: false, error: "No se pudo revocar la compartición." };
  }
}

