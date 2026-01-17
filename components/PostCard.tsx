
import React, { useState } from 'react';
import { Post, User } from '../types';
import { speakText } from '../services/geminiService';

interface PostCardProps {
  post: Post;
  currentUser: User | null;
  isAuthorVerified?: boolean;
  onUpdate: (postId: string, updates: Partial<Post>) => void;
  onDelete: (postId: string) => void;
  onUserClick: (userId: string) => void;
  onInteractionError: () => void;
}

const VerifiedBadge = () => (
  <i className="fas fa-check-circle text-blue-500 ml-1 shadow-sm" title="Usuario Verificado"></i>
);

export const PostCard: React.FC<PostCardProps> = ({ 
  post, 
  currentUser, 
  isAuthorVerified,
  onUpdate, 
  onDelete,
  onUserClick,
  onInteractionError 
}) => {
  const [commentText, setCommentText] = useState('');
  const [showComments, setShowComments] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const handleAction = (type: 'like' | 'dislike' | 'republish') => {
    if (!currentUser) {
      onInteractionError();
      return;
    }

    let newLikes = post.likes;
    let newDislikes = post.dislikes;
    let newRepublications = post.republications;

    const hasLiked = currentUser.likedPosts.includes(post.id);
    const hasDisliked = currentUser.dislikedPosts.includes(post.id);
    const hasRepublished = currentUser.republishedPosts.includes(post.id);

    if (type === 'like') {
      if (hasLiked) {
        newLikes--;
        currentUser.likedPosts = currentUser.likedPosts.filter(id => id !== post.id);
      } else {
        newLikes++;
        currentUser.likedPosts.push(post.id);
        if (hasDisliked) {
          newDislikes--;
          currentUser.dislikedPosts = currentUser.dislikedPosts.filter(id => id !== post.id);
        }
      }
    } else if (type === 'dislike') {
      if (hasDisliked) {
        newDislikes--;
        currentUser.dislikedPosts = currentUser.dislikedPosts.filter(id => id !== post.id);
      } else {
        newDislikes++;
        currentUser.dislikedPosts.push(post.id);
        if (hasLiked) {
          newLikes--;
          currentUser.likedPosts = currentUser.likedPosts.filter(id => id !== post.id);
        }
      }
    } else if (type === 'republish') {
      if (hasRepublished) {
        newRepublications--;
        currentUser.republishedPosts = currentUser.republishedPosts.filter(id => id !== post.id);
      } else {
        newRepublications++;
        currentUser.republishedPosts.push(post.id);
      }
    }

    onUpdate(post.id, { likes: newLikes, dislikes: newDislikes, republications: newRepublications });
  };

  const handleAddComment = () => {
    if (!currentUser) {
      onInteractionError();
      return;
    }
    if (!commentText.trim()) return;

    const newComment = {
      id: Math.random().toString(36).substr(2, 9),
      authorId: currentUser.id,
      authorUsername: currentUser.username,
      authorAvatar: currentUser.avatar,
      text: commentText,
      createdAt: Date.now()
    };

    onUpdate(post.id, { comments: [...post.comments, newComment] });
    setCommentText('');
  };

  const handleListen = async () => {
    if (isSpeaking) return;
    setIsSpeaking(true);
    await speakText(`${post.title}. ${post.description}`);
    setIsSpeaking(false);
  };

  const hasLiked = currentUser?.likedPosts.includes(post.id);
  const hasDisliked = currentUser?.dislikedPosts.includes(post.id);
  const hasRepublished = currentUser?.republishedPosts.includes(post.id);
  const isAuthor = currentUser?.id === post.authorId;
  const isAdmin = currentUser?.username === 'portainfo';

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden mb-8 relative group hover:shadow-2xl transition-all duration-500">
      {/* Category Ribbon */}
      <div className="absolute top-4 right-4 z-10">
         <span className="bg-indigo-600/90 backdrop-blur-md text-white text-[10px] font-black px-4 py-1 rounded-full uppercase tracking-widest shadow-lg">
            {post.category}
         </span>
      </div>

      {/* Header */}
      <div className="p-6 flex items-center gap-4">
        <img 
          src={post.authorAvatar} 
          alt={post.authorUsername} 
          className="w-12 h-12 rounded-2xl cursor-pointer hover:opacity-80 transition-all object-cover shadow-md border-2 border-white dark:border-slate-800"
          onClick={() => onUserClick(post.authorId)}
        />
        <div>
          <h4 
            className="font-black text-slate-900 dark:text-white cursor-pointer hover:underline flex items-center gap-1 tracking-tight"
            onClick={() => onUserClick(post.authorId)}
          >
            @{post.authorUsername}
            {isAuthorVerified && <VerifiedBadge />}
          </h4>
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{new Date(post.createdAt).toLocaleDateString()}</span>
        </div>
        
        <div className="ml-auto flex items-center gap-2">
          <button 
            onClick={handleListen}
            disabled={isSpeaking}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${isSpeaking ? 'bg-indigo-600 text-white animate-pulse shadow-lg shadow-indigo-200 dark:shadow-indigo-900/40' : 'bg-slate-50 dark:bg-slate-800 text-slate-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:text-indigo-600'}`}
            title="Escuchar (AI TTS)"
          >
            <i className={`fas ${isSpeaking ? 'fa-spinner fa-spin' : 'fa-volume-up'}`}></i>
          </button>
          
          {(isAuthor || isAdmin) && (
            <button 
              onClick={() => onDelete(post.id)}
              className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-400 hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-600 flex items-center justify-center transition-all shadow-sm"
              title="Borrar"
            >
              <i className="fas fa-trash-alt"></i>
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="px-6 py-2">
        <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-4 tracking-tighter leading-none">{post.title}</h3>
        <p className="text-slate-600 dark:text-slate-400 font-medium leading-relaxed mb-6 whitespace-pre-wrap">{post.description}</p>
        
        {/* Tags */}
        <div className="flex flex-wrap gap-2 mb-6">
           {post.tags.map(tag => (
             <span key={tag} className="text-[10px] font-black text-indigo-500 dark:text-indigo-400 uppercase tracking-widest bg-indigo-50 dark:bg-indigo-900/20 px-3 py-1 rounded-lg">
                #{tag}
             </span>
           ))}
        </div>
      </div>

      {post.image && (
        <div className="px-6 pb-6">
           <img src={post.image} alt={post.title} className="w-full h-auto max-h-[600px] object-cover rounded-[2rem] shadow-2xl border-4 border-white dark:border-slate-800" />
        </div>
      )}

      {/* Footer Interactions */}
      <div className="p-6 flex items-center gap-8 border-t border-slate-50 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-900/30">
        <button 
          onClick={() => handleAction('like')}
          className={`flex items-center gap-3 text-xs font-black uppercase tracking-widest transition-all ${hasLiked ? 'text-indigo-600 dark:text-indigo-400 transform scale-110' : 'text-slate-400 hover:text-indigo-600'}`}
        >
          <i className={`${hasLiked ? 'fas' : 'far'} fa-thumbs-up text-xl`}></i>
          <span>{post.likes}</span>
        </button>
        <button 
          onClick={() => handleAction('dislike')}
          className={`flex items-center gap-3 text-xs font-black uppercase tracking-widest transition-all ${hasDisliked ? 'text-red-600 transform scale-110' : 'text-slate-400 hover:text-red-600'}`}
        >
          <i className={`${hasDisliked ? 'fas' : 'far'} fa-thumbs-down text-xl`}></i>
          <span>{post.dislikes}</span>
        </button>
        <button 
          onClick={() => handleAction('republish')}
          className={`flex items-center gap-3 text-xs font-black uppercase tracking-widest transition-all ${hasRepublished ? 'text-green-600 transform scale-110' : 'text-slate-400 hover:text-green-600'}`}
        >
          <i className="fas fa-retweet text-xl"></i>
          <span>{post.republications}</span>
        </button>
        <button 
          onClick={() => setShowComments(!showComments)}
          className={`ml-auto flex items-center gap-3 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-indigo-600 transition-all`}
        >
          <i className="far fa-comment text-xl"></i>
          <span>{post.comments.length}</span>
        </button>
      </div>

      {/* Comment Section */}
      {showComments && (
        <div className="bg-slate-50 dark:bg-slate-950/50 border-t border-slate-100 dark:border-slate-800 p-8 space-y-8">
          {currentUser && (
            <div className="flex gap-4">
              <input 
                type="text" 
                placeholder="Añadir comentario público..."
                className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-6 py-4 text-sm font-bold shadow-sm focus:outline-none focus:ring-4 focus:ring-indigo-100 dark:focus:ring-indigo-900/20 dark:text-white"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddComment()}
              />
              <button 
                onClick={handleAddComment}
                className="bg-slate-900 dark:bg-indigo-600 text-white px-8 py-4 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-indigo-600 transition-all active:scale-95 shadow-lg"
              >
                Enviar
              </button>
            </div>
          )}
          
          <div className="space-y-6">
            {post.comments.length === 0 && (
              <div className="text-center text-slate-300 dark:text-slate-700 py-10">
                 <i className="far fa-comment-dots text-4xl mb-2"></i>
                 <p className="font-black uppercase text-[10px] tracking-widest">Aún no hay conversaciones</p>
              </div>
            )}
            {post.comments.sort((a, b) => b.createdAt - a.createdAt).map(comment => (
              <div key={comment.id} className="flex gap-4 group/comment">
                <img src={comment.authorAvatar} alt={comment.authorUsername} className="w-10 h-10 rounded-2xl flex-shrink-0 object-cover shadow-sm border-2 border-white dark:border-slate-800" />
                <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl shadow-sm flex-1 border border-slate-100 dark:border-slate-800">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[10px] font-black text-slate-900 dark:text-white uppercase tracking-widest">@{comment.authorUsername}</span>
                    <span className="text-[10px] font-black text-slate-400 uppercase">{new Date(comment.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                  </div>
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300 leading-relaxed">{comment.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
