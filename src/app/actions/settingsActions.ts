
"use server";

import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import type { User, ActiveSession, MediaItem, TrashItem, Album, AllFavoritesData, AllUserDataExport, UserPreferences, SharedLink, UserSpecificShare, OfflineItemStorage } from '@/types';
import { DEFAULT_USER_PREFERENCES } from '@/types';
import { moveAllPrivateToGalleryOnPasswordRemoval } from './privateFolderActions';

const dataDir = path.join(process.cwd(), 'src', 'data');
const usersFilePath = path.join(dataDir, 'users.json');
const privatePasswordsFilePath = path.join(dataDir, 'private_passwords.json');
const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
const galleryFilePath = path.join(dataDir, 'gallery.json');
const privateFolderFilePath = path.join(dataDir, 'private_folder.json');
const trashFilePath = path.join(dataDir, 'trash.json');
const activeSessionsFilePath = path.join(dataDir, 'active_sessions.json');
const albumsFilePath = path.join(dataDir, 'albums.json');
const favoritesFilePath = path.join(dataDir, 'favorites.json');
const sharedLinksFilePath = path.join(dataDir, 'shared_links.json');
const userSpecificSharesFilePath = path.join(dataDir, 'user_specific_shares.json');
const offlineItemsFilePath = path.join(dataDir, 'offline_items.json'); // New path

type PrivatePasswordsStore = {
  [userId: string]: {
    hash: string;
    salt: string;
  };
};


async function readJsonFile<T>(filePath: string, defaultValue: T): Promise<T> {
  try {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    const jsonData = await fs.readFile(filePath, 'utf-8');
    return jsonData.trim() === "" ? defaultValue : JSON.parse(jsonData);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      await fs.writeFile(filePath, JSON.stringify(defaultValue, null, 2));
      return defaultValue;
    }
    console.error(`Error reading ${path.basename(filePath)}:`, error);
    throw new Error(`Could not read ${path.basename(filePath)} data.`);
  }
}

async function writeJsonFile<T>(filePath: string, data: T): Promise<void> {
  try {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error) {
    console.error(`Error writing ${path.basename(filePath)}:`, error);
    throw new Error(`Could not save ${path.basename(filePath)} data.`);
  }
}

// Specific read functions for type safety
const readUsers = () => readJsonFile<User[]>(usersFilePath, []);
const writeUsers = (users: User[]) => writeJsonFile(usersFilePath, users);
const readPrivatePasswords = () => readJsonFile<PrivatePasswordsStore>(privatePasswordsFilePath, {});
const writePrivatePasswords = (passwords: PrivatePasswordsStore) => writeJsonFile(privatePasswordsFilePath, passwords);
const readActiveSessions = () => readJsonFile<ActiveSession[]>(activeSessionsFilePath, []);
const writeActiveSessions = (sessions: ActiveSession[]) => writeJsonFile(activeSessionsFilePath, sessions);
const readGallery = () => readJsonFile<MediaItem[]>(galleryFilePath, []);
const writeGallery = (gallery: MediaItem[]) => writeJsonFile(galleryFilePath, gallery);
const readTrash = () => readJsonFile<TrashItem[]>(trashFilePath, []);
const writeTrash = (trash: TrashItem[]) => writeJsonFile(trashFilePath, trash);
const readAlbums = () => readJsonFile<Album[]>(albumsFilePath, []);
const writeAlbums = (albums: Album[]) => writeJsonFile(albumsFilePath, albums);
const readFavorites = () => readJsonFile<AllFavoritesData>(favoritesFilePath, {});
const writeFavorites = (favorites: AllFavoritesData) => writeJsonFile(favoritesFilePath, favorites);
const readPrivateFolder = () => readJsonFile<MediaItem[]>(privateFolderFilePath, []);
const writePrivateFolder = (privateItems: MediaItem[]) => writeJsonFile(privateFolderFilePath, privateItems);
const readSharedLinks = () => readJsonFile<SharedLink[]>(sharedLinksFilePath, []);
const writeSharedLinks = (links: SharedLink[]) => writeJsonFile(sharedLinksFilePath, links);
const readUserSpecificShares = () => readJsonFile<UserSpecificShare[]>(userSpecificSharesFilePath, []);
const writeUserSpecificShares = (shares: UserSpecificShare[]) => writeJsonFile(userSpecificSharesFilePath, shares);
const readOfflineItems = () => readJsonFile<OfflineItemStorage>(offlineItemsFilePath, {}); // New read function
const writeOfflineItems = (items: OfflineItemStorage) => writeJsonFile(offlineItemsFilePath, items); // New write function


