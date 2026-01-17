
export interface Notification {
  id: string;
  type: 'like' | 'follow' | 'message' | 'system';
  fromUsername: string;
  fromAvatar: string;
  targetId?: string; // ID del post o chat relacionado
  text: string;
  timestamp: number;
  read: boolean;
}

export interface User {
  id: string;
  username: string;
  password?: string;
  avatar: string;
  bio: string;
  role: 'creator' | 'user';
  isVerified?: boolean;
  blockedUntil?: number | 'forever';
  blockReason?: string;
  isTerminated?: boolean;
  notifications: Notification[];
  theme?: 'light' | 'dark';
  warnings?: {
    id: string;
    text: string;
    level: 'leve' | 'moderada' | 'intensa';
    timestamp: number;
  }[];
  appeals?: {
    id: string;
    text: string;
    timestamp: number;
    status: 'pending' | 'resolved';
  }[];
  following: string[];
  followers: string[];
  blockedUsers: string[];
  likedPosts: string[];
  dislikedPosts: string[];
  republishedPosts: string[];
}

export interface Comment {
  id: string;
  authorId: string;
  authorUsername: string;
  authorAvatar: string;
  text: string;
  createdAt: number;
}

export interface Post {
  id: string;
  authorId: string;
  authorUsername: string;
  authorAvatar: string;
  title: string;
  description: string;
  image: string;
  category: string;
  tags: string[];
  likes: number;
  dislikes: number;
  republications: number;
  comments: Comment[];
  createdAt: number;
}

export interface Message {
  id: string;
  fromId: string;
  toId: string;
  text: string;
  timestamp: number;
}

export type AppTab = 'home' | 'search' | 'notifications' | 'messages' | 'profile' | 'creator' | 'admin';
export type HomeFeedTab = 'discover' | 'following';
