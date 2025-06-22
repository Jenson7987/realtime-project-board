import React, { useState, useEffect } from 'react';
import { API_BASE_URL } from '../config';
import { useAuth } from '../contexts/AuthContext';
import { User } from '../types';

interface ShareBoardModalProps {
  boardId: string;
  boardTitle: string;
  isOpen: boolean;
  onClose: () => void;
}

const ShareBoardModal: React.FC<ShareBoardModalProps> = ({
  boardId,
  boardTitle,
  isOpen,
  onClose
}) => {
  const { token, user } = useAuth();
  const [shareInput, setShareInput] = useState('');
  const [isSharing, setIsSharing] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [shareSuccess, setShareSuccess] = useState<string | null>(null);
  const [collaborators, setCollaborators] = useState<User[]>([]);
  const [owner, setOwner] = useState<User | null>(null);
  const [isLoadingCollaborators, setIsLoadingCollaborators] = useState(false);
  const [isRemoving, setIsRemoving] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && boardId) {
      fetchCollaborators();
    }
  }, [isOpen, boardId]);

  const fetchCollaborators = async () => {
    if (!token || !boardId) return;
    
    setIsLoadingCollaborators(true);
    try {
      const response = await fetch(`${API_BASE_URL}/boards/${boardId}/collaborators`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!response.ok) throw new Error('Failed to fetch collaborators');
      
      const data = await response.json();
      setOwner(data.owner);
      setCollaborators(data.collaborators);
    } catch (error) {
      console.error('Error fetching collaborators:', error);
    } finally {
      setIsLoadingCollaborators(false);
    }
  };

  const handleShare = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shareInput.trim() || !token) return;

    setIsSharing(true);
    setShareError(null);
    setShareSuccess(null);

    try {
      const input = shareInput.trim();
      const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input);
      
      const requestBody = isEmail 
        ? { email: input }
        : { username: input };

      const response = await fetch(`${API_BASE_URL}/boards/${boardId}/share`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(requestBody)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to share board');
      }

      setShareSuccess(data.message);
      setShareInput('');
      fetchCollaborators(); // Refresh collaborators list
    } catch (error) {
      setShareError(error instanceof Error ? error.message : 'Failed to share board');
    } finally {
      setIsSharing(false);
    }
  };

  const handleRemoveCollaborator = async (userId: string, username: string) => {
    if (!token) return;

    if (!window.confirm(`Are you sure you want to remove @${username} from this board?`)) {
      return;
    }

    setIsRemoving(userId);
    try {
      const response = await fetch(`${API_BASE_URL}/boards/${boardId}/share/${userId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to remove collaborator');
      }

      fetchCollaborators(); // Refresh collaborators list
    } catch (error) {
      console.error('Error removing collaborator:', error);
      alert(error instanceof Error ? error.message : 'Failed to remove collaborator');
    } finally {
      setIsRemoving(null);
    }
  };

  const isOwner = owner?._id === user?.id;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 max-h-[90vh] overflow-hidden">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-semibold text-gray-900">Share Board</h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="mb-6">
            <h4 className="font-medium text-gray-900 mb-2">{boardTitle}</h4>
            <p className="text-sm text-gray-600">Share this board with team members to collaborate in real-time.</p>
          </div>

          {/* Share Form */}
          {isOwner && (
            <form onSubmit={handleShare} className="mb-6">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={shareInput}
                  onChange={(e) => setShareInput(e.target.value)}
                  placeholder="Enter username or email"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={isSharing}
                />
                <button
                  type="submit"
                  disabled={!shareInput.trim() || isSharing}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isSharing ? 'Sharing...' : 'Share'}
                </button>
              </div>
              
              <p className="text-xs text-gray-500 mt-2">
                Enter a username (e.g., "john") or email address (e.g., "john@example.com")
              </p>
              
              {shareError && (
                <p className="text-red-500 text-sm mt-2">{shareError}</p>
              )}
              
              {shareSuccess && (
                <p className="text-green-600 text-sm mt-2">{shareSuccess}</p>
              )}
            </form>
          )}

          {/* Collaborators List */}
          <div className="space-y-4">
            <h4 className="font-medium text-gray-900">People with access</h4>
            
            {isLoadingCollaborators ? (
              <div className="flex items-center justify-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
              </div>
            ) : (
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {/* Owner */}
                {owner && (
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                        <span className="text-white text-sm font-semibold">
                          {owner.firstName?.[0]}{owner.lastName?.[0]}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">
                          {owner.firstName} {owner.lastName}
                        </p>
                        <p className="text-sm text-gray-500">@{owner.username} • Owner</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Collaborators */}
                {collaborators.map((collaborator) => (
                  <div key={collaborator._id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-gradient-to-r from-green-500 to-green-600 rounded-full flex items-center justify-center">
                        <span className="text-white text-sm font-semibold">
                          {collaborator.firstName?.[0]}{collaborator.lastName?.[0]}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">
                          {collaborator.firstName} {collaborator.lastName}
                        </p>
                        <p className="text-sm text-gray-500">@{collaborator.username} • Collaborator</p>
                      </div>
                    </div>
                    {isOwner && (
                      <button
                        onClick={() => handleRemoveCollaborator(collaborator._id, collaborator.username)}
                        disabled={isRemoving === collaborator._id}
                        className="text-red-500 hover:text-red-700 transition-colors disabled:opacity-50"
                        title="Remove collaborator"
                      >
                        {isRemoving === collaborator._id ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-500"></div>
                        ) : (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        )}
                      </button>
                    )}
                  </div>
                ))}

                {collaborators.length === 0 && (
                  <div className="text-center py-4 text-gray-500">
                    <p className="text-sm">No collaborators yet</p>
                    {!isOwner && (
                      <p className="text-xs mt-1">Only the owner can add collaborators</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="mt-6 pt-4 border-t border-gray-200">
            <div className="text-xs text-gray-500">
              <p>• Collaborators can view and edit all cards</p>
              <p>• Only the owner can add/remove collaborators</p>
              <p>• Changes sync in real-time for all users</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ShareBoardModal; 