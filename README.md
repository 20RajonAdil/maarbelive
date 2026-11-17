# MAAR Believe

A special video player for the full message video.

## Features

- Custom video player that **prevents seeking forward**.
- Users can pause, resume, and go backward freely.
- Progress is saved in the browser (localStorage) under a **group ID**.
- Share the same URL (with `?group=xxxxx`) so each person keeps their own progress under that shared link.
- Live stats box shows:
  - Percentage watched
  - Maximum time reached
  - Number of blocked forward-skip attempts
  - Pause count
  - Session count
  - Current status

## How to use

1. Open `index.html` (or host the folder).
2. A group ID is automatically added to the URL (`?group=...`).
3. Share that full URL with friends.
4. Each viewer’s progress is stored locally in their browser under that group key.

> Note: True real-time multi-device “I can see how much my friend watched” requires a backend database.  
> This version keeps progress per browser for the shared group link.

## Local development

Just open `index.html` in a browser, or serve the folder:

```bash
npx serve .
```

## Deploy

Push this folder to GitHub and enable GitHub Pages, or deploy to any static host (Netlify, Vercel, Cloudflare Pages, etc.).

Make sure `video.mp4` is present next to `index.html`.
