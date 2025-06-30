import React, { useState, useEffect } from 'react';
import { API_BASE_URL } from '../config';
import { useAuth } from '../contexts/AuthContext';
import { User } from '../types';
import { getAvatarColor, getInitials } from '../utils/avatarColors';

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
      setCollaborators(data.collaborators || []);
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

  console.log('ShareBoardModal debug:', {
    isOpen,
    boardId,
    boardTitle,
    owner: owner?._id,
    user: user?.id,
    isOwner,
    userExists: !!user,
    ownerExists: !!owner
  });

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal fade-in" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2>Share Board</h2>
            <button
              onClick={onClose}
              className="btn btn-ghost btn-sm"
              style={{ padding: 'var(--space-1)' }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
            </button>
          </div>
        </div>

        <div className="modal-body">
          <div style={{ marginBottom: 'var(--space-6)' }}>
            <h4 style={{ 
              fontSize: 'var(--font-size-base)', 
              fontWeight: '600', 
              color: 'var(--color-gray-900)',
              marginBottom: 'var(--space-2)'
            }}>
              {boardTitle}
            </h4>
            <p style={{ 
              fontSize: 'var(--font-size-sm)', 
              color: 'var(--color-gray-600)',
              lineHeight: 'var(--line-height-relaxed)'
            }}>
              Share this board with team members to collaborate in real-time.
            </p>
          </div>

          {/* Share Form */}
          {isOwner && (
            <form onSubmit={handleShare} style={{ marginBottom: 'var(--space-6)' }}>
              <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
                <input
                  type="text"
                  value={shareInput}
                  onChange={(e) => setShareInput(e.target.value)}
                  placeholder="Enter username or email"
                  className="input"
                  style={{ flex: 1 }}
                  disabled={isSharing}
                />
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={!shareInput.trim() || isSharing}
                >
                  {isSharing ? 'Sharing...' : 'Share'}
                </button>
              </div>
              
              <p style={{ 
                fontSize: 'var(--font-size-xs)', 
                color: 'var(--color-gray-500)',
                marginBottom: 'var(--space-3)'
              }}>
                Enter a username (e.g., "john") or email address (e.g., "john@example.com")
              </p>
              
              {shareError && (
                <div style={{ 
                  padding: 'var(--space-2) var(--space-3)', 
                  backgroundColor: '#fef2f2', 
                  color: 'var(--color-error)', 
                  borderRadius: 'var(--radius-md)',
                  fontSize: 'var(--font-size-sm)',
                  marginBottom: 'var(--space-3)'
                }}>
                  {shareError}
                </div>
              )}
              
              {shareSuccess && (
                <div style={{ 
                  padding: 'var(--space-2) var(--space-3)', 
                  backgroundColor: '#f0fdf4', 
                  color: 'var(--color-success)', 
                  borderRadius: 'var(--radius-md)',
                  fontSize: 'var(--font-size-sm)',
                  marginBottom: 'var(--space-3)'
                }}>
                  {shareSuccess}
                </div>
              )}
            </form>
          )}

          {/* Collaborators List */}
          <div>
            <h4 style={{ 
              fontSize: 'var(--font-size-base)', 
              fontWeight: '600', 
              color: 'var(--color-gray-900)',
              marginBottom: 'var(--space-4)'
            }}>
              People with access
            </h4>
            
            {isLoadingCollaborators ? (
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                padding: 'var(--space-4)' 
              }}>
                <div style={{
                  width: '24px',
                  height: '24px',
                  border: '2px solid var(--color-gray-200)',
                  borderTop: '2px solid var(--color-blue-500)',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite'
                }}></div>
              </div>
            ) : (
              <div style={{ 
                maxHeight: '256px', 
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--space-3)'
              }}>
                {/* Owner */}
                {owner && (
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between',
                    padding: 'var(--space-3)',
                    backgroundColor: 'var(--color-gray-50)',
                    borderRadius: 'var(--radius-lg)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                      <div style={{
                        width: '32px',
                        height: '32px',
                        background: getAvatarColor(owner._id).bg,
                        color: getAvatarColor(owner._id).text,
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 'var(--font-size-sm)',
                        fontWeight: '600'
                      }}>
                        <span>{getInitials(owner.firstName, owner.lastName)}</span>
                      </div>
                      <div>
                        <div style={{ 
                          fontSize: 'var(--font-size-sm)', 
                          fontWeight: '500', 
                          color: 'var(--color-gray-900)' 
                        }}>
                          {owner.firstName} {owner.lastName}
                        </div>
                        <div style={{ 
                          fontSize: 'var(--font-size-xs)', 
                          color: 'var(--color-gray-500)' 
                        }}>
                          @{owner.username}
                        </div>
                      </div>
                    </div>
                    <div style={{
                      padding: 'var(--space-1) var(--space-2)',
                      backgroundColor: 'var(--color-blue-50)',
                      color: 'var(--color-blue-600)',
                      borderRadius: 'var(--radius-md)',
                      fontSize: 'var(--font-size-xs)',
                      fontWeight: '500'
                    }}>
                      Owner
                    </div>
                  </div>
                )}

                {/* Collaborators */}
                {collaborators.length > 0 ? (
                  collaborators.map((collaborator) => (
                    <div key={collaborator._id} style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'space-between',
                      padding: 'var(--space-3)',
                      backgroundColor: 'var(--color-white)',
                      border: '1px solid var(--color-gray-200)',
                      borderRadius: 'var(--radius-lg)'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                        <div style={{
                          width: '32px',
                          height: '32px',
                          background: getAvatarColor(collaborator._id).bg,
                          color: getAvatarColor(collaborator._id).text,
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 'var(--font-size-sm)',
                          fontWeight: '600'
                        }}>
                          <span>{getInitials(collaborator.firstName, collaborator.lastName)}</span>
                        </div>
                        <div>
                          <div style={{ 
                            fontSize: 'var(--font-size-sm)', 
                            fontWeight: '500', 
                            color: 'var(--color-gray-900)' 
                          }}>
                            {collaborator.firstName} {collaborator.lastName}
                          </div>
                          <div style={{ 
                            fontSize: 'var(--font-size-xs)', 
                            color: 'var(--color-gray-500)' 
                          }}>
                            @{collaborator.username}
                          </div>
                        </div>
                      </div>
                      {isOwner && (
                        <button
                          onClick={() => handleRemoveCollaborator(collaborator._id, collaborator.username)}
                          disabled={isRemoving === collaborator._id}
                          className="btn btn-ghost btn-sm"
                          style={{ 
                            color: 'var(--color-error)',
                            opacity: isRemoving === collaborator._id ? 0.5 : 1
                          }}
                        >
                          {isRemoving === collaborator._id ? 'Removing...' : 'Remove'}
                        </button>
                      )}
                    </div>
                  ))
                ) : (
                  <div style={{ 
                    textAlign: 'center', 
                    padding: 'var(--space-6)', 
                    color: 'var(--color-gray-500)',
                    fontSize: 'var(--font-size-sm)'
                  }}>
                    No collaborators yet
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ShareBoardModal; 