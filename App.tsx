
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { User, Post, AppTab, Message, Comment, Notification, HomeFeedTab } from './types';
import { PostCard } from './components/PostCard';
import { GoogleGenAI } from "@google/genai";

const CATEGORIES = ['General', 'Tecnología', 'Noticias', 'Arte', 'Deportes', 'Cultura'];

const INITIAL_USERS: User[] = [
  {
    id: 'admin',
    username: 'portainfo',
    password: '1995',
    role: 'creator',
    isVerified: true,
    avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=portainfo',
    bio: 'Bienvenido al panel de control oficial de Portainfo.',
    notifications: [],
    theme: 'light',
    following: [],
    followers: [],
    blockedUsers: [],
    likedPosts: [],
    dislikedPosts: [],
    republishedPosts: [],
    warnings: [],
    appeals: []
  },
  {
    id: 'user1',
    username: 'viajero_curioso',
    password: 'password',
    role: 'user',
    isVerified: false,
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=travel',
    bio: 'Me encanta descubrir nuevas historias.',
    notifications: [],
    theme: 'light',
    following: [],
    followers: [],
    blockedUsers: [],
    likedPosts: [],
    dislikedPosts: [],
    republishedPosts: [],
    warnings: [],
    appeals: []
  }
];

const INITIAL_POSTS: Post[] = [
  {
    id: 'post1',
    authorId: 'admin',
    authorUsername: 'portainfo',
    authorAvatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=portainfo',
    title: 'Bienvenidos a Portainfo',
    description: 'Esta es la plataforma definitiva para compartir información y conectar con otros creadores. #Bienvenida #Comunidad',
    image: 'https://picsum.photos/seed/welcome/800/400',
    category: 'General',
    tags: ['Bienvenida', 'Comunidad'],
    likes: 124,
    dislikes: 2,
    republications: 45,
    comments: [],
    createdAt: Date.now() - 3600000
  }
];

