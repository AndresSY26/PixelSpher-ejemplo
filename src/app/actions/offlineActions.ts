
"use server";

import fs from 'fs/promises';
import path from 'path';
import type { OfflineItemStorage, UserOfflineItems } from '@/types';

const dataDir = path.join(process.cwd(), 'src', 'data');
const offlineItemsFilePath = path.join(dataDir, 'offline_items.json');

const DEFAULT_OFFLINE_STRUCTURE: OfflineItemStorage = {};

async function readOfflineItemsFile(): Promise<OfflineItemStorage> {
  try {
    await fs.mkdir(path.dirname(offlineItemsFilePath), { recursive: true });
    const jsonData = await fs.readFile(offlineItemsFilePath, 'utf-8');
    if (jsonData.trim() === "") {
      await fs.writeFile(offlineItemsFilePath, JSON.stringify(DEFAULT_OFFLINE_STRUCTURE, null, 2));
      return DEFAULT_OFFLINE_STRUCTURE;
    }
    return JSON.parse(jsonData) as OfflineItemStorage;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      await fs.writeFile(offlineItemsFilePath, JSON.stringify(DEFAULT_OFFLINE_STRUCTURE, null, 2));
      return DEFAULT_OFFLINE_STRUCTURE;
    }
    console.error('Error reading offline_items.json:', error);
    throw new Error('Could not read offline items data.');
  }
}

async function writeOfflineItemsFile(data: OfflineItemStorage): Promise<void> {
  try {
    await fs.mkdir(path.dirname(offlineItemsFilePath), { recursive: true });
    await fs.writeFile(offlineItemsFilePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error) {
    console.error('Error writing offline_items.json:', error);
    throw new Error('Could not save offline items data.');
  }
}

export async function getOfflineItemIds(userId: string): Promise<string[]> {
  if (!userId) return [];
  const allOfflineData = await readOfflineItemsFile();
  return allOfflineData[userId]?.itemIds || [];
}

export async function isItemOffline(userId: string, itemId: string): Promise<boolean> {
  if (!userId || !itemId) return false;
  const userOfflineIds = await getOfflineItemIds(userId);
  return userOfflineIds.includes(itemId);
}

export async function toggleOfflineItem(userId: string, itemId: string): Promise<{ success: boolean; isOffline: boolean; error?: string }> {
  if (!userId || !itemId) {
    return { success: false, isOffline: false, error: "User ID e Item ID son requeridos." };
  }
  try {
    const allOfflineData = await readOfflineItemsFile();
    if (!allOfflineData[userId]) {
      allOfflineData[userId] = { itemIds: [] };
    }

    const userOfflineItems = allOfflineData[userId];
    const itemIndex = userOfflineItems.itemIds.indexOf(itemId);
    let isNowOffline: boolean;

    if (itemIndex > -1) {
      userOfflineItems.itemIds.splice(itemIndex, 1);
      isNowOffline = false;
    } else {
      userOfflineItems.itemIds.push(itemId);
      isNowOffline = true;
    }

    await writeOfflineItemsFile(allOfflineData);
    // Actual file caching logic using Service Workers would be triggered here.
    // For now, we just update the JSON.
    console.log(`Item ${itemId} for user ${userId} is now ${isNowOffline ? 'offline' : 'online'}. Conceptual caching would happen here.`);
    
    return { success: true, isOffline: isNowOffline };
  } catch (error) {
    console.error('Error toggling offline status:', error);
    const message = error instanceof Error ? error.message : "Unknown error.";
    return { success: false, isOffline: false, error: `No se pudo actualizar el estado sin conexión: ${message}` };
  }
}

export async function removeAllOfflineForUser(userId: string): Promise<{ success: boolean; error?: string }> {
    if (!userId) return { success: false, error: "User ID es requerido." };
    try {
        const allOfflineData = await readOfflineItemsFile();
        if (allOfflineData[userId]) {
            allOfflineData[userId].itemIds = [];
            await writeOfflineItemsFile(allOfflineData);
             // Conceptual: trigger removal of all cached files for this user via Service Worker
            console.log(`All offline items removed for user ${userId}. Conceptual cache clearing would happen here.`);
        }
        return { success: true };
    } catch (error) {
        console.error('Error removing all offline items for user:', error);
        return { success: false, error: "No se pudieron eliminar todos los elementos sin conexión." };
    }
}
