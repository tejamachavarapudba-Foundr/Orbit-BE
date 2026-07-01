export const STORAGE_BUCKETS = {
  AVATARS: process.env.SUPABASE_BUCKET_AVATARS ?? "avatars",

  POSTS: process.env.SUPABASE_BUCKET_POSTS ?? "post-media",

  PROJECTS: process.env.SUPABASE_BUCKET_PROJECTS ?? "project-images",

  EVENTS: process.env.SUPABASE_BUCKET_EVENTS ?? "event-images",

  DOCUMENTS: process.env.SUPABASE_BUCKET_DOCUMENTS ?? "documents",

  CHAT: process.env.SUPABASE_BUCKET_CHAT ?? "chat-media",
} as const;

export const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

export const MAX_VIDEO_SIZE = 50 * 1024 * 1024;

export const MAX_DOCUMENT_SIZE = 20 * 1024 * 1024;