export const VerifiedBadge = () => (
  <i className="fas fa-check-circle text-blue-500 ml-1 shadow-sm" title="Usuario Verificado"></i>
);

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AppTab>('home');
  const [homeFeedTab, setHomeFeedTab] = useState<HomeFeedTab>('discover');
  const [selectedCategory, setSelectedCategory] = useState('Todas');
  const [activeAdminSubTab, setActiveAdminSubTab] = useState<'verification' | 'sanctions' | 'appeals' | 'admins'>('verification');
  
  const [users, setUsers] = useState<User[]>(() => {
    const saved = localStorage.getItem('portainfo_users');
    return saved ? JSON.parse(saved) : INITIAL_USERS;
  });

  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('portainfo_user');
    return saved ? JSON.parse(saved) : null;
  });

  const [posts, setPosts] = useState<Post[]>(() => {
    const saved = localStorage.getItem('portainfo_posts');
    return saved ? JSON.parse(saved) : INITIAL_POSTS;
  });

  const [messages, setMessages] = useState<Message[]>(() => {
    const saved = localStorage.getItem('portainfo_messages');
    return saved ? JSON.parse(saved) : [];
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authForm, setAuthForm] = useState({ username: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState('');
  
  const [profileViewId, setProfileViewId] = useState<string | null>(null);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editForm, setEditForm] = useState({ username: '', bio: '', avatar: '' });
  
  const [postImagePreview, setPostImagePreview] = useState<string | null>(null);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [imagePrompt, setImagePrompt] = useState('');

  const postFileRef = useRef<HTMLInputElement>(null);
  const avatarFileRef = useRef<HTMLInputElement>(null);

  // Appeal state
  const [appealText, setAppealText] = useState('');
  const [isAppealViewOpen, setIsAppealViewOpen] = useState(false);

  // Sanction form
  const [sanctionForm, setSanctionForm] = useState<{
    userId: string;
    level: 'leve' | 'moderada' | 'intensa';
    duration: number;
    unit: 'hours' | 'days' | 'weeks' | 'months' | 'forever';
    reason: string;
  }>({
    userId: '',
    level: 'leve',
    duration: 1,
    unit: 'hours',
    reason: ''
  });

  // Dark Mode Support
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (currentUser?.theme) return currentUser.theme;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    if (currentUser) {
      const updated = { ...currentUser, theme: newTheme };
      setCurrentUser(updated);
      setUsers(prev => prev.map(u => u.id === currentUser.id ? updated : u));
    }
  };

  useEffect(() => {
    if (currentUser) {
      const match = users.find(u => u.id === currentUser.id);
      if (match) {
        if (JSON.stringify(match) !== JSON.stringify(currentUser)) {
          setCurrentUser(match);
        }
      } else {
        handleLogout();
      }
    }
  }, [users]);

  const isUserEffectivelyBlocked = useMemo(() => {
    if (!currentUser) return false;
    if (currentUser.role === 'creator') return false; 
    if (currentUser.isTerminated) return true;
    if (currentUser.blockedUntil === 'forever') return true;
    if (typeof currentUser.blockedUntil === 'number' && Date.now() < currentUser.blockedUntil) return true;
    return false;
  }, [currentUser]);

  const [timeLeftStr, setTimeLeftStr] = useState('');
  useEffect(() => {
    if (!isUserEffectivelyBlocked) return;
    if (currentUser?.blockedUntil === 'forever' || currentUser?.isTerminated) {
      setTimeLeftStr('SIEMPRE');
      return;
    }
    const updateTimer = () => {
      if (!currentUser?.blockedUntil || typeof currentUser.blockedUntil !== 'number') {
         setTimeLeftStr('SIEMPRE');
         return;
      }
      const remaining = currentUser.blockedUntil - Date.now();
      if (remaining <= 0) {
        setTimeLeftStr('TERMINADO');
        const updatedUser = { ...currentUser, blockedUntil: undefined, blockReason: '' };
        setUsers(prev => prev.map(u => u.id === currentUser.id ? updatedUser : u));
        return;
      }
      const h = Math.floor(remaining / 3600000);
      const m = Math.floor((remaining % 3600000) / 60000);
      const s = Math.floor((remaining % 60000) / 1000);
      setTimeLeftStr(`${h}h ${m}m ${s}s`);
    };
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [isUserEffectivelyBlocked, currentUser]);

  useEffect(() => {
    localStorage.setItem('portainfo_user', JSON.stringify(currentUser));
    localStorage.setItem('portainfo_users', JSON.stringify(users));
    localStorage.setItem('portainfo_posts', JSON.stringify(posts));
    localStorage.setItem('portainfo_messages', JSON.stringify(messages));
  }, [currentUser, users, posts, messages]);

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  const addNotification = (userId: string, notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => {
    const newNotif: Notification = {
      ...notification,
      id: Math.random().toString(36).substr(2, 9),
      timestamp: Date.now(),
      read: false
    };
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, notifications: [newNotif, ...(u.notifications || [])] } : u));
  };

  const handleAuth = () => {
    setAuthError('');
    if (authMode === 'login') {
      const user = users.find(u => u.username === authForm.username);
      if (!user) {
        setAuthError('Usuario no encontrado');
        return;
      }
      if (user.password !== authForm.password) {
        setAuthError('Contraseña incorrecta');
        return;
      }
      setCurrentUser(user);
      if (user.theme) setTheme(user.theme);
      setIsAuthModalOpen(false);
      setAuthForm({ username: '', password: '' });
      setShowPassword(false);
    } else {
      if (!authForm.username.trim() || !authForm.password.trim()) {
        setAuthError('Todos los campos son obligatorios');
        return;
      }
      if (users.some(u => u.username.toLowerCase() === authForm.username.toLowerCase())) {
        setAuthError('Este nombre de usuario ya existe');
        return;
      }
      const newUser: User = {
        id: Math.random().toString(36).substr(2, 9),
        username: authForm.username,
        password: authForm.password,
        role: 'user',
        isVerified: false,
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${authForm.username}`,
        bio: 'Nuevo usuario de Portainfo',
        notifications: [],
        theme: 'light',
        following: [],
        followers: [],
        blockedUsers: [],
        likedPosts: [],
        dislikedPosts: [],
        republishedPosts: [],
        warnings: [],
        appeals: []
      };
      setUsers([...users, newUser]);
      setCurrentUser(newUser);
      setIsAuthModalOpen(false);
      setAuthForm({ username: '', password: '' });
      setShowPassword(false);
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setActiveTab('home');
    setProfileViewId(null);
    setActiveChatId(null);
    setIsAppealViewOpen(false);
  };

  const handleSendAppeal = () => {
    if (!currentUser || !appealText.trim()) return;
    const newAppeal = {
      id: Math.random().toString(36).substr(2, 9),
      text: appealText,
      timestamp: Date.now(),
      status: 'pending' as const
    };
    const updatedUser = { ...currentUser, appeals: [...(currentUser.appeals || []), newAppeal] };
    setUsers(prev => prev.map(u => u.id === currentUser.id ? updatedUser : u));
    setCurrentUser(updatedUser);
    setAppealText('');
    setIsAppealViewOpen(false);
    alert('Tu apelación ha sido enviada a Portainfo.');
  };

  const handleSelfDeleteAccount = () => {
    if (!currentUser) return;
    if (window.confirm('¿ESTÁS ABSOLUTAMENTE SEGURO?')) {
      const userIdToDelete = currentUser.id;
      setPosts(prev => prev.filter(p => p.authorId !== userIdToDelete));
      setUsers(prev => prev.filter(u => u.id !== userIdToDelete));
      handleLogout();
    }
  };

  const handleGenerateAIImage = async () => {
    if (!imagePrompt.trim()) return;
    setIsGeneratingImage(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: [{ text: imagePrompt }] },
      });
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          setPostImagePreview(`data:image/png;base64,${part.inlineData.data}`);
          break;
        }
      }
    } catch (e) {
      console.error(e);
      alert('Error al generar la imagen. Inténtalo de nuevo.');
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const terminateUserAccount = (userId: string) => {
    if (currentUser?.role !== 'creator') return;
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, isTerminated: true, blockedUntil: 'forever', blockReason: 'Terminación de cuenta por infracción crítica.' } : u));
  };

  const toggleVerifyUser = (userId: string) => {
    if (currentUser?.role !== 'creator') return;
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, isVerified: !u.isVerified } : u));
  };

  const toggleAdminRole = (userId: string) => {
    if (currentUser?.role !== 'creator') return;
    const target = users.find(u => u.id === userId);
    if (!target || target.username === 'portainfo') return;
    const newRole = target.role === 'creator' ? 'user' : 'creator';
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
  };

  const handleSendSanction = () => {
    if (currentUser?.role !== 'creator') return;
    const { userId, level, duration, unit, reason } = sanctionForm;
    const msMap = { hours: 3600000, days: 86400000, weeks: 604800000, months: 2592000000 };
    const blockedUntil = unit === 'forever' ? 'forever' : Date.now() + (duration * msMap[unit as keyof typeof msMap]);
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, blockedUntil, blockReason: reason } : u));
    setSanctionForm({ ...sanctionForm, reason: '', userId: '' });
  };

  const unblockUser = (userId: string) => {
    if (currentUser?.role !== 'creator') return;
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, blockedUntil: undefined, blockReason: '', isTerminated: false } : u));
  };

  const handleCreatePost = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!currentUser) return;
    const formData = new FormData(e.currentTarget);
    const description = formData.get('description') as string;
    
    // Extract hashtags
    const hashtags = description.match(/#\w+/g)?.map(tag => tag.slice(1)) || [];

    const newPost: Post = {
      id: Math.random().toString(36).substr(2, 9),
      authorId: currentUser.id,
      authorUsername: currentUser.username,
      authorAvatar: currentUser.avatar,
      title: formData.get('title') as string,
      description,
      image: postImagePreview || '',
      category: formData.get('category') as string || 'General',
      tags: hashtags,
      likes: 0,
      dislikes: 0,
      republications: 0,
      comments: [],
      createdAt: Date.now()
    };
    setPosts([newPost, ...posts]);
    setPostImagePreview(null);
    setActiveTab('home');
  };

  const handleFollow = (userId: string) => {
    if (!currentUser) { setIsAuthModalOpen(true); return; }
    if (userId === currentUser.id) return;
    const isFollowing = currentUser.following.includes(userId);
    const updatedFollowing = isFollowing ? currentUser.following.filter(id => id !== userId) : [...currentUser.following, userId];
    const updatedCurrentUser = { ...currentUser, following: updatedFollowing };
    setUsers(prev => prev.map(u => {
      if (u.id === currentUser.id) return updatedCurrentUser;
      if (u.id === userId) {
        if (!isFollowing) {
           addNotification(userId, { type: 'follow', fromUsername: currentUser.username, fromAvatar: currentUser.avatar, text: 'empezó a seguirte.' });
        }
        const updatedFollowers = isFollowing ? u.followers.filter(id => id !== currentUser.id) : [...u.followers, currentUser.id];
        return { ...u, followers: updatedFollowers };
      }
      return u;
    }));
    setCurrentUser(updatedCurrentUser);
  };

  const handleSendMessage = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!currentUser || !activeChatId) return;
    const formData = new FormData(e.currentTarget);
    const text = formData.get('message') as string;
    if (!text?.trim()) return;
    const newMessage: Message = { id: Math.random().toString(36).substr(2, 9), fromId: currentUser.id, toId: activeChatId, text: text.trim(), timestamp: Date.now() };
    setMessages(prev => [...prev, newMessage]);
    addNotification(activeChatId, { type: 'message', fromUsername: currentUser.username, fromAvatar: currentUser.avatar, targetId: currentUser.id, text: 'te envió un mensaje.' });
    e.currentTarget.reset();
  };

  const handlePostUpdate = (postId: string, updates: Partial<Post>) => {
    setPosts(prev => prev.map(p => {
       if (p.id === postId) {
          if (updates.likes && updates.likes > p.likes && currentUser) {
             addNotification(p.authorId, { type: 'like', fromUsername: currentUser.username, fromAvatar: currentUser.avatar, targetId: postId, text: 'dio like a tu post.' });
          }
          return { ...p, ...updates };
       }
       return p;
    }));
  };

  const handleDeletePost = (postId: string) => {
    if (window.confirm('¿Eliminar esta publicación?')) setPosts(prev => prev.filter(p => p.id !== postId));
  };

  const startEditing = () => { if (!currentUser) return; setEditForm({ username: currentUser.username, bio: currentUser.bio, avatar: currentUser.avatar }); setIsEditingProfile(true); };
  const saveProfileChanges = () => { if (!currentUser) return; const updatedUser = { ...currentUser, ...editForm }; setCurrentUser(updatedUser); setUsers(prev => prev.map(u => u.id === currentUser.id ? updatedUser : u)); setIsEditingProfile(false); };
  const viewUserProfile = (userId: string) => { setProfileViewId(userId); setIsEditingProfile(false); setActiveTab('profile'); };
  const startChat = (userId: string) => { if (!currentUser) return; setActiveChatId(userId); setActiveTab('messages'); };
  
  const filteredPosts = useMemo(() => {
    let list = posts;
    // Feed logic
    if (homeFeedTab === 'following' && currentUser) {
       list = list.filter(p => currentUser.following.includes(p.authorId));
    }
    // Category filter
    if (selectedCategory !== 'Todas') {
       list = list.filter(p => p.category === selectedCategory);
    }
    // Search filter
    if (searchQuery) {
       const q = searchQuery.toLowerCase();
       list = list.filter(p => 
          p.title.toLowerCase().includes(q) || 
          p.description.toLowerCase().includes(q) ||
          p.tags.some(t => t.toLowerCase().includes(q))
       );
    }
    // Block filter
    if (currentUser) {
       list = list.filter(p => !currentUser.blockedUsers.includes(p.authorId));
    }
    return list;
  }, [posts, searchQuery, currentUser, homeFeedTab, selectedCategory]);

  const unreadCount = useMemo(() => currentUser?.notifications.filter(n => !n.read).length || 0, [currentUser]);

  const navItems = [
    { id: 'home', icon: 'fa-home', label: 'Inicio' },
    { id: 'search', icon: 'fa-search', label: 'Buscar' },
    { id: 'notifications', icon: 'fa-bell', label: 'Notificaciones', badge: unreadCount },
    { id: 'messages', icon: 'fa-envelope', label: 'Mensajes' },
    { id: 'profile', icon: 'fa-user', label: 'Mi Perfil' },
    { id: 'creator', icon: 'fa-plus-circle', label: 'Crear Post' },
    ...(currentUser?.role === 'creator' ? [{ id: 'admin', icon: 'fa-shield-halved', label: 'Admin' }] : []),
  ];

  if (isUserEffectivelyBlocked) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 font-black overflow-hidden relative">
          <div className="absolute inset-0 bg-red-900/20 blur-[150px] animate-pulse"></div>
          {!isAppealViewOpen ? (
            <div className="max-w-4xl w-full bg-slate-900 border-4 border-red-600 rounded-[4rem] p-16 shadow-[0_0_100px_rgba(220,38,38,0.3)] z-10 animate-scale-in text-center">
              <div className="w-32 h-32 bg-red-600 rounded-[2.5rem] flex items-center justify-center text-white mx-auto mb-10 shadow-2xl shadow-red-900/50 animate-bounce-slow">
                <i className={`fas ${currentUser?.isTerminated ? 'fa-skull-crossbones' : 'fa-gavel'} text-6xl`}></i>
              </div>
              <h1 className="text-6xl md:text-8xl text-white mb-6 tracking-tighter leading-none">{currentUser?.isTerminated ? 'TERMINACIÓN TOTAL' : 'FUISTE BLOQUEADO'}</h1>
              <div className="bg-slate-800 p-10 rounded-[2.5rem] border-2 border-slate-700 mb-12 shadow-inner">
                <p className="text-slate-400 text-xs uppercase tracking-[0.5em] mb-4">Motivo</p>
                <p className="text-white text-2xl md:text-3xl italic">"{currentUser?.blockReason}"</p>
              </div>
              <div className="mb-16"><div className="text-7xl md:text-9xl text-white font-black tracking-tighter shadow-red-500/20 drop-shadow-2xl tabular-nums">{timeLeftStr}</div></div>
              <div className="flex flex-col gap-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <button onClick={() => setIsAppealViewOpen(true)} className="bg-white text-black py-6 rounded-[2.5rem] text-xl uppercase tracking-widest hover:bg-slate-200 transition-all active:scale-95 shadow-xl">Quejas</button>
                    <button onClick={handleLogout} className="bg-red-600 text-white py-6 rounded-[2.5rem] text-xl uppercase tracking-widest hover:bg-red-700 transition-all active:scale-95 shadow-xl">Salir</button>
                </div>
                {(currentUser?.blockedUntil === 'forever' || currentUser?.isTerminated) && (
                    <button onClick={handleSelfDeleteAccount} className="bg-transparent border-4 border-slate-700 text-slate-500 py-6 rounded-[2.5rem] text-xl uppercase tracking-widest hover:border-red-600 hover:text-red-500 transition-all">Eliminar mi cuenta definitivamente</button>
                )}
              </div>
            </div>
          ) : (
            <div className="max-w-2xl w-full bg-white rounded-[4rem] p-16 shadow-2xl z-10 animate-scale-in text-center">
                <h2 className="text-4xl text-slate-900 mb-10 tracking-tighter uppercase font-black">Enviar Queja</h2>
                <textarea value={appealText} onChange={(e) => setAppealText(e.target.value)} className="w-full h-64 bg-slate-50 border-4 border-slate-100 rounded-[2.5rem] p-8 text-xl font-bold text-slate-700 outline-none resize-none shadow-inner" placeholder="Escribe tu mensaje..."></textarea>
                <div className="flex gap-4 mt-10">
                  <button onClick={handleSendAppeal} className="flex-1 bg-indigo-600 text-white py-6 rounded-[2rem] text-xl uppercase tracking-widest font-black shadow-xl">Enviar</button>
                  <button onClick={() => setIsAppealViewOpen(false)} className="bg-slate-100 text-slate-400 px-10 rounded-[2rem] text-xl uppercase tracking-widest font-black">Cancelar</button>
                </div>
            </div>
          )}
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row transition-colors duration-300 dark:bg-slate-950 dark:text-slate-100">
      {/* Sidebar Nav */}
      <nav className="w-full md:w-64 bg-white dark:bg-slate-900 border-b md:border-r border-slate-200 dark:border-slate-800 p-4 sticky top-0 md:h-screen flex md:flex-col gap-2 z-30 shadow-sm overflow-y-auto">
        <div className="flex items-center gap-2 mb-6 hidden md:flex">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg"><i className="fas fa-info-circle text-xl"></i></div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Portainfo</h1>
        </div>
        
        <button 
          onClick={toggleTheme}
          className="flex items-center gap-4 px-4 py-3 rounded-xl transition-all text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 mb-2"
        >
          <i className={`fas ${theme === 'light' ? 'fa-moon' : 'fa-sun'} text-lg w-6`}></i>
          <span className="font-semibold hidden md:inline">{theme === 'light' ? 'Modo Oscuro' : 'Modo Claro'}</span>
        </button>

        {navItems.map(tab => (
          <button key={tab.id} onClick={() => { if (['messages', 'creator', 'admin', 'notifications'].includes(tab.id) && !currentUser) { setIsAuthModalOpen(true); return; } setActiveTab(tab.id as AppTab); if (tab.id === 'profile') { setProfileViewId(currentUser?.id || null); setIsEditingProfile(false); } if (tab.id === 'notifications' && currentUser) { setUsers(prev => prev.map(u => u.id === currentUser.id ? { ...u, notifications: u.notifications.map(n => ({...n, read: true})) } : u)); } }} className={`flex items-center gap-4 px-4 py-3 rounded-xl transition-all relative ${activeTab === tab.id ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 font-bold' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
            <i className={`fas ${tab.icon} text-lg w-6`}></i>
            <span className="font-semibold hidden md:inline">{tab.label}</span>
            {tab.badge && tab.badge > 0 ? <span className="absolute left-7 top-2 w-4 h-4 bg-red-600 text-white text-[10px] flex items-center justify-center rounded-full font-black border-2 border-white dark:border-slate-900">{tab.badge}</span> : null}
          </button>
        ))}
        
        <div className="mt-auto hidden md:block border-t border-slate-100 dark:border-slate-800 pt-4">
          {currentUser ? (
            <div className="p-2">
              <div className="flex items-center gap-3 mb-4"><img src={currentUser.avatar} className="w-10 h-10 rounded-full border-2 border-slate-100 dark:border-slate-700" /><div><p className="font-black text-slate-900 dark:text-white text-sm">@{currentUser.username}</p><p className="text-[10px] text-slate-400 uppercase tracking-widest">{currentUser.role}</p></div></div>
              <button onClick={handleLogout} className="w-full text-left text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 px-4 py-2 rounded-lg text-sm font-black transition-colors">Cerrar Sesión</button>
            </div>
          ) : <button onClick={() => setIsAuthModalOpen(true)} className="w-full bg-indigo-600 text-white px-4 py-3 rounded-xl font-black shadow-md">Unirse</button>}
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col bg-slate-50 dark:bg-slate-950 pb-20 md:pb-0 overflow-hidden">
        {/* Header for mobile or contextual info */}
        <header className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 p-4 sticky top-0 z-20 flex justify-between items-center md:hidden shadow-sm">
           <h1 className="text-xl font-bold text-indigo-600">Portainfo</h1>
           {currentUser && <img onClick={() => { setProfileViewId(currentUser.id); setActiveTab('profile'); setIsEditingProfile(false); }} src={currentUser.avatar} className="w-8 h-8 rounded-full border border-indigo-200" />}
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          {/* HOME TAB WITH FEEDS AND CATEGORIES */}
          {activeTab === 'home' && (
            <div className="max-w-2xl mx-auto space-y-6">
              {/* Feed Selection */}
              <div className="flex gap-8 border-b border-slate-200 dark:border-slate-800 mb-6">
                 <button 
                  onClick={() => setHomeFeedTab('discover')} 
                  className={`pb-4 px-2 font-black text-sm uppercase tracking-widest transition-all relative ${homeFeedTab === 'discover' ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`}
                 >
                   Descubrir
                   {homeFeedTab === 'discover' && <div className="absolute bottom-0 left-0 w-full h-1 bg-indigo-600 dark:bg-indigo-400 rounded-full"></div>}
                 </button>
                 <button 
                  onClick={() => { if(!currentUser) setIsAuthModalOpen(true); else setHomeFeedTab('following'); }} 
                  className={`pb-4 px-2 font-black text-sm uppercase tracking-widest transition-all relative ${homeFeedTab === 'following' ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`}
                 >
                   Siguiendo
                   {homeFeedTab === 'following' && <div className="absolute bottom-0 left-0 w-full h-1 bg-indigo-600 dark:bg-indigo-400 rounded-full"></div>}
                 </button>
              </div>

              {/* Category Filter Bar */}
              <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-hide">
                 {['Todas', ...CATEGORIES].map(cat => (
                   <button 
                    key={cat} 
                    onClick={() => setSelectedCategory(cat)}
                    className={`whitespace-nowrap px-6 py-2 rounded-full text-xs font-black uppercase tracking-widest transition-all border ${selectedCategory === cat ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-slate-900 dark:border-white shadow-lg' : 'bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:border-indigo-400'}`}
                   >
                     {cat}
                   </button>
                 ))}
              </div>

              {/* Posts Feed */}
              <div className="space-y-6">
                {filteredPosts.length === 0 ? (
                  <div className="text-center py-20 text-slate-300 dark:text-slate-700">
                    <i className="fas fa-ghost text-8xl mb-6 opacity-20"></i>
                    <p className="font-black uppercase tracking-widest">No hay nada que mostrar</p>
                  </div>
                ) : filteredPosts.map(post => {
                  const author = users.find(u => u.id === post.authorId);
                  return <PostCard key={post.id} post={post} currentUser={currentUser} isAuthorVerified={author?.isVerified} onUpdate={handlePostUpdate} onDelete={handleDeletePost} onUserClick={viewUserProfile} onInteractionError={() => setIsAuthModalOpen(true)} />;
                })}
              </div>
            </div>
          )}

          {/* SEARCH TAB WITH HASHTAGS */}
          {activeTab === 'search' && (
            <div className="max-w-2xl mx-auto">
              <div className="relative mb-12 group">
                 <i className="fas fa-search absolute left-6 top-1/2 -translate-y-1/2 text-slate-300"></i>
                 <input type="text" placeholder="Busca por título, hashtag (#tag) o usuario..." className="w-full bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 rounded-[2.5rem] py-6 pl-16 pr-8 focus:outline-none focus:ring-8 focus:ring-indigo-50 dark:focus:ring-indigo-900/20 shadow-sm text-xl font-bold dark:text-white" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
              </div>
              
              {!searchQuery ? (
                 <div className="space-y-10">
                    <h3 className="font-black text-2xl dark:text-white tracking-tight">Temas Populares</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                       {CATEGORIES.map(cat => (
                         <div key={cat} onClick={() => { setSelectedCategory(cat); setActiveTab('home'); }} className="bg-white dark:bg-slate-900 p-8 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer group">
                            <i className="fas fa-hashtag text-indigo-200 dark:text-indigo-800 text-4xl mb-4 group-hover:text-indigo-500 transition-colors"></i>
                            <p className="font-black text-slate-800 dark:text-white uppercase tracking-widest text-xs">{cat}</p>
                         </div>
                       ))}
                    </div>
                 </div>
              ) : (
                <div className="space-y-6">
                   <h3 className="font-black text-slate-400 uppercase tracking-widest text-xs">Usuarios encontrados</h3>
                   {users.filter(u => u.username.toLowerCase().includes(searchQuery.toLowerCase())).map(u => (
                      <div key={u.id} onClick={() => viewUserProfile(u.id)} className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-100 dark:border-slate-800 cursor-pointer flex items-center gap-4 shadow-sm hover:shadow-xl transition-all">
                         <img src={u.avatar} className="w-14 h-14 rounded-full object-cover border-4 border-slate-50 dark:border-slate-800" />
                         <div><h4 className="font-black text-slate-900 dark:text-white text-lg">@{u.username}{u.isVerified && <VerifiedBadge />}</h4></div>
                      </div>
                   ))}
                   <h3 className="font-black text-slate-400 uppercase tracking-widest text-xs mt-10">Publicaciones encontradas</h3>
                   {filteredPosts.map(post => {
                      const author = users.find(u => u.id === post.authorId);
                      return <PostCard key={post.id} post={post} currentUser={currentUser} isAuthorVerified={author?.isVerified} onUpdate={handlePostUpdate} onDelete={handleDeletePost} onUserClick={viewUserProfile} onInteractionError={() => setIsAuthModalOpen(true)} />;
                   })}
                </div>
              )}
            </div>
          )}

          {/* NOTIFICATIONS TAB */}
          {activeTab === 'notifications' && (
            <div className="max-w-2xl mx-auto space-y-4">
               <h2 className="text-4xl font-black text-slate-900 dark:text-white mb-10 tracking-tighter">Notificaciones</h2>
               {currentUser?.notifications.length === 0 && (
                  <div className="text-center py-20 text-slate-200 dark:text-slate-800">
                    <i className="fas fa-bell-slash text-8xl mb-6 opacity-20"></i>
                    <p className="font-black uppercase tracking-widest">Sin actividad reciente</p>
                  </div>
               )}
               {currentUser?.notifications.map(n => (
                 <div key={n.id} className={`flex items-center gap-4 p-6 rounded-3xl shadow-sm border transition-all ${n.read ? 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 opacity-60' : 'bg-indigo-50/50 dark:bg-indigo-900/10 border-indigo-100 dark:border-indigo-900/30'}`}>
                    <img src={n.fromAvatar} className="w-12 h-12 rounded-2xl object-cover border-4 border-white dark:border-slate-800 shadow-md" />
                    <div className="flex-1">
                       <p className="font-bold text-slate-800 dark:text-slate-200"><span className="font-black">@{n.fromUsername}</span> {n.text}</p>
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">{new Date(n.timestamp).toLocaleString()}</p>
                    </div>
                    {n.type === 'message' && <button onClick={() => startChat(n.targetId!)} className="bg-indigo-600 text-white px-6 py-2 rounded-xl font-black text-xs uppercase shadow-lg hover:bg-indigo-700 transition-all">Responder</button>}
                 </div>
               ))}
            </div>
          )}

          {/* CREATOR TAB WITH AI GENERATION AND TAGS */}
          {activeTab === 'creator' && currentUser && (
            <div className="max-w-4xl mx-auto animate-fade-in">
               <div className="bg-white dark:bg-slate-900 p-12 rounded-[4rem] border border-slate-100 dark:border-slate-800 shadow-2xl relative overflow-hidden">
                  <h2 className="text-5xl font-black text-slate-900 dark:text-white mb-10 tracking-tighter">Crear Post</h2>
                  <form onSubmit={handleCreatePost} className="space-y-10">
                    <div>
                       <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 px-4">Título del artículo</label>
                       <input name="title" required className="w-full bg-slate-50 dark:bg-slate-950 border-none rounded-[2rem] px-8 py-5 font-black text-2xl text-slate-900 dark:text-white shadow-inner outline-none focus:ring-4 focus:ring-indigo-100 dark:focus:ring-indigo-900/20" />
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                       <div>
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 px-4">Categoría</label>
                          <select name="category" className="w-full bg-slate-50 dark:bg-slate-950 border-none rounded-[1.5rem] px-8 py-5 font-black text-slate-700 dark:text-slate-300 shadow-inner outline-none">
                             {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                       </div>
                       <div>
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 px-4">Etiquetas (Usa # en la descripción)</label>
                          <div className="px-8 py-5 text-slate-300 dark:text-slate-700 font-bold text-sm bg-slate-50 dark:bg-slate-950 rounded-[1.5rem] shadow-inner italic">
                             Portainfo detectará automáticamente tus hashtags.
                          </div>
                       </div>
                    </div>

                    <div>
                       <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 px-4">Contenido</label>
                       <textarea name="description" required rows={8} className="w-full bg-slate-50 dark:bg-slate-950 border-none rounded-[2rem] px-8 py-5 font-bold text-slate-600 dark:text-slate-300 shadow-inner outline-none resize-none focus:ring-4 focus:ring-indigo-100 dark:focus:ring-indigo-900/20" placeholder="Escribe tu historia aquí... Puedes usar #hashtags" />
                    </div>

                    <div className="bg-slate-50 dark:bg-slate-950 p-8 rounded-[3rem] border-2 border-slate-100 dark:border-slate-800 space-y-6">
                       <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-4">Visualización</label>
                       <div className="flex flex-col gap-6">
                          <div className="flex gap-4">
                             <input value={imagePrompt} onChange={e => setImagePrompt(e.target.value)} placeholder="Describe qué imagen quieres generar con IA..." className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-6 py-4 font-bold shadow-sm outline-none focus:ring-4 focus:ring-indigo-100 dark:focus:ring-indigo-900/20 dark:text-white" />
                             <button type="button" onClick={handleGenerateAIImage} disabled={isGeneratingImage} className={`bg-indigo-600 text-white px-8 py-4 rounded-2xl font-black uppercase text-xs shadow-xl transition-all ${isGeneratingImage ? 'opacity-50 cursor-wait' : 'hover:scale-105 active:scale-95'}`}>
                                {isGeneratingImage ? <i className="fas fa-spinner fa-spin mr-2"></i> : <i className="fas fa-wand-magic-sparkles mr-2"></i>} Generar
                             </button>
                          </div>
                          <div className="flex items-center gap-4 text-slate-300 dark:text-slate-700">
                             <div className="flex-1 h-[1px] bg-slate-200 dark:bg-slate-800"></div><span className="text-[10px] font-black uppercase tracking-widest">O CARGA MANUAL</span><div className="flex-1 h-[1px] bg-slate-200 dark:bg-slate-800"></div>
                          </div>
                          <button type="button" onClick={() => postFileRef.current?.click()} className="w-full h-56 border-4 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl flex flex-col items-center justify-center text-slate-300 hover:text-indigo-400 hover:border-indigo-200 transition-all font-black uppercase text-[10px] tracking-widest bg-white dark:bg-slate-900 group">
                             {postImagePreview ? <img src={postImagePreview} className="w-full h-full object-cover rounded-[1.4rem]" /> : <><i className="fas fa-cloud-upload text-4xl mb-4 group-hover:scale-110 transition-transform"></i>Seleccionar archivo</>}
                          </button>
                          <input type="file" ref={postFileRef} onChange={e => { const f = e.target.files?.[0]; if(f) fileToBase64(f).then(b => setPostImagePreview(b)) }} accept="image/*" className="hidden" />
                       </div>
                    </div>
                    <button type="submit" className="w-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 py-8 rounded-[3rem] font-black text-2xl shadow-2xl uppercase tracking-widest hover:bg-indigo-600 dark:hover:bg-indigo-100 transition-all active:scale-95">Publicar en Portainfo</button>
                  </form>
               </div>
            </div>
          )}

          {/* ADMIN TAB */}
          {activeTab === 'admin' && currentUser?.role === 'creator' && (
             <div className="max-w-6xl mx-auto space-y-8 animate-fade-in">
                <div className="flex bg-white dark:bg-slate-900 rounded-2xl p-1.5 shadow-sm border border-slate-200 dark:border-slate-800 w-fit">
                    <button onClick={() => setActiveAdminSubTab('verification')} className={`px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-[0.1em] transition-all ${activeAdminSubTab === 'verification' ? 'bg-indigo-600 text-white' : 'text-slate-400 dark:text-slate-500'}`}>Verificación</button>
                    <button onClick={() => setActiveAdminSubTab('sanctions')} className={`px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-[0.1em] transition-all ${activeAdminSubTab === 'sanctions' ? 'bg-red-600 text-white' : 'text-slate-400 dark:text-slate-500'}`}>Sanciones</button>
                    <button onClick={() => setActiveAdminSubTab('admins')} className={`px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-[0.1em] transition-all ${activeAdminSubTab === 'admins' ? 'bg-slate-900 dark:bg-slate-800 text-white' : 'text-slate-400 dark:text-slate-500'}`}>Admins</button>
                </div>
                {/* Simplified verification table for brevity */}
                <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
                   <div className="p-10 bg-indigo-600 text-white flex justify-between items-center">
                      <h2 className="text-4xl font-black tracking-tighter">Administración Global</h2>
                      <i className="fas fa-shield-alt text-4xl opacity-40"></i>
                   </div>
                   <div className="p-4 overflow-x-auto">
                      <table className="w-full">
                         <thead className="bg-slate-50 dark:bg-slate-800/50 border-b dark:border-slate-800">
                            <tr>
                               <th className="px-8 py-4 text-left font-black text-[10px] uppercase text-slate-400">Usuario</th>
                               <th className="px-8 py-4 text-center font-black text-[10px] uppercase text-slate-400">Rol</th>
                               <th className="px-8 py-4 text-right font-black text-[10px] uppercase text-slate-400">Control</th>
                            </tr>
                         </thead>
                         <tbody>
                            {users.map(u => (
                               <tr key={u.id} className="border-b dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                                  <td className="px-8 py-5 flex items-center gap-4">
                                     <img src={u.avatar} className="w-12 h-12 rounded-2xl border-2 border-white dark:border-slate-700" />
                                     <div className="overflow-hidden">
                                        <p className="font-black dark:text-white truncate">@{u.username}{u.isVerified && <VerifiedBadge />}</p>
                                        <p className="text-[10px] text-slate-400 uppercase tracking-widest">{u.followers.length} Seguidores</p>
                                     </div>
                                  </td>
                                  <td className="px-8 py-5 text-center">
                                     <span className={`px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${u.role === 'creator' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'}`}>{u.role}</span>
                                  </td>
                                  <td className="px-8 py-5 text-right flex justify-end gap-2">
                                     {activeAdminSubTab === 'verification' && <button onClick={() => toggleVerifyUser(u.id)} className={`px-6 py-2 rounded-xl font-black text-[10px] uppercase shadow-md ${u.isVerified ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>{u.isVerified ? 'Revocar' : 'Verificar'}</button>}
                                     {activeAdminSubTab === 'admins' && <button disabled={u.username === 'portainfo'} onClick={() => toggleAdminRole(u.id)} className={`px-6 py-2 rounded-xl font-black text-[10px] uppercase shadow-md disabled:opacity-20 ${u.role === 'creator' ? 'bg-red-600 text-white' : 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'}`}>{u.role === 'creator' ? 'Quitar Admin' : 'Hacer Admin'}</button>}
                                     {activeAdminSubTab === 'sanctions' && <button onClick={() => terminateUserAccount(u.id)} className="bg-red-600 text-white px-6 py-2 rounded-xl font-black text-[10px] uppercase shadow-md hover:bg-red-800">Eliminar</button>}
                                  </td>
                               </tr>
                            ))}
                         </tbody>
                      </table>
                   </div>
                </div>
             </div>
          )}

          {/* PROFILE TAB */}
          {activeTab === 'profile' && (
             <div className="max-w-4xl mx-auto space-y-10 animate-fade-in">
                {(() => {
                  const userToView = users.find(u => u.id === (profileViewId || currentUser?.id)) || currentUser;
                  if (!userToView) return null;
                  const isOwn = userToView.id === currentUser?.id;
                  const userOwnedPosts = posts.filter(p => p.authorId === userToView.id);
                  const userLikedPosts = posts.filter(p => userToView.likedPosts.includes(p.id));
                  
                  return (
                    <div className="space-y-10">
                       <div className="bg-white dark:bg-slate-900 rounded-[3.5rem] border border-slate-200 dark:border-slate-800 overflow-hidden shadow-2xl relative">
                          <div className={`h-48 bg-gradient-to-r ${theme === 'light' ? 'from-indigo-600 to-purple-600' : 'from-slate-800 to-slate-950'}`}></div>
                          <div className="px-12 pb-12">
                             <div className="flex justify-between items-end -translate-y-20">
                                <img src={userToView.avatar} className="w-44 h-44 rounded-[4rem] border-[12px] border-white dark:border-slate-900 shadow-2xl bg-white dark:bg-slate-950 object-cover" />
                                <div className="flex gap-4 mb-4">
                                   {isOwn ? (
                                      <button onClick={startEditing} className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-10 py-4 rounded-[2rem] font-black uppercase text-xs shadow-xl transition-all hover:scale-105 active:scale-95">Editar Perfil</button>
                                   ) : (
                                      <button onClick={() => handleFollow(userToView.id)} className={`px-10 py-4 rounded-[2rem] font-black uppercase text-xs shadow-xl transition-all hover:scale-105 active:scale-95 ${currentUser?.following.includes(userToView.id) ? 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400' : 'bg-indigo-600 text-white'}`}>
                                         {currentUser?.following.includes(userToView.id) ? 'Siguiendo' : 'Seguir'}
                                      </button>
                                   )}
                                   {!isOwn && <button onClick={() => startChat(userToView.id)} className="w-16 h-16 rounded-[2rem] bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 flex items-center justify-center shadow-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"><i className="fas fa-envelope text-xl"></i></button>}
                                </div>
                             </div>
                             <div className="-mt-16">
                                <h2 className="text-5xl font-black text-slate-900 dark:text-white tracking-tighter">@{userToView.username}{userToView.isVerified && <VerifiedBadge />}</h2>
                                <p className="mt-4 text-slate-600 dark:text-slate-400 font-bold text-xl italic leading-relaxed">"{userToView.bio || "Este usuario prefiere mantener el misterio."}"</p>
                                <div className="flex gap-10 mt-10">
                                   <div><span className="text-3xl font-black dark:text-white">{userToView.followers.length}</span><p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mt-1">Seguidores</p></div>
                                   <div><span className="text-3xl font-black dark:text-white">{userToView.following.length}</span><p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mt-1">Siguiendo</p></div>
                                </div>
                             </div>
                          </div>
                       </div>

                       <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                          <div className="bg-white dark:bg-slate-900 rounded-[3rem] p-8 border border-slate-100 dark:border-slate-800 shadow-xl">
                             <h3 className="font-black text-2xl dark:text-white mb-6 flex items-center gap-3"><i className="fas fa-scroll text-indigo-500"></i> Publicaciones</h3>
                             <div className="grid grid-cols-2 gap-4">
                                {userOwnedPosts.map(p => (
                                   <div key={p.id} onClick={() => { setActiveTab('home'); setSelectedCategory(p.category); }} className="aspect-square rounded-3xl overflow-hidden shadow-md cursor-pointer group">
                                      <img src={p.image} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                                   </div>
                                ))}
                                {userOwnedPosts.length === 0 && <p className="col-span-2 text-center text-slate-400 py-10 font-bold uppercase text-[10px] tracking-widest">Sin publicaciones aún</p>}
                             </div>
                          </div>
                          
                          <div className="bg-white dark:bg-slate-900 rounded-[3rem] p-8 border border-slate-100 dark:border-slate-800 shadow-xl">
                             <h3 className="font-black text-2xl dark:text-white mb-6 flex items-center gap-3"><i className="fas fa-heart text-red-500"></i> Me gusta {isOwn && <span className="text-[10px] text-slate-300 ml-2">(Privado)</span>}</h3>
                             <div className="grid grid-cols-2 gap-4">
                                {userLikedPosts.map(p => (
                                   <div key={p.id} onClick={() => { setActiveTab('home'); setSearchQuery(p.title); }} className="aspect-square rounded-3xl overflow-hidden shadow-md cursor-pointer group">
                                      <img src={p.image} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                                   </div>
                                ))}
                                {userLikedPosts.length === 0 && <p className="col-span-2 text-center text-slate-400 py-10 font-bold uppercase text-[10px] tracking-widest">Sin likes aún</p>}
                             </div>
                          </div>
                       </div>
                    </div>
                  );
                })()}
             </div>
          )}

          {/* MESSAGES TAB */}
          {activeTab === 'messages' && currentUser && (
             <div className="max-w-6xl mx-auto h-[calc(100vh-160px)] bg-white dark:bg-slate-900 rounded-[3rem] shadow-2xl border dark:border-slate-800 flex overflow-hidden">
                <div className="w-1/3 border-r dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20">
                   <div className="p-8 border-b dark:border-slate-800"><h3 className="font-black text-2xl dark:text-white">Puerto Seguro</h3></div>
                   <div className="overflow-y-auto">
                      {users.filter(u => u.id !== currentUser.id).map(u => (
                         <button key={u.id} onClick={() => setActiveChatId(u.id)} className={`w-full p-6 flex items-center gap-4 hover:bg-white dark:hover:bg-slate-800/50 border-b dark:border-slate-800 transition-all ${activeChatId === u.id ? 'bg-white dark:bg-slate-800 border-l-8 border-indigo-600' : ''}`}>
                            <img src={u.avatar} className="w-14 h-14 rounded-2xl object-cover shadow-sm border-2 border-white dark:border-slate-700" />
                            <div className="text-left overflow-hidden">
                               <p className="font-black dark:text-white truncate">@{u.username}{u.isVerified && <VerifiedBadge />}</p>
                            </div>
                         </button>
                      ))}
                   </div>
                </div>
                <div className="flex-1 flex flex-col bg-white dark:bg-slate-900">
                   {activeChatId ? (
                      <>
                         <div className="p-6 border-b dark:border-slate-800 flex items-center gap-4 bg-slate-50/30 dark:bg-slate-950/30">
                            <img src={users.find(u => u.id === activeChatId)?.avatar} className="w-10 h-10 rounded-xl" />
                            <span className="font-black dark:text-white text-xl">@{users.find(u => u.id === activeChatId)?.username}</span>
                         </div>
                         <div className="flex-1 overflow-y-auto p-8 space-y-6">
                            {messages.filter(m => (m.fromId === currentUser.id && m.toId === activeChatId) || (m.fromId === activeChatId && m.toId === currentUser.id)).map(m => (
                               <div key={m.id} className={`flex ${m.fromId === currentUser.id ? 'justify-end' : 'justify-start'}`}>
                                  <div className={`max-w-[75%] p-5 rounded-[2rem] shadow-sm text-sm font-bold leading-relaxed ${m.fromId === currentUser.id ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-tl-none border dark:border-slate-700'}`}>
                                     {m.text}
                                  </div>
                               </div>
                            ))}
                         </div>
                         <form onSubmit={handleSendMessage} className="p-6 border-t dark:border-slate-800 flex gap-4 bg-slate-50/50 dark:bg-slate-950/20">
                            <input name="message" className="flex-1 bg-white dark:bg-slate-800 rounded-2xl px-6 py-4 font-bold outline-none border dark:border-slate-700 dark:text-white focus:ring-4 focus:ring-indigo-50 dark:focus:ring-indigo-900/10" placeholder="Escribe un mensaje secreto..." />
                            <button className="bg-indigo-600 text-white w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg hover:bg-indigo-700 transition-all active:scale-90"><i className="fas fa-paper-plane"></i></button>
                         </form>
                      </>
                   ) : (
                      <div className="flex-1 flex flex-col items-center justify-center text-slate-200 dark:text-slate-800">
                         <i className="far fa-comments text-[10rem] mb-10 opacity-10"></i>
                         <p className="font-black uppercase tracking-[0.5em] text-xs">Abre el canal de comunicación</p>
                      </div>
                   )}
                </div>
             </div>
          )}
        </div>
      </main>

      {/* AUTH MODAL */}
      {isAuthModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/95 backdrop-blur-2xl" onClick={() => setIsAuthModalOpen(false)}></div>
          <div className="relative bg-white dark:bg-slate-900 w-full max-w-lg rounded-[4rem] p-16 shadow-[0_0_100px_rgba(0,0,0,0.5)] animate-scale-in text-center">
            <div className="w-24 h-24 bg-indigo-600 rounded-[2.5rem] flex items-center justify-center text-white shadow-2xl mx-auto mb-10 transform -rotate-12"><i className="fas fa-info-circle text-5xl"></i></div>
            <h2 className="text-4xl font-black text-slate-900 dark:text-white mb-10 tracking-tighter uppercase">{authMode === 'login' ? 'Conectar' : 'Registrar'}</h2>
            {authError && <div className="mb-8 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-5 rounded-2xl text-xs font-black uppercase tracking-widest">{authError}</div>}
            <div className="space-y-6">
               <input className="w-full bg-slate-50 dark:bg-slate-950 rounded-[2rem] px-8 py-6 font-black outline-none border-2 border-transparent focus:border-indigo-200 dark:focus:border-indigo-900 dark:text-white shadow-inner" placeholder="Alias de Portainfo" value={authForm.username} onChange={e => setAuthForm({ ...authForm, username: e.target.value })} />
               <input type="password" className="w-full bg-slate-50 dark:bg-slate-950 rounded-[2rem] px-8 py-6 font-black outline-none border-2 border-transparent focus:border-indigo-200 dark:focus:border-indigo-900 dark:text-white shadow-inner" placeholder="Clave de acceso" value={authForm.password} onChange={e => setAuthForm({ ...authForm, password: e.target.value })} />
               <button onClick={handleAuth} className="w-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 py-7 rounded-[2.5rem] font-black uppercase text-xl shadow-2xl hover:scale-105 active:scale-95 transition-all mt-6">Acceder al Sistema</button>
               <button onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')} className="text-indigo-600 dark:text-indigo-400 font-black uppercase text-[10px] tracking-[0.3em] mt-10 hover:underline">{authMode === 'login' ? '¿Sin cuenta? Crea una aquí' : 'Ya tengo mis credenciales'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