function hashPassword(password: string, salt: string): string {
  return crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
}

export async function checkPrivatePasswordStatus(userId: string): Promise<{ isPasswordSet: boolean }> {
  if (!userId) {
    console.error("User ID is required for checkPrivatePasswordStatus.");
    return { isPasswordSet: false };
  }
  const passwords = await readPrivatePasswords();
  return { isPasswordSet: !!passwords[userId] };
}


export async function setPrivatePassword(userId: string, newPasswordValue: string): Promise<{ success: boolean; error?: string }> {
  if (!userId || !newPasswordValue) {
    return { success: false, error: "User ID y contraseña son requeridos." };
  }
  if (newPasswordValue.length < 6) {
     return { success: false, error: "La contraseña debe tener al menos 6 caracteres." };
  }

  const passwords = await readPrivatePasswords();
  const salt = crypto.randomBytes(16).toString('hex');
  const hashedPassword = hashPassword(newPasswordValue, salt);

  passwords[userId] = { hash: hashedPassword, salt };
  await writePrivatePasswords(passwords);
  return { success: true };
}

export async function verifyPrivatePassword(userId: string, enteredPasswordValue: string): Promise<{ success: boolean; error?: string }> {
  if (!userId || !enteredPasswordValue) {
    return { success: false, error: "User ID y contraseña son requeridos." };
  }
  const passwords = await readPrivatePasswords();
  const storedPasswordData = passwords[userId];

  if (!storedPasswordData) {
    return { success: false, error: "No hay contraseña configurada para este usuario." };
  }

  const hashOfEnteredPassword = hashPassword(enteredPasswordValue, storedPasswordData.salt);
  if (hashOfEnteredPassword === storedPasswordData.hash) {
    return { success: true };
  } else {
    return { success: false, error: "Contraseña actual incorrecta." };
  }
}


export async function changePrivatePassword(userId: string, currentPasswordValue: string, newPasswordValue: string): Promise<{ success: boolean; error?: string }> {
  if (!userId || !currentPasswordValue || !newPasswordValue) {
    return { success: false, error: "Todos los campos de contraseña son requeridos." };
  }
   if (newPasswordValue.length < 6) {
     return { success: false, error: "La nueva contraseña debe tener al menos 6 caracteres." };
  }

  const passwords = await readPrivatePasswords();
  const storedPasswordData = passwords[userId];

  if (!storedPasswordData) {
    return { success: false, error: "No hay contraseña configurada. Por favor, configura una primero." };
  }

  const hashOfCurrentPassword = hashPassword(currentPasswordValue, storedPasswordData.salt);
  if (hashOfCurrentPassword !== storedPasswordData.hash) {
    return { success: false, error: "La contraseña actual es incorrecta." };
  }

  const newSalt = crypto.randomBytes(16).toString('hex');
  const newHashedPassword = hashPassword(newPasswordValue, newSalt);

  passwords[userId] = { hash: newHashedPassword, salt: newSalt };
  await writePrivatePasswords(passwords);
  return { success: true };
}

export async function removePrivatePassword(userId: string): Promise<{ success: boolean; error?: string }> {
  if (!userId) {
    return { success: false, error: "User ID es requerido." };
  }
  const passwords = await readPrivatePasswords();
  if (!passwords[userId]) {
    return { success: false, error: "No hay contraseña configurada para eliminar." };
  }

  delete passwords[userId];
  await writePrivatePasswords(passwords);

  const moveResult = await moveAllPrivateToGalleryOnPasswordRemoval(userId);
  if (!moveResult.success) {
      console.warn(`Password removed for user ${userId}, but failed to move items from private folder: ${moveResult.error}`);
  }

  return { success: true };
}

