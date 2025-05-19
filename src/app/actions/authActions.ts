
"use server";

import fs from 'fs/promises';
import path from 'path';
import type { User, AllFavoritesData, UserPreferences } from '@/types';
import { DEFAULT_USER_PREFERENCES } from '@/types';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';


const dataDir = path.join(process.cwd(), 'src', 'data');
const usersFilePath = path.join(dataDir, 'users.json');
const favoritesFilePath = path.join(dataDir, 'favorites.json'); 
const userSpecificSharesFilePath = path.join(dataDir, 'user_specific_shares.json'); // For new user init

function hashPassword(password: string, salt: string): string {
  return crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
}

function verifyPassword(password: string, storedHash: string, salt: string): boolean {
    return hashPassword(password, salt) === storedHash;
}


async function readUsers(): Promise<User[]> {
  try {
    const jsonData = await fs.readFile(usersFilePath, 'utf-8');
    return JSON.parse(jsonData) as User[];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      await fs.mkdir(path.dirname(usersFilePath), { recursive: true });
      await fs.writeFile(usersFilePath, JSON.stringify([])); 
      return [];
    }
    console.error('Error reading users.json:', error);
    throw new Error('Could not read user data.');
  }
}

async function writeUsers(users: User[]): Promise<void> {
  try {
    await fs.mkdir(path.dirname(usersFilePath), { recursive: true });
    await fs.writeFile(usersFilePath, JSON.stringify(users, null, 2), 'utf-8');
  } catch (error) {
    console.error('Error writing users.json:', error);
    throw new Error('Could not save user data.');
  }
}

async function readFavoritesFile(): Promise<AllFavoritesData> {
  try {
    await fs.mkdir(path.dirname(favoritesFilePath), { recursive: true });
    const jsonData = await fs.readFile(favoritesFilePath, 'utf-8');
    if (jsonData.trim() === "") {
      await fs.writeFile(favoritesFilePath, JSON.stringify({}, null, 2));
      return {};
    }
    return JSON.parse(jsonData) as AllFavoritesData;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      await fs.writeFile(favoritesFilePath, JSON.stringify({}, null, 2));
      return {};
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

// Helper for user_specific_shares.json during registration (though shares are not created then)
// This is just to ensure the file exists.
async function ensureUserSpecificSharesFileExists(): Promise<void> {
  try {
    await fs.mkdir(path.dirname(userSpecificSharesFilePath), { recursive: true });
    await fs.access(userSpecificSharesFilePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      await fs.writeFile(userSpecificSharesFilePath, JSON.stringify([], null, 2));
    } else {
      console.error('Error ensuring user_specific_shares.json exists:', error);
    }
  }
}


export async function authenticateUser(identifier: string, password_input: string): Promise<User | null> {
  const users = await readUsers();
  const user = users.find(
    (u) => (u.username.toLowerCase() === identifier.toLowerCase() || u.email.toLowerCase() === identifier.toLowerCase())
  );

  if (user && user.passwordSalt && user.password) {
    if (verifyPassword(password_input, user.password, user.passwordSalt)) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { password, passwordSalt, ...userWithoutSensitiveData } = user; 
      return userWithoutSensitiveData as User;
    }
  }
  return null;
}

export async function updateUserProfile(userId: string, name: string, newPasswordValue?: string): Promise<User | null> {
  const users = await readUsers();
  const userIndex = users.findIndex(u => u.id === userId);

  if (userIndex === -1) {
    return null; 
  }

  users[userIndex].name = name;
  if (newPasswordValue) {
    const salt = crypto.randomBytes(16).toString('hex');
    users[userIndex].passwordSalt = salt;
    users[userIndex].password = hashPassword(newPasswordValue, salt);
  }
  
  users[userIndex].avatarLetter = name.charAt(0).toUpperCase();

  await writeUsers(users);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { password, passwordSalt, ...updatedUserWithoutPassword } = users[userIndex];
  return updatedUserWithoutPassword as User;
}

export async function registerUser(
  name: string,
  username: string,
  email: string,
  passwordValue: string
): Promise<{ success: boolean; error?: string; user?: User }> {
  const users = await readUsers();

  if (users.some(u => u.username.toLowerCase() === username.toLowerCase())) {
    return { success: false, error: "El nombre de usuario ya está en uso." };
  }
  if (users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
    return { success: false, error: "El correo electrónico ya está en uso." };
  }

  const salt = crypto.randomBytes(16).toString('hex');
  const hashedPassword = hashPassword(passwordValue, salt);
  
  const newUserId = (users.length > 0 ? Math.max(...users.map(u => parseInt(u.id, 10))) + 1 : 1).toString();

  const newUser: User = {
    id: newUserId,
    username,
    email,
    password: hashedPassword,
    passwordSalt: salt,
    name,
    avatarLetter: name.charAt(0).toUpperCase(),
    preferences: { ...DEFAULT_USER_PREFERENCES } 
  };

  users.push(newUser);
  await writeUsers(users);

  const favoritesData = await readFavoritesFile();
  if (!favoritesData[newUserId]) {
    favoritesData[newUserId] = { itemIds: [] };
    await writeFavoritesFile(favoritesData);
  }
  
  await ensureUserSpecificSharesFileExists();

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { password, passwordSalt: saltFromNewUser, ...userToReturn } = newUser;
  return { success: true, user: userToReturn as User };
}

export async function getUsersForSharing(currentUserId: string): Promise<Pick<User, 'id' | 'name' | 'username'>[]> {
  const users = await readUsers();
  return users
    .filter(user => user.id !== currentUserId)
    .map(user => ({ id: user.id, name: user.name, username: user.username }));
}

export async function getUserById(userId: string): Promise<User | null> {
    const users = await readUsers();
    const user = users.find(u => u.id === userId);
    if (user) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { password, passwordSalt, ...userWithoutSensitiveData } = user;
        return userWithoutSensitiveData as User;
    }
    return null;
}
