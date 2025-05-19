
"use server";

import fs from 'fs/promises';
import path from 'path';
import type { MediaItem, TrashItem } from '@/types';

const dataDir = path.join(process.cwd(), 'src', 'data');
const trashFilePath = path.join(dataDir, 'trash.json');
const galleryFilePath = path.join(dataDir, 'gallery.json');
const uploadsDir = path.join(process.cwd(), 'public', 'uploads');


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

const readTrash = () => readDataFile<TrashItem>(trashFilePath, []);
const writeTrash = (trash: TrashItem[]) => writeDataFile(trashFilePath, trash);
const readGallery = () => readDataFile<MediaItem>(galleryFilePath, []);
const writeGallery = (gallery: MediaItem[]) => writeDataFile(galleryFilePath, gallery);


export async function getTrashItems(userId?: string): Promise<TrashItem[]> {
  const items = await readTrash();
  const userItems = userId ? items.filter(item => item.ownerUserId === userId) : items;
  return userItems.sort((a, b) => new Date(b.deletionTimestamp).getTime() - new Date(a.deletionTimestamp).getTime());
}

// itemsToAdd must be full MediaItem objects including ownerUserId
export async function addItemsToTrash(itemsToAdd: MediaItem[]): Promise<boolean> {
  if (!itemsToAdd || itemsToAdd.length === 0) {
    return true;
  }
  try {
    const trash = await readTrash();
    const deletionTimestamp = new Date().toISOString();

    const newTrashItems: TrashItem[] = itemsToAdd.map(item => ({
      ...item, // This includes ownerUserId
      deletionTimestamp,
    }));

    const updatedTrash = [...newTrashItems, ...trash];
    updatedTrash.sort((a, b) => new Date(b.deletionTimestamp).getTime() - new Date(a.deletionTimestamp).getTime());

    await writeTrash(updatedTrash);
    return true;
  } catch (error) {
    console.error("Error adding items to trash:", error);
    return false;
  }
}

export async function restoreTrashItem(itemId: string, userId: string): Promise<boolean> {
  if (!userId) return false;
  try {
    let trash = await readTrash();
    const itemToRestore = trash.find(item => item.id === itemId && item.ownerUserId === userId);

    if (!itemToRestore) return false;

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { deletionTimestamp, ...originalItem } = itemToRestore; // originalItem still has ownerUserId

    const gallery = await readGallery();
    // Add the item (which includes ownerUserId) back to the gallery
    gallery.unshift(originalItem as MediaItem); 
    gallery.sort((a, b) => new Date(b.uploadTimestamp).getTime() - new Date(a.uploadTimestamp).getTime());
    await writeGallery(gallery);

    trash = trash.filter(item => !(item.id === itemId && item.ownerUserId === userId));
    await writeTrash(trash);

    return true;
  } catch (error) {
    console.error("Error restoring trash item:", error);
    return false;
  }
}

async function deleteFileFromServer(relativeFilePath?: string): Promise<boolean> {
  if (!relativeFilePath) return false;
  if (relativeFilePath.includes('..')) {
    console.error(`Attempt to access path outside uploads directory: ${relativeFilePath}`);
    return false;
  }
  const actualFilePath = path.join(uploadsDir, path.basename(relativeFilePath));
  try {
    await fs.unlink(actualFilePath);
    console.log(`Successfully deleted file: ${actualFilePath}`);
    return true;
  } catch (fileError) {
    const nodeError = fileError as NodeJS.ErrnoException;
    if (nodeError.code === 'ENOENT') {
      console.warn(`File not found for deletion, proceeding: ${actualFilePath}`);
      return true; 
    }
    console.error(`Error deleting file ${actualFilePath}:`, fileError);
    return false;
  }
}

export async function permanentlyDeleteMultipleTrashItems(itemIds: string[], userId: string): Promise<{ success: boolean; deletedCount: number; error?: string }> {
  if (!itemIds || itemIds.length === 0 || !userId) {
    return { success: true, deletedCount: 0 };
  }

  let currentTrash = await readTrash();
  let deletedCount = 0;
  const itemsToKeep: TrashItem[] = [];
  const errors: string[] = [];

  for (const item of currentTrash) {
    if (itemIds.includes(item.id) && item.ownerUserId === userId) {
      const fileDeleted = await deleteFileFromServer(item.filePath);
      if (fileDeleted) {
        deletedCount++;
      } else {
        // Item metadata will still be removed if it belongs to the user and is selected.
        errors.push(`Failed to delete file for item ${item.originalFilename} (ID: ${item.id}).`);
      }
    } else {
      itemsToKeep.push(item);
    }
  }
  
  // Ensure we only write back items that weren't selected for deletion OR didn't belong to the user
  const finalItemsToKeep = currentTrash.filter(item => 
    !(itemIds.includes(item.id) && item.ownerUserId === userId)
  );

  await writeTrash(finalItemsToKeep);

  if (errors.length > 0 && deletedCount < itemIds.length) { // Check if some files failed but metadata was removed
    return { success: false, deletedCount, error: `Algunos archivos no pudieron ser eliminados del servidor, pero sus metadatos sí. Errores: ${errors.join('; ')}` };
  }
  if (deletedCount < itemIds.length && errors.length === 0) { // This case shouldn't happen if IDs are correct
     return { success: false, deletedCount, error: "No todos los ítems seleccionados fueron encontrados o pertenecían al usuario."}
  }


  return { success: true, deletedCount };
}


export async function autoDeleteOldTrashItems(userId?: string): Promise<void> { 
  try {
    let trash = await readTrash();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const itemsToPermanentlyDelete: TrashItem[] = [];
    let remainingItems: TrashItem[] = [];

    trash.forEach(item => {
      // Only consider auto-deleting items owned by the current user if userId is provided
      const shouldConsider = userId ? item.ownerUserId === userId : true; 
      if (shouldConsider && new Date(item.deletionTimestamp) <= thirtyDaysAgo) {
        itemsToPermanentlyDelete.push(item);
      } else {
        remainingItems.push(item);
      }
    });
    
    // If userId was provided, filter out items not belonging to this user for final write
    if (userId) {
        remainingItems = remainingItems.filter(item => item.ownerUserId === userId || new Date(item.deletionTimestamp) > thirtyDaysAgo);
    }


    if (itemsToPermanentlyDelete.length === 0) {
      console.log("No old trash items found for auto-deletion for the specified scope.");
      return;
    }

    for (const item of itemsToPermanentlyDelete) {
      await deleteFileFromServer(item.filePath);
    }

    await writeTrash(remainingItems);
    if (itemsToPermanentlyDelete.length > 0) {
      console.log(`Auto-deleted ${itemsToPermanentlyDelete.length} old items from trash (files and metadata) for the specified scope.`);
    }
  } catch (error) {
    console.error("Error auto-deleting old trash items:", error);
  }
}