async function getDirectorySize(directoryPath: string): Promise<number> {
  let totalSize = 0;
  try {
    const files = await fs.readdir(directoryPath, { withFileTypes: true });
    for (const file of files) {
      const filePath = path.join(directoryPath, file.name);
      if (file.isDirectory()) {
        totalSize += await getDirectorySize(filePath);
      } else if (file.isFile()) {
        try {
          const stats = await fs.stat(filePath);
          totalSize += stats.size;
        } catch (statError) {
            console.warn(`Could not get stats for file ${filePath}:`, statError);
        }
      }
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return 0;
    }
    console.error(`Error reading directory ${directoryPath}:`, error);
    return 0;
  }
  return totalSize;
}

function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}


export async function getStorageUsage(): Promise<{ usedBytes: number; readableUsed: string }> {
  try {
    await fs.mkdir(uploadsDir, { recursive: true });
    const usedBytes = await getDirectorySize(uploadsDir);
    return {
      usedBytes,
      readableUsed: formatBytes(usedBytes),
    };
  } catch (error) {
    console.error("Failed to calculate storage usage:", error);
    return { usedBytes: 0, readableUsed: "Error" };
  }
}

export async function addActiveSession(userId: string, deviceInfo: string, ipAddress?: string): Promise<{ sessionId: string }> {
  const sessions = await readActiveSessions();
  const newSessionId = uuidv4();
  const timestamp = new Date().toISOString();
  const newSession: ActiveSession = {
    userId,
    sessionId: newSessionId,
    deviceInfo,
    ipAddress,
    loginTimestamp: timestamp,
    lastActiveTimestamp: timestamp,
  };
  sessions.push(newSession);
  await writeActiveSessions(sessions);
  return { sessionId: newSessionId };
}

export async function getActiveSessionsForUser(userId: string): Promise<ActiveSession[]> {
  if (!userId) return [];
  const sessions = await readActiveSessions();
  return sessions.filter(session => session.userId === userId)
                 .sort((a,b) => new Date(b.loginTimestamp).getTime() - new Date(a.loginTimestamp).getTime());
}

export async function removeActiveSession(sessionIdToRemove: string): Promise<{ success: boolean; error?: string }> {
  if (!sessionIdToRemove) return { success: false, error: "Session ID es requerido." };

  const sessions = await readActiveSessions();
  const updatedSessions = sessions.filter(session => session.sessionId !== sessionIdToRemove);

  if (sessions.length === updatedSessions.length) {
    return { success: false, error: "Sesión no encontrada." };
  }

  await writeActiveSessions(updatedSessions);
  return { success: true };
}

export async function removeOtherActiveSessions(userId: string, currentSessionId: string): Promise<{ success: boolean; error?: string }> {
  if (!userId || !currentSessionId) {
    return { success: false, error: "User ID y Current Session ID son requeridos." };
  }

  const sessions = await readActiveSessions();
  const remainingSessions = sessions.filter(session =>
    session.userId !== userId || session.sessionId === currentSessionId
  );

  await writeActiveSessions(remainingSessions);
  return { success: true };
}

export async function updateLastActiveTimestamp(sessionId: string): Promise<void> {
  if (!sessionId) return;
  const sessions = await readActiveSessions();
  const sessionIndex = sessions.findIndex(s => s.sessionId === sessionId);
  if (sessionIndex > -1) {
    sessions[sessionIndex].lastActiveTimestamp = new Date().toISOString();
    await writeActiveSessions(sessions);
  }
}

