
export interface UserPreferences {
  confirmMoveToTrash?: boolean;
  confirmMoveToPrivate?: boolean;
  defaultGallerySort?: 'chronological_asc' | 'chronological_desc' | 'name_asc' | 'name_desc';
  galleryItemsPerPage?: number;
  lightboxVideoAutoplay?: boolean;
  rememberLastSection?: boolean;
  languagePreference?: string;
  cameraDeviceId?: string;
  downloadOnlyOnWifi?: boolean; // New
  autoUpdateOfflineContent?: boolean; // New
}

export type User = {
  id: string;
  username: string;
  email: string;
  password?: string;
  passwordSalt?: string;
  name: string;
  avatarLetter: string;
  preferences: UserPreferences;
};

export type MediaItem = {
  id: string;
  ownerUserId: string;
  originalFilename: string;
  filename: string;
  filePath: string;
  uploadTimestamp: string;
  type: 'image' | 'video';
  adultContent: boolean;
};

export type TrashItem = MediaItem & {
  deletionTimestamp: string;
};

export type GroupedMedia = {
  date: string;
  items: MediaItem[];
};

export type GroupedTrash = {
  date: string;
  items: TrashItem[];
};

export type Album = {
  id: string;
  ownerUserId: string;
  name: string;
  itemIds: string[];
};

export type UserFavorites = {
  itemIds: string[];
};

export type AllFavoritesData = {
  [userId: string]: UserFavorites;
};

export type ActiveSession = {
  userId: string;
  sessionId: string;
  deviceInfo: string;
  ipAddress?: string;
  loginTimestamp: string;
  lastActiveTimestamp: string;
};

export type SharedLink = {
  shareId: string;
  ownerUserId: string;
  itemId: string;
  creationTimestamp: string;
  isActive: boolean;
};

export interface UserSpecificShare {
  shareInstanceId: string;
  ownerUserId: string;
  itemId: string;
  targetUserId: string;
  shareTimestamp: string;
  message?: string;
  status: 'active' | 'revoked';
}

// For offline_items.json
export type UserOfflineItems = {
  itemIds: string[];
};

export type OfflineItemStorage = {
  [userId: string]: UserOfflineItems;
};


export type AllUserDataExport = {
  "users.json": User[];
  "gallery.json": MediaItem[];
  "trash.json": TrashItem[];
  "albums.json": Album[];
  "favorites.json": AllFavoritesData;
  "private_folder.json": MediaItem[];
  "private_passwords.json": Record<string, { hash: string; salt: string }>;
  "active_sessions.json": ActiveSession[];
  "shared_links.json"?: SharedLink[];
  "user_specific_shares.json"?: UserSpecificShare[];
  "offline_items.json"?: OfflineItemStorage; // New
};

export const DEFAULT_USER_PREFERENCES: UserPreferences = {
  languagePreference: 'es',
  confirmMoveToTrash: true,
  confirmMoveToPrivate: false,
  defaultGallerySort: 'chronological_desc',
  galleryItemsPerPage: 26,
  lightboxVideoAutoplay: true,
  rememberLastSection: true,
  cameraDeviceId: undefined,
  downloadOnlyOnWifi: true, // New default
  autoUpdateOfflineContent: false, // New default
};

