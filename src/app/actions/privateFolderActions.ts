
"use server";

import fs from 'fs/promises';
import path from 'path';
import type { User, MediaItem, TrashItem } from '@/types';
import { addItemsToTrash } from './trashActions';
import {
  checkPrivatePasswordStatus as checkStatus,
  setPrivatePassword as setPass,
  verifyPrivatePassword as verifyPass
} from './settingsActions';


const dataDir = path.join(process.cwd(), 'src', 'data');
const privateFolderItemsPath = path.join(dataDir, 'private_folder.json');
const galleryFilePath = path.join(dataDir, 'gallery.json');


async function readDataFile<T>(filePath: string, defaultContent: T | T[] = []): Promise<T | T[]> {
  try {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    const jsonData = await fs.readFile(filePath, 'utf-8');
    if (jsonData.trim() === "") {
      const initialData = Array.isArray(defaultContent) ? [] : {};
      await fs.writeFile(filePath, JSON.stringify(initialData, null, 2));
      return initialData;
    }
    return JSON.parse(jsonData);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      const initialData = Array.isArray(defaultContent) ? [] : {};
      await fs.writeFile(filePath, JSON.stringify(initialData, null, 2));
      return initialData;
    }
    console.error(`Error reading ${path.basename(filePath)}:`, error);
    throw new Error(`Could not read ${path.basename(filePath)} data.`);
  }
}

async function writeDataFile<T>(filePath: string, data: T | T[]): Promise<void> {
  try {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error) {
    console.error(`Error writing ${path.basename(filePath)}:`, error);
    throw new Error(`Could not save ${path.basename(filePath)} data.`);
  }
}

const readPrivateFolder = () => readDataFile<MediaItem[]>(privateFolderItemsPath, []);
const writePrivateFolder = (items: MediaItem[]) => writeDataFile(privateFolderItemsPath, items);

const readGallery = () => readDataFile<MediaItem[]>(galleryFilePath, []);
const writeGallery = (items: MediaItem[]) => writeDataFile(galleryFilePath, items);

export const checkPrivatePasswordStatus = checkStatus;
export const setPrivatePassword = setPass;
export const verifyPrivatePassword = verifyPass;


export async function getPrivateFolderItems(userId: string): Promise<MediaItem[]> {
  if (!userId) {
    throw new Error("User ID is required to fetch private folder items.");
  }
  const allPrivateItems = await readPrivateFolder() as MediaItem[];
  const userPrivateItems = allPrivateItems.filter(item => item.ownerUserId === userId);
  return userPrivateItems.sort((a,b) => new Date(b.uploadTimestamp).getTime() - new Date(a.uploadTimestamp).getTime());
}


export async function moveItemsFromPrivateToGallery(itemIds: string[], userId: string): Promise<{ success: boolean; movedCount: number; error?: string }> {
  if (!userId) return { success: false, movedCount: 0, error: "User ID is required." };
  if (!itemIds || itemIds.length === 0) return { success: true, movedCount: 0 };

  try {
    let allPrivateItems = await readPrivateFolder() as MediaItem[];
    let galleryItems = await readGallery() as MediaItem[];

    const itemsToMove: MediaItem[] = [];
    const remainingPrivateItems: MediaItem[] = [];

    allPrivateItems.forEach(item => {
      if (itemIds.includes(item.id) && item.ownerUserId === userId) {
        itemsToMove.push(item);
      } else {
        remainingPrivateItems.push(item);
      }
    });

    if (itemsToMove.length === 0) {
      return { success: true, movedCount: 0, error: "No items found in this user's private folder matching provided IDs." };
    }

    // itemsToMove already include ownerUserId
    galleryItems = [...itemsToMove, ...galleryItems];
    galleryItems.sort((a, b) => new Date(b.uploadTimestamp).getTime() - new Date(a.uploadTimestamp).getTime());

    await writePrivateFolder(remainingPrivateItems);
    await writeGallery(galleryItems);

    return { success: true, movedCount: itemsToMove.length };

  } catch (error) {
    console.error("Error in moveItemsFromPrivateToGallery:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error.";
    return { success: false, movedCount: 0, error: `Error processing move to gallery: ${errorMessage}` };
  }
}

export async function moveItemsFromPrivateToTrash(itemIds: string[], userId: string): Promise<{ success: boolean; movedCount: number; error?: string }> {
  if (!userId) return { success: false, movedCount: 0, error: "User ID is required." };
  if (!itemIds || itemIds.length === 0) return { success: true, movedCount: 0 };

  try {
    let allPrivateItems = await readPrivateFolder() as MediaItem[];

    const itemsToMoveToTrash: MediaItem[] = [];
    const remainingPrivateItems: MediaItem[] = [];

    allPrivateItems.forEach(item => {
      if (itemIds.includes(item.id) && item.ownerUserId === userId) {
        itemsToMoveToTrash.push(item);
      } else {
        remainingPrivateItems.push(item);
      }
    });

    if (itemsToMoveToTrash.length === 0) {
      return { success: true, movedCount: 0, error: "No items found in this user's private folder for deletion." };
    }

    await writePrivateFolder(remainingPrivateItems);
    // addItemsToTrash expects MediaItem[] which includes ownerUserId
    const trashSuccess = await addItemsToTrash(itemsToMoveToTrash); // addItemsToTrash expects full MediaItem objects

    if (!trashSuccess) {
        console.error("Critical error: Items removed from private folder but failed to be added to trash.json.");
        return {
          success: false,
          movedCount: 0,
          error: "Los ítems fueron eliminados de la carpeta privada pero ocurrió un error al moverlos a la papelera."
        };
      }
    return { success: true, movedCount: itemsToMoveToTrash.length };
  } catch (error) {
    console.error("Error in moveItemsFromPrivateToTrash:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error.";
    return { success: false, movedCount: 0, error: `Error processing move to trash: ${errorMessage}` };
  }
}

export async function moveAllPrivateToGalleryOnPasswordRemoval(userId: string): Promise<{success: boolean, movedCount: number, error?:string}> {
    if (!userId) return { success: false, movedCount: 0, error: "User ID is required." };

    try {
        let allPrivateItems = await readPrivateFolder() as MediaItem[];
        if (allPrivateItems.length === 0) {
            return { success: true, movedCount: 0 };
        }

        let galleryItems = await readGallery() as MediaItem[];
        const userPrivateItemsToMove: MediaItem[] = [];
        const otherUsersPrivateItems: MediaItem[] = [];

        allPrivateItems.forEach(item => {
            if (item.ownerUserId === userId) {
                userPrivateItemsToMove.push(item);
            } else {
                otherUsersPrivateItems.push(item);
            }
        });

        if (userPrivateItemsToMove.length === 0) {
            return { success: true, movedCount: 0, error: "No items found for this user in private folder." };
        }

        galleryItems = [...userPrivateItemsToMove, ...galleryItems];
        galleryItems.sort((a, b) => new Date(b.uploadTimestamp).getTime() - new Date(a.uploadTimestamp).getTime());

        await writeGallery(galleryItems);
        await writePrivateFolder(otherUsersPrivateItems); // Only keep other users' items

        return { success: true, movedCount: userPrivateItemsToMove.length };
    } catch (error) {
        console.error("Error moving all private items to gallery for user:", error);
        const errorMessage = error instanceof Error ? error.message : "Unknown error during cleanup.";
        return { success: false, movedCount: 0, error: errorMessage };
    }
}