export async function updateUserLanguagePreference(userId: string, languageCode: string): Promise<{ success: boolean; user?: User; error?: string }> {
  if (!userId || !languageCode) {
    return { success: false, error: "User ID y código de idioma son requeridos." };
  }

  const users = await readUsers();
  const userIndex = users.findIndex(u => u.id === userId);

  if (userIndex === -1) {
    return { success: false, error: "Usuario no encontrado." };
  }

  if (!users[userIndex].preferences) users[userIndex].preferences = { ...DEFAULT_USER_PREFERENCES };
  users[userIndex].preferences!.languagePreference = languageCode;
  await writeUsers(users);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { password, passwordSalt, ...updatedUserWithoutPassword } = users[userIndex];
  return { success: true, user: updatedUserWithoutPassword as User };
}


const ALL_DATA_FILES_CONFIG: Record<keyof AllUserDataExport, { readFunc: () => Promise<any>; writeFunc: (data: any) => Promise<void>; default: any }> = {
  "users.json": { readFunc: readUsers, writeFunc: writeUsers, default: [] as User[] },
  "gallery.json": { readFunc: readGallery, writeFunc: writeGallery, default: [] as MediaItem[] },
  "trash.json": { readFunc: readTrash, writeFunc: writeTrash, default: [] as TrashItem[] },
  "albums.json": { readFunc: readAlbums, writeFunc: writeAlbums, default: [] as Album[] },
  "favorites.json": { readFunc: readFavorites, writeFunc: writeFavorites, default: {} as AllFavoritesData },
  "private_folder.json": { readFunc: readPrivateFolder, writeFunc: writePrivateFolder, default: [] as MediaItem[] },
  "private_passwords.json": { readFunc: readPrivatePasswords, writeFunc: writePrivatePasswords, default: {} as PrivatePasswordsStore },
  "active_sessions.json": { readFunc: readActiveSessions, writeFunc: writeActiveSessions, default: [] as ActiveSession[] },
  "shared_links.json": { readFunc: readSharedLinks, writeFunc: writeSharedLinks, default: [] as SharedLink[] },
  "user_specific_shares.json": { readFunc: readUserSpecificShares, writeFunc: writeUserSpecificShares, default: [] as UserSpecificShare[]},
  "offline_items.json": { readFunc: readOfflineItems, writeFunc: writeOfflineItems, default: {} as OfflineItemStorage }, // New entry
};

export async function exportAllUserData(userId: string): Promise<Partial<AllUserDataExport> | { error: string }> {
  try {
    const allData: Partial<AllUserDataExport> = {};
    for (const [filename, config] of Object.entries(ALL_DATA_FILES_CONFIG)) {
        try {
            let fileContent = await config.readFunc();
            // For user-specific data, filter by userId if applicable
            if (filename === "users.json") {
                fileContent = (fileContent as User[]).filter(u => u.id === userId);
            } else if (["gallery.json", "trash.json", "private_folder.json", "albums.json", "shared_links.json", "user_specific_shares.json"].includes(filename) && Array.isArray(fileContent)) {
                fileContent = fileContent.filter((item: any) => item.ownerUserId === userId || (filename === "user_specific_shares.json" && (item.ownerUserId === userId || item.targetUserId === userId)));
            } else if (["favorites.json", "private_passwords.json", "offline_items.json"].includes(filename) && typeof fileContent === 'object' && fileContent !== null) { // Added offline_items.json
                fileContent = { [userId]: fileContent[userId] || config.default[userId] || (filename === "favorites.json" || filename === "offline_items.json" ? {itemIds: []} : {}) };
            } else if (filename === "active_sessions.json" && Array.isArray(fileContent)) {
                fileContent = fileContent.filter((session: ActiveSession) => session.userId === userId);
            }

            allData[filename as keyof AllUserDataExport] = fileContent;
        } catch (error) {
            console.error(`Error reading or filtering ${filename} for export (user: ${userId}):`, error);
            if (["favorites.json", "private_passwords.json", "offline_items.json"].includes(filename)) { // Added offline_items.json
                allData[filename as keyof AllUserDataExport] = { [userId]: config.default[userId] || (filename === "favorites.json" || filename === "offline_items.json" ? {itemIds: []} : {}) } as any;
            } else {
                 allData[filename as keyof AllUserDataExport] = config.default;
            }
        }
    }
    return allData;
  } catch (error) {
    console.error("Error exporting all user data:", error);
    return { error: "Failed to export user data." };
  }
}

