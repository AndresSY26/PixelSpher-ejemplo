
"use server";

import fs from 'fs/promises';
import path from 'path';
import type { MediaItem } from '@/types';
import { addItemsToTrash } from './trashActions';

const dataDir = path.join(process.cwd(), 'src', 'data');
const galleryFilePath = path.join(dataDir, 'gallery.json');
const privateFolderFilePath = path.join(dataDir, 'private_folder.json');

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

const readGallery = () => readDataFile<MediaItem>(galleryFilePath, []);
const writeGallery = (gallery: MediaItem[]) => writeDataFile(galleryFilePath, gallery);

const readPrivateFolderItems = () => readDataFile<MediaItem>(privateFolderFilePath, []);
const writePrivateFolderItems = (items: MediaItem[]) => writeDataFile(privateFolderFilePath, items);

export async function getGalleryItems(userId?: string): Promise<MediaItem[]> {
  const items = await readGallery();
  const userItems = userId ? items.filter(item => item.ownerUserId === userId) : items;
  // Sorting is handled by the client/calling function based on user preferences
  return userItems;
}


export async function deleteGalleryItem(itemId: string, userId: string): Promise<boolean> {
  try {
    let gallery = await readGallery();
    const itemToDelete = gallery.find(item => item.id === itemId && item.ownerUserId === userId);
    if (!itemToDelete) return false;

    if (itemToDelete.filePath) {
      try {
        const actualFilePath = path.join(process.cwd(), 'public', itemToDelete.filePath);
        await fs.unlink(actualFilePath);
        console.log(`Successfully deleted file: ${actualFilePath}`);
      } catch (fileError) {
        console.error(`Error deleting file ${itemToDelete.filePath}:`, fileError);
      }
    }

    gallery = gallery.filter(item => !(item.id === itemId && item.ownerUserId === userId));
    await writeGallery(gallery);
    return true;
  } catch (error) {
    console.error("Error deleting gallery item:", error);
    return false;
  }
}

export async function deleteGalleryItemsAndMoveToTrash(itemIds: string[], userId: string): Promise<{ success: boolean; movedCount: number; error?: string }> {
  if (!itemIds || itemIds.length === 0 || !userId) {
    return { success: true, movedCount: 0 };
  }

  try {
    const gallery = await readGallery();
    const itemsToMove: MediaItem[] = [];
    const remainingGalleryItems: MediaItem[] = [];

    gallery.forEach(item => {
      if (itemIds.includes(item.id) && item.ownerUserId === userId) {
        itemsToMove.push(item);
      } else {
        remainingGalleryItems.push(item);
      }
    });

    if (itemsToMove.length === 0) {
      return { success: true, movedCount: 0, error: "No items found for this user in gallery matching the provided IDs." };
    }

    await writeGallery(remainingGalleryItems);
    const trashSuccess = await addItemsToTrash(itemsToMove); // addItemsToTrash expects full MediaItem objects

    if (!trashSuccess) {
      console.error("Critical error: Items removed from gallery but failed to be added to trash.json.");
      return {
        success: false,
        movedCount: 0,
        error: "Los ítems fueron eliminados de la galería pero ocurrió un error al moverlos a la papelera."
      };
    }
    return { success: true, movedCount: itemsToMove.length };
  } catch (error) {
    console.error("Error in deleteGalleryItemsAndMoveToTrash:", error);
    const errorMessage = error instanceof Error ? error.message : "Un error desconocido ocurrió.";
    return { success: false, movedCount: 0, error: `Error procesando la eliminación: ${errorMessage}` };
  }
}

export async function moveItemsToPrivateFolder(itemIds: string[], userId: string): Promise<{ success: boolean; movedCount: number; error?: string }> {
  if (!itemIds || itemIds.length === 0 || !userId) {
    return { success: true, movedCount: 0 };
  }

  try {
    const gallery = await readGallery();
    let privateFolderItems = await readPrivateFolderItems();

    const itemsToMove: MediaItem[] = [];
    const remainingGalleryItems: MediaItem[] = [];

    gallery.forEach(item => {
      if (itemIds.includes(item.id) && item.ownerUserId === userId) {
        itemsToMove.push(item);
      } else {
        remainingGalleryItems.push(item);
      }
    });

    if (itemsToMove.length === 0) {
      return { success: true, movedCount: 0, error: "No items found for this user in gallery matching the provided IDs." };
    }
    
    // Filter out items that might already be in the private folder (by ID and owner) to prevent duplicates
    const newItemsForPrivateFolder = itemsToMove.filter(itemToMove => 
      !privateFolderItems.some(pfItem => pfItem.id === itemToMove.id && pfItem.ownerUserId === itemToMove.ownerUserId)
    );

    if (newItemsForPrivateFolder.length > 0) {
      privateFolderItems = [...newItemsForPrivateFolder, ...privateFolderItems];
      privateFolderItems.sort((a, b) => new Date(b.uploadTimestamp).getTime() - new Date(a.uploadTimestamp).getTime());
      await writePrivateFolderItems(privateFolderItems);
    }
    
    await writeGallery(remainingGalleryItems);

    return { success: true, movedCount: itemsToMove.length }; // Report based on items intended to move, even if some were already private
  } catch (error) {
    console.error("Error in moveItemsToPrivateFolder:", error);
    const errorMessage = error instanceof Error ? error.message : "Un error desconocido ocurrió.";
    return { success: false, movedCount: 0, error: `Error procesando el movimiento a carpeta privada: ${errorMessage}` };
  }
}

