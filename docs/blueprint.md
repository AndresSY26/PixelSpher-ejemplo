# **App Name**: PixelSphere

## Core Features:

- Dark Theme UI: Implements a dark theme with purple accents for buttons and highlights, ensuring a visually appealing and consistent user experience throughout the application.
- Media Upload Simulation: Enables users to upload images and videos, storing metadata in gallery.json (filename, timestamp, type, adult content flag, path) without actual server-side file storage.
- User Authentication: Provides user authentication and session management, reading credentials from users.json and maintaining user sessions using localStorage. Redirects unauthenticated users to the login page.
- Gallery Display: Presents uploaded media in a responsive, chronological grid with grouping by date. Blurs thumbnails of adult content-flagged items with an option to reveal content.
- Trash Management: Manages deleted items by moving their metadata from gallery.json to trash.json upon deletion, including a deletion timestamp, and facilitates restoration or permanent deletion from the trash.

## Style Guidelines:

- Primary background color: Dark gray (#333333) to provide a modern and sophisticated feel.
- Text color: Light gray (#DDDDDD) for optimal readability against the dark background.
- Accent: Purple (#A78BFA) for buttons, highlights, and active states.
- Use a centered layout for the welcome and login pages. Use a fixed sidebar on the left for main navigation. Use a responsive grid for media items in the gallery.
- Employ minimalist, consistent icons from a library like Font Awesome or Material Design for navigation and actions. Gallery icon, share icon, albums icon, heart icon, lock icon, trash icon, gear icon.