function basicValidate(filename: string, content: any, userId: string): { valid: boolean; error?: string } {
    if (["gallery.json", "trash.json", "albums.json", "private_folder.json", "active_sessions.json", "shared_links.json", "user_specific_shares.json"].includes(filename)) {
        if (!Array.isArray(content)) return { valid: false, error: `${filename} debería ser un array.` };
    } else if (filename === "users.json"){
        if (!Array.isArray(content) || !content.every(item => typeof item === 'object' && item.id && item.username)) {
             return { valid: false, error: `Validación fallida para ${filename}. Debe ser un array de usuarios con id y username.` };
        }
        if (content.length !== 1 || content[0].id !== userId) { 
            return { valid: false, error: `${filename} solo debe contener datos para el usuario actual.` };
        }
    } else if (["favorites.json", "private_passwords.json", "offline_items.json"].includes(filename)) { // Added offline_items.json
        if (typeof content !== 'object' || content === null || !content[userId]) return { valid: false, error: `${filename} debería ser un objeto con una entrada para el usuario ${userId}.` };
    }
    return { valid: true };
}


export async function importAllUserData(dataToImport: Partial<AllUserDataExport>, userId: string): Promise<{ success: boolean; error?: string, details?: Record<string, string> }> {
  try {
    const validationErrors: Record<string, string> = {};

    for (const [filename, fileContent] of Object.entries(dataToImport)) {
      if (fileContent === undefined || fileContent === null) {
        validationErrors[filename] = "Contenido del archivo es nulo o indefinido.";
        continue;
      }

      const validation = basicValidate(filename as keyof AllUserDataExport, fileContent, userId);
      if (!validation.valid) {
        validationErrors[filename] = validation.error || "Validación de estructura fallida.";
      }
    }

    if (Object.keys(validationErrors).length > 0) {
      return { success: false, error: "Falló la validación de datos para uno o más archivos.", details: validationErrors };
    }

    // Read existing data
    const currentUsers = await readUsers();
    const currentGallery = await readGallery();
    const currentTrash = await readTrash();
    const currentAlbums = await readAlbums();
    const currentFavorites = await readFavorites();
    const currentPrivateFolder = await readPrivateFolder();
    const currentPrivatePasswords = await readPrivatePasswords();
    const currentActiveSessions = await readActiveSessions();
    const currentSharedLinks = await readSharedLinks();
    const currentUserSpecificShares = await readUserSpecificShares();
    const currentOfflineItems = await readOfflineItems(); // New


    // Update only the current user's data or data owned by the current user
    const importedUserData = dataToImport["users.json"]?.[0];
    if (importedUserData) {
        const userIndex = currentUsers.findIndex(u => u.id === userId);
        if (userIndex !== -1) currentUsers[userIndex] = { ...currentUsers[userIndex], ...importedUserData, id: userId }; 
        else currentUsers.push({ ...importedUserData, id: userId }); 
        await writeUsers(currentUsers);
    }

    const updateOwnedData = async (filePath: string, currentData: any[], importedData: any[], config: any) => {
        const otherUsersData = currentData.filter(item => item.ownerUserId !== userId && !(filePath === userSpecificSharesFilePath && item.targetUserId === userId) );
        const newUserData = importedData.filter(item => item.ownerUserId === userId || (filePath === userSpecificSharesFilePath && item.targetUserId === userId));
        await config.writeFunc([...otherUsersData, ...newUserData]);
    };

    const updateUserSpecificObject = async (filePath: string, currentData: any, importedData: any, config: any) => {
        currentData[userId] = importedData[userId];
        await config.writeFunc(currentData);
    };


    if(dataToImport["gallery.json"]) await updateOwnedData(galleryFilePath, currentGallery, dataToImport["gallery.json"], ALL_DATA_FILES_CONFIG["gallery.json"]);
    if(dataToImport["trash.json"]) await updateOwnedData(trashFilePath, currentTrash, dataToImport["trash.json"], ALL_DATA_FILES_CONFIG["trash.json"]);
    if(dataToImport["albums.json"]) await updateOwnedData(albumsFilePath, currentAlbums, dataToImport["albums.json"], ALL_DATA_FILES_CONFIG["albums.json"]);
    if(dataToImport["private_folder.json"]) await updateOwnedData(privateFolderFilePath, currentPrivateFolder, dataToImport["private_folder.json"], ALL_DATA_FILES_CONFIG["private_folder.json"]);
    if(dataToImport["active_sessions.json"]) { 
        const otherUserSessions = currentActiveSessions.filter(s => s.userId !== userId);
        const importedUserSessions = (dataToImport["active_sessions.json"] || []).filter(s => s.userId === userId);
        await writeActiveSessions([...otherUserSessions, ...importedUserSessions]);
    }
    if(dataToImport["shared_links.json"]) await updateOwnedData(sharedLinksFilePath, currentSharedLinks, dataToImport["shared_links.json"], ALL_DATA_FILES_CONFIG["shared_links.json"]);
    if(dataToImport["user_specific_shares.json"]) await updateOwnedData(userSpecificSharesFilePath, currentUserSpecificShares, dataToImport["user_specific_shares.json"], ALL_DATA_FILES_CONFIG["user_specific_shares.json"]);


    if(dataToImport["favorites.json"]) await updateUserSpecificObject(favoritesFilePath, currentFavorites, dataToImport["favorites.json"], ALL_DATA_FILES_CONFIG["favorites.json"]);
    if(dataToImport["private_passwords.json"]) await updateUserSpecificObject(privatePasswordsFilePath, currentPrivatePasswords, dataToImport["private_passwords.json"], ALL_DATA_FILES_CONFIG["private_passwords.json"]);
    if(dataToImport["offline_items.json"]) await updateUserSpecificObject(offlineItemsFilePath, currentOfflineItems, dataToImport["offline_items.json"], ALL_DATA_FILES_CONFIG["offline_items.json"]); // New


    return { success: true };
  } catch (error) {
    console.error("Error importing user data:", error);
    return { success: false, error: `Error al importar datos: ${error instanceof Error ? error.message : 'Error desconocido'}.` };
  }
}


