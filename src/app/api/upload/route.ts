
import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import type { MediaItem } from '@/types';

const UPLOADS_DIR = path.join(process.cwd(), 'public', 'uploads');
const GALLERY_JSON_PATH = path.join(process.cwd(), 'src', 'data', 'gallery.json');

// Ensure uploads directory exists
async function ensureUploadsDirExists() {
  try {
    await fs.mkdir(UPLOADS_DIR, { recursive: true });
  } catch (error) {
    console.error('Error creating uploads directory:', error);
    // This is a critical error, should probably throw
    throw new Error('Could not create uploads directory');
  }
}

async function readGallery(): Promise<MediaItem[]> {
  try {
    await fs.mkdir(path.dirname(GALLERY_JSON_PATH), { recursive: true });
    const jsonData = await fs.readFile(GALLERY_JSON_PATH, 'utf-8');
     if (jsonData.trim() === "") {
      await fs.writeFile(GALLERY_JSON_PATH, JSON.stringify([]));
      return [];
    }
    return JSON.parse(jsonData);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      await fs.writeFile(GALLERY_JSON_PATH, JSON.stringify([]));
      return []; // File doesn't exist, start with empty gallery
    }
    console.error('Error reading gallery.json:', error);
    throw error; // Re-throw to be caught by handler
  }
}

async function writeGallery(gallery: MediaItem[]): Promise<void> {
  try {
    await fs.mkdir(path.dirname(GALLERY_JSON_PATH), { recursive: true });
    await fs.writeFile(GALLERY_JSON_PATH, JSON.stringify(gallery, null, 2), 'utf-8');
  } catch (error) {
    console.error('Error writing gallery.json:', error);
    throw error; // Re-throw
  }
}

const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
const ACCEPTED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime', 'video/mov', 'video/x-matroska', 'video/x-msvideo', 'video/x-flv'];


export async function POST(request: NextRequest) {
  await ensureUploadsDirExists();

  try {
    const formData = await request.formData();
    const files = formData.getAll('files') as File[];
    const adultContent = formData.get('adultContent') === 'true';
    const ownerUserId = formData.get('ownerUserId') as string; 

    if (!ownerUserId) {
      return NextResponse.json({ error: 'User ID is missing.' }, { status: 400 });
    }

    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'No files uploaded.' }, { status: 400 });
    }

    const gallery = await readGallery();
    const newItems: MediaItem[] = [];

    for (const file of files) {
      if (!(file instanceof File)) {
        console.warn('Skipping non-file form data entry');
        continue;
      }

      const originalFilename = file.name;
      const fileExtension = path.extname(originalFilename);
      const uniqueFilename = `${uuidv4()}${fileExtension}`;
      const filePathInPublic = path.join('/uploads', uniqueFilename); 
      const diskPath = path.join(UPLOADS_DIR, uniqueFilename); 

      const fileType = ACCEPTED_IMAGE_TYPES.includes(file.type) ? 'image' : ACCEPTED_VIDEO_TYPES.includes(file.type) ? 'video' : null;

      if (!fileType) {
        console.warn(`Skipping unsupported file type: ${file.type} for file ${originalFilename}`);
        continue;
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      await fs.writeFile(diskPath, buffer);

      const newItem: MediaItem = {
        id: uuidv4(),
        ownerUserId, // Assign ownerUserId
        originalFilename,
        filename: uniqueFilename,
        filePath: filePathInPublic,
        uploadTimestamp: new Date().toISOString(),
        type: fileType,
        adultContent,
      };
      newItems.push(newItem);
    }

    if (newItems.length > 0) {
      const updatedGallery = [...newItems, ...gallery];
      await writeGallery(updatedGallery);
      return NextResponse.json({ message: 'Files uploaded successfully.', items: newItems }, { status: 201 });
    } else {
      return NextResponse.json({ error: 'No valid files were processed.' }, { status: 400 });
    }

  } catch (error) {
    console.error('Upload failed:', error);
    if (error instanceof Error) {
         return NextResponse.json({ error: 'Upload failed.', details: error.message }, { status: 500 });
    }
    return NextResponse.json({ error: 'An unknown upload error occurred.' }, { status: 500 });
  }
}

