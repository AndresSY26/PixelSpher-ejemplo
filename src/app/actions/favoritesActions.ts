
"use server";

import fs from 'fs/promises';
import path from 'path';
import type { MediaItem, AllFavoritesData, UserFavorites } from '@/types';
import { getGalleryItems } from './galleryActions';

const dataDir = path.join(process.cwd(), 'src', 'data');
const favoritesFilePath = path.join(dataDir, 'favorites.json');

const DEFAULT_FAVORITES_STRUCTURE: AllFavoritesData = {};

async function readFavoritesFile(): Promise<AllFavoritesData> {
  try {
    await fs.mkdir(path.dirname(favoritesFilePath), { recursive: true });
    const jsonData = await fs.readFile(favoritesFilePath, 'utf-8');
    if (jsonData.trim() === "") {
      await fs.writeFile(favoritesFilePath, JSON.stringify(DEFAULT_FAVORITES_STRUCTURE, null, 2));
      return DEFAULT_FAVORITES_STRUCTURE;
    }
    return JSON.parse(jsonData) as AllFavoritesData;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      await fs.writeFile(favoritesFilePath, JSON.stringify(DEFAULT_FAVORITES_STRUCTURE, null, 2));
      return DEFAULT_FAVORITES_STRUCTURE;
    }
    console.error('Error reading favorites.json:', error);
    throw new Error('Could not read favorites data.');
  }
}

async function writeFavoritesFile(data: AllFavoritesData): Promise<void> {
  try {
    await fs.mkdir(path.dirname(favoritesFilePath), { recursive: true });
    await fs.writeFile(favoritesFilePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error) {
    console.error('Error writing favorites.json:', error);
    throw new Error('Could not save favorites data.');
  }
}

export async function getFavoriteItemIds(userId: string): Promise<string[]> {
  if (!userId) return [];
  const allFavoritesData = await readFavoritesFile();
  return allFavoritesData[userId]?.itemIds || [];
}

export async function isItemFavorite(itemId: string, userId: string): Promise<boolean> {
  if (!userId) return false;
  const userFavoriteIds = await getFavoriteItemIds(userId);
  return userFavoriteIds.includes(itemId);
}

export async function toggleFavoriteStatus(itemId: string, userId: string): Promise<{ success: boolean; isFavorite: boolean; error?: string }> {
  if (!userId) return { success: false, isFavorite: false, error: "User ID es requerido." };
  try {
    const allFavoritesData = await readFavoritesFile();
    if (!allFavoritesData[userId]) {
      allFavoritesData[userId] = { itemIds: [] };
    }

    const userFavorites = allFavoritesData[userId];
    const itemIndex = userFavorites.itemIds.indexOf(itemId);
    let isCurrentlyFavorite: boolean;

    // Ensure item actually belongs to user before favoriting (optional, but good practice)
    const userGalleryItems = await getGalleryItems(userId);
    if (!userGalleryItems.find(item => item.id === itemId)) {
        return { success: false, isFavorite: false, error: "El ítem no pertenece al usuario." };
    }

    if (itemIndex > -1) {
      userFavorites.itemIds.splice(itemIndex, 1);
      isCurrentlyFavorite = false;
    } else {
      userFavorites.itemIds.push(itemId);
      isCurrentlyFavorite = true;
    }

    await writeFavoritesFile(allFavoritesData);
    return { success: true, isFavorite: isCurrentlyFavorite };
  } catch (error) {
    console.error('Error toggling favorite status:', error);
    const message = error instanceof Error ? error.message : "Unknown error.";
    return { success: false, isFavorite: false, error: `Could not update favorite status: ${message}` };
  }
}

export async function getFavoriteMediaItems(userId: string): Promise<MediaItem[]> {
  if (!userId) return [];
  const favoriteItemIds = await getFavoriteItemIds(userId);
  if (favoriteItemIds.length === 0) {
    return [];
  }

  const userGalleryItems = await getGalleryItems(userId); // Already filtered for the user

  const favoriteMediaItems = userGalleryItems.filter(mediaItem =>
    favoriteItemIds.includes(mediaItem.id)
  );

  favoriteMediaItems.sort((a, b) => new Date(b.uploadTimestamp).getTime() - new Date(a.uploadTimestamp).getTime());
  return favoriteMediaItems;
}