export async function getUserPreferences(userId: string): Promise<UserPreferences> {
  if (!userId) {
    console.warn("getUserPreferences called without userId, returning default preferences.");
    return DEFAULT_USER_PREFERENCES;
  }
  const users = await readUsers();
  const user = users.find(u => u.id === userId);
  return user?.preferences ? { ...DEFAULT_USER_PREFERENCES, ...user.preferences } : DEFAULT_USER_PREFERENCES;
}

export async function updateUserPreferences(userId: string, newPreferences: Partial<UserPreferences>): Promise<{ success: boolean; preferences?: UserPreferences; error?: string }> {
  if (!userId) {
    return { success: false, error: "User ID es requerido." };
  }

  const users = await readUsers();
  const userIndex = users.findIndex(u => u.id === userId);

  if (userIndex === -1) {
    return { success: false, error: "Usuario no encontrado." };
  }

  const parsedPreferences = { ...newPreferences };
  if (parsedPreferences.galleryItemsPerPage !== undefined && typeof parsedPreferences.galleryItemsPerPage === 'string') {
    const num = parseInt(parsedPreferences.galleryItemsPerPage, 10);
    parsedPreferences.galleryItemsPerPage = isNaN(num) ? DEFAULT_USER_PREFERENCES.galleryItemsPerPage : num;
  }

  users[userIndex].preferences = {
    ...(users[userIndex].preferences || DEFAULT_USER_PREFERENCES),
    ...parsedPreferences,
  };

  await writeUsers(users);

  const updatedUser = users[userIndex];
  return { success: true, preferences: updatedUser.preferences };
}
