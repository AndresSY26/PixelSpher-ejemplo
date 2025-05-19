
"use server";

import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import type { Album, MediaItem } from '@/types';
import { getGalleryItems } from './galleryActions';

const dataDir = path.join(process.cwd(), 'src', 'data');
const albumsFilePath = path.join(dataDir, 'albums.json');

async function readDataFile<T>(filePath: string, defaultContent: T[] = []): Promise<T[]> {
  try {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    const jsonData = await fs.readFile(filePath, 'utf-8');
    if (jsonData.trim() === "") {
        await fs.writeFile(filePath, JSON.stringify(defaultContent));
        return defaultContent;
    }
    return JSON.parse(jsonData) as T[];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      await fs.writeFile(filePath, JSON.stringify(defaultContent));
      return defaultContent;
    }
    console.error(`Error reading ${path.basename(filePath)}:`, error);
    throw new Error(`Could not read ${path.basename(filePath)} data.`);
  }
}

async function writeDataFile<T>(filePath: string, data: T[]): Promise<void> {
  try {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error) {
    console.error(`Error writing ${path.basename(filePath)}:`, error);
    throw new Error(`Could not save ${path.basename(filePath)} data.`);
  }
}

const readAlbums = () => readDataFile<Album>(albumsFilePath, []);
const writeAlbums = (albums: Album[]) => writeDataFile(albumsFilePath, albums);


export async function getAlbums(userId: string): Promise<Album[]> {
  if (!userId) return [];
  const albums = await readAlbums();
  return albums.filter(album => album.ownerUserId === userId).sort((a, b) => a.name.localeCompare(b.name));
}

export async function createAlbum(name: string, userId: string): Promise<Album | { error: string }> {
  if (!userId) return { error: "User ID es requerido." };
  if (!name.trim()) return { error: "El nombre del álbum no puede estar vacío." };

  const albums = await readAlbums();
  if (albums.some(album => album.ownerUserId === userId && album.name.toLowerCase() === name.trim().toLowerCase())) {
    return { error: "Ya existe un álbum con este nombre para este usuario." };
  }

  const newAlbum: Album = {
    id: uuidv4(),
    ownerUserId: userId,
    name: name.trim(),
    itemIds: [],
  };

  albums.push(newAlbum);
  await writeAlbums(albums);
  return newAlbum;
}

export async function addItemsToAlbum(albumId: string, itemIdsToAdd: string[], userId: string): Promise<{ success: boolean; addedCount: number; error?: string }> {
  if (!userId) return { success: false, addedCount: 0, error: "User ID es requerido." };
  if (!albumId || !itemIdsToAdd || itemIdsToAdd.length === 0) {
    return { success: false, addedCount: 0, error: "ID de álbum o IDs de ítems no proporcionados." };
  }

  const albums = await readAlbums();
  const albumIndex = albums.findIndex(album => album.id === albumId && album.ownerUserId === userId);

  if (albumIndex === -1) {
    return { success: false, addedCount: 0, error: "Álbum no encontrado o no pertenece al usuario." };
  }
  
  // Ensure items being added belong to the user
  const userGalleryItems = await getGalleryItems(userId);
  const userItemIdsSet = new Set(userGalleryItems.map(item => item.id));
  
  let addedCount = 0;
  itemIdsToAdd.forEach(itemId => {
    if (userItemIdsSet.has(itemId) && !albums[albumIndex].itemIds.includes(itemId)) {
      albums[albumIndex].itemIds.push(itemId);
      addedCount++;
    }
  });

  if (addedCount > 0) {
    await writeAlbums(albums);
  }

  return { success: true, addedCount };
}

export async function getAlbumById(albumId: string, userId: string): Promise<Album | null> {
  if (!userId) return null;
  const albums = await readAlbums();
  return albums.find(album => album.id === albumId && album.ownerUserId === userId) || null;
}

export async function getMediaItemsForAlbum(albumId: string, userId: string): Promise<{ album: Album | null; items: MediaItem[] }> {
  if (!userId) return { album: null, items: [] };
  const album = await getAlbumById(albumId, userId);
  if (!album) {
    return { album: null, items: [] };
  }

  if (album.itemIds.length === 0) {
    return { album, items: [] };
  }

  const userGalleryItems = await getGalleryItems(userId); // This already filters by userId

  const albumMediaItemsMap = new Map<string, MediaItem>();
  userGalleryItems.forEach(item => albumMediaItemsMap.set(item.id, item));

  const albumMediaItems = album.itemIds
    .map(id => albumMediaItemsMap.get(id))
    .filter((item): item is MediaItem => !!item); // Filter out undefined if an ID in album doesn't exist in user's gallery

  albumMediaItems.sort((a, b) => new Date(b.uploadTimestamp).getTime() - new Date(a.uploadTimestamp).getTime());

  return { album, items: albumMediaItems };
}

export async function removeAlbum(albumId: string, userId: string): Promise<{ success: boolean; error?: string }> {
  if (!userId) return { success: false, error: "User ID es requerido." };
  const albums = await readAlbums();
  const initialLength = albums.length;
  const updatedAlbums = albums.filter(album => !(album.id === albumId && album.ownerUserId === userId));

  if (initialLength === updatedAlbums.length) {
    return { success: false, error: "Álbum no encontrado o no pertenece al usuario." };
  }

  await writeAlbums(updatedAlbums);
  return { success: true };
}

export async function renameAlbum(albumId: string, newName: string, userId: string): Promise<{ success: boolean; error?: string; album?: Album }> {
  if (!userId) return { success: false, error: "User ID es requerido." };
  if (!newName.trim()) return { success: false, error: "El nombre del álbum no puede estar vacío." };

  const albums = await readAlbums();
  const albumIndex = albums.findIndex(album => album.id === albumId && album.ownerUserId === userId);

  if (albumIndex === -1) {
    return { success: false, error: "Álbum no encontrado o no pertenece al usuario." };
  }

  if (albums.some(album => album.ownerUserId === userId && album.id !== albumId && album.name.toLowerCase() === newName.trim().toLowerCase())) {
    return { success: false, error: "Ya existe otro álbum con este nombre para este usuario." };
  }

  albums[albumIndex].name = newName.trim();
  await writeAlbums(albums);
  return { success: true, album: albums[albumIndex] };
}

export async function removeItemFromAlbum(albumId: string, itemIdToRemove: string, userId: string): Promise<{ success: boolean; error?: string }> {
  if (!userId) return { success: false, error: "User ID es requerido." };
  const albums = await readAlbums();
  const albumIndex = albums.findIndex(album => album.id === albumId && album.ownerUserId === userId);

  if (albumIndex === -1) {
    return { success: false, error: "Álbum no encontrado o no pertenece al usuario." };
  }

  const initialItemCount = albums[albumIndex].itemIds.length;
  albums[albumIndex].itemIds = albums[albumIndex].itemIds.filter(id => id !== itemIdToRemove);

  if (albums[albumIndex].itemIds.length === initialItemCount) {
    return { success: false, error: "Ítem no encontrado en este álbum." };
  }

  await writeAlbums(albums);
  return { success: true };
}

