import React, { useEffect, useState, useRef } from 'react';
import {
  DragDropContext,
  Droppable,
  Draggable,
  DropResult
} from '@hello-pangea/dnd';
import type { Card, Column, Board } from './types';
import { API_BASE_URL } from './config';
import { useAuth } from './contexts/AuthContext';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useSocket } from './hooks/useSocket';
import ShareBoardModal from './components/ShareBoardModal';
import { getAvatarColor, getInitials } from './utils/avatarColors';

const BoardView: React.FC = () => {
  const { token, isAuthenticated, isLoading, user, logout } = useAuth();
  const navigate = useNavigate();
  const { username, slug } = useParams<{ username: string; slug: string }>();
  const socket = useSocket();
  const [board, setBoard] = useState<Board | null>(null);
  const [boardLoading, setBoardLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddCardModal, setShowAddCardModal] = useState(false);
  const [addCardColumnId, setAddCardColumnId] = useState<string | null>(null);
  const [newCardTitle, setNewCardTitle] = useState('');
  const [newCardDescription, setNewCardDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAddColumnModal, setShowAddColumnModal] = useState(false);
  const [newColumnName, setNewColumnName] = useState('');
  const [isSubmittingColumn, setIsSubmittingColumn] = useState(false);
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const [isEditingCard, setIsEditingCard] = useState(false);
  const [editedCardTitle, setEditedCardTitle] = useState('');
  const [editedCardDescription, setEditedCardDescription] = useState('');
  const [isDeletingCard, setIsDeletingCard] = useState(false);
  const [isDeletingColumn, setIsDeletingColumn] = useState<string | null>(null);
  const [cardError, setCardError] = useState<string | null>(null);
  const [editingColumnId, setEditingColumnId] = useState<string | null>(null);
  const [editingColumnTitle, setEditingColumnTitle] = useState('');
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showBoardMenu, setShowBoardMenu] = useState(false);
  const [showDeleteBoardModal, setShowDeleteBoardModal] = useState(false);
  const [isDeletingBoard, setIsDeletingBoard] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const editRef = useRef<HTMLInputElement>(null);
  
  useEffect(() => {
    if (isLoading) return;
    
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    const fetchBoard = async () => {
      try {
        let response;
        
        if (username && slug) {
          response = await fetch(`${API_BASE_URL}/boards/${username}/${slug}`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
        } else {
          navigate('/');
          return;
        }

        if (!response.ok) {
          if (response.status === 404) {
            navigate('/');
            return;
          }
          throw new Error('Failed to fetch board');
        }

        const data = await response.json();

        if (data.board) {
          setBoard(data.board);
        } else {
          console.error('No board data in response');
        }
      } catch (err) {
        console.error('Error fetching board:', err);
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setBoardLoading(false);
      }
    };

    fetchBoard();
  }, [token, navigate, isAuthenticated, isLoading, username, slug]);

  useEffect(() => {
    if (!socket || !board) return;
    
    if (socket.connected) {
      socket.emit('joinBoard', board._id);
    } else {
      socket.on('connect', () => {
        socket.emit('joinBoard', board._id);
      });
    }

    socket.on('error', (error) => {
      console.error('Socket error in BoardView:', error);
    });

    return () => {
      socket.emit('leaveBoard', board._id);
    };
  }, [socket, board]);

  useEffect(() => {
    if (!socket) return;

    const handleCardUpdate = (data: { boardId: string; card: Card }) => {
      setBoard(prev => {
        if (!prev) return null;
        return {
          ...prev,
          cards: prev.cards.map(card => 
            card._id === data.card._id ? data.card : card
          )
        };
      });
    };

    const handleCardCreate = (data: { boardId: string; card: Card }) => {
      setBoard(prev => {
        if (!prev) return null;
        return {
          ...prev,
          cards: [...prev.cards, data.card]
        };
      });
    };

    const handleCardDelete = (data: { boardId: string; cardId: string }) => {
      setBoard(prev => {
        if (!prev) return null;
        return {
          ...prev,
          cards: prev.cards.filter(card => card._id !== data.cardId)
        };
      });
    };

    const handleCardsUpdate = (data: { boardId: string; cards: Card[] }) => {
      setBoard(prev => {
        if (!prev) return null;
        return {
          ...prev,
          cards: data.cards
        };
      });
    };

    const handleColumnUpdate = (data: { columnId: string; title: string }) => {
      setBoard(prev => {
        if (!prev) return null;
        return {
          ...prev,
          columns: prev.columns.map((col: Column) => 
            col._id === data.columnId ? { ...col, title: data.title } : col
          )
        };
      });
    };

    const handleColumnCreate = (data: { boardId: string; column: Column }) => {
      setBoard(prev => {
        if (!prev) return null;
        return {
          ...prev,
          columns: [...prev.columns, data.column]
        };
      });
    };

    const handleColumnDelete = (data: { boardId: string; columnId: string }) => {
      setBoard(prev => {
        if (!prev) return null;
        return {
          ...prev,
          columns: prev.columns.filter((col: Column) => col._id !== data.columnId),
          cards: prev.cards.filter(card => card.columnId !== data.columnId)
        };
      });
    };

    socket.on('cardUpdated', handleCardUpdate);
    socket.on('cardCreated', handleCardCreate);
    socket.on('cardDeleted', handleCardDelete);
    socket.on('cardsUpdated', handleCardsUpdate);
    socket.on('columnUpdated', handleColumnUpdate);
    socket.on('columnCreated', handleColumnCreate);
    socket.on('columnDeleted', handleColumnDelete);
    
    return () => {
      socket.off('cardUpdated', handleCardUpdate);
      socket.off('cardCreated', handleCardCreate);
      socket.off('cardDeleted', handleCardDelete);
      socket.off('cardsUpdated', handleCardsUpdate);
      socket.off('columnUpdated', handleColumnUpdate);
      socket.off('columnCreated', handleColumnCreate);
      socket.off('columnDeleted', handleColumnDelete);
    };
  }, [socket]);

  const onDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result;

    if (!destination || !board) return;

    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/cards/${board._id}/${draggableId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          columnId: destination.droppableId,
          position: destination.index
        })
      });

      if (!response.ok) {
        throw new Error('Failed to update card position');
      }
    } catch (error) {
      console.error('Error updating card position:', error);
    }
  };

  const openAddCardModal = (columnId: string) => {
    setAddCardColumnId(columnId);
    setShowAddCardModal(true);
    setNewCardTitle('');
    setNewCardDescription('');
  };

  const closeAddCardModal = () => {
    setShowAddCardModal(false);
    setAddCardColumnId(null);
    setNewCardTitle('');
    setNewCardDescription('');
  };

  const handleAddCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addCardColumnId || !board) return;

    setIsSubmitting(true);
    try {
      const columnCards = board.cards.filter(c => c.columnId.toString() === addCardColumnId.toString());
      const maxPosition = Math.max(...columnCards.map(c => c.position), -1);
      
      const response = await fetch(`${API_BASE_URL}/cards`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          title: newCardTitle,
          description: newCardDescription,
          columnId: addCardColumnId,
          position: maxPosition + 1,
          boardId: board._id
        }),
      });

      if (!response.ok) throw new Error('Failed to create card');
      
      closeAddCardModal();
    } catch (error) {
      console.error('Error creating card:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const openAddColumnModal = () => {
    setShowAddColumnModal(true);
    setNewColumnName('');
  };

  const closeAddColumnModal = () => {
    setShowAddColumnModal(false);
    setNewColumnName('');
  };

  const handleAddColumn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!board || !token) return;

    setIsSubmittingColumn(true);
    try {
      const response = await fetch(`${API_BASE_URL}/boards/${board._id}/columns`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          title: newColumnName,
          position: board.columns.length
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to add column');
      }

      setNewColumnName('');
      closeAddColumnModal();
    } catch (error) {
      console.error('Error adding column:', error);
    } finally {
      setIsSubmittingColumn(false);
    }
  };

  const handleCardClick = (card: Card) => {
    setSelectedCard(card);
    setEditedCardTitle(card.title);
    setEditedCardDescription(card.description || '');
    setCardError(null);
  };

  const closeCardModal = () => {
    setSelectedCard(null);
    setIsEditingCard(false);
    setCardError(null);
  };

  const handleEditCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCard || !board) return;
    setIsSubmitting(true);

    try {
      const response = await fetch(
        `${API_BASE_URL}/cards/${board._id}/${selectedCard._id}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            title: editedCardTitle,
            description: editedCardDescription
          })
        }
      );

      if (!response.ok) throw new Error('Failed to update card');
      
      closeCardModal();
    } catch (error) {
      console.error('Error updating card:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteCard = async () => {
    if (!selectedCard || !board) return;
    setIsDeletingCard(true);
    setCardError(null);

    try {
      const response = await fetch(
        `${API_BASE_URL}/cards/${board._id}/${selectedCard._id}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        const message = errorData?.error || 'Failed to delete card';
        throw new Error(message);
      }
      
      closeCardModal();
    } catch (error) {
      console.error('Error deleting card:', error);
      if (error instanceof Error) {
        setCardError(error.message);
      } else {
        setCardError('Failed to delete card');
      }
    } finally {
      setIsDeletingCard(false);
    }
  };

  const handleDeleteColumn = async (columnId: string) => {
    if (!board) return;

    const columnCards = board.cards.filter(c => c.columnId === columnId);
    if (columnCards.length > 0) {
      alert('Move or delete cards before removing the column.');
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/boards/${board._id}/columns/${columnId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        },
      });

      if (!response.ok) throw new Error('Failed to delete column');
      
      setIsDeletingColumn(null);
    } catch (error) {
      console.error('Error deleting column:', error);
    }
  };

  const startEditingColumn = (columnId: string, currentTitle: string) => {
    setEditingColumnId(columnId);
    setEditingColumnTitle(currentTitle);
  };

  const cancelEditingColumn = () => {
    setEditingColumnId(null);
    setEditingColumnTitle('');
  };

  const handleUpdateColumnTitle = async (newTitle: string) => {
    if (!editingColumnId || !board) {
      return;
    }
    
    try {
      const url = `${API_BASE_URL}/boards/${board._id}/columns/${editingColumnId}`;
      
      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ title: newTitle })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error response:', errorText);
        throw new Error('Failed to update column title');
      }
    } catch (err) {
      console.error('Error updating column title:', err);
    } finally {
      setEditingColumnId(null);
      setEditingColumnTitle('');
    }
  };

  const handleLogout = () => {
    logout();
  };

  const handleDeleteBoard = async () => {
    if (!board) return;
    
    setIsDeletingBoard(true);
    try {
      const response = await fetch(`${API_BASE_URL}/boards/${board._id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to delete board');
      }

      navigate('/');
    } catch (err) {
      console.error('Error deleting board:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete board');
    } finally {
      setIsDeletingBoard(false);
      setShowDeleteBoardModal(false);
      setShowBoardMenu(false);
    }
  };

  useEffect(() => {
    if (editingColumnId && editRef.current) {
      editRef.current.focus();
      editRef.current.setSelectionRange(editRef.current.value.length, editRef.current.value.length);
    }
  }, [editingColumnId]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!target.closest('.user-menu-container')) {
        setShowUserMenu(false);
      }
    };

    if (showUserMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showUserMenu]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!target.closest('.board-menu-container')) {
        setShowBoardMenu(false);
      }
    };

    if (showBoardMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showBoardMenu]);

  if (isLoading || boardLoading) {
    return (
      <div className="loading-container">
        <div>Loading board...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-container">
        <div>{error}</div>
      </div>
    );
  }

  if (!board) {
    return (
      <div className="loading-container">
        <div>No board found</div>
      </div>
    );
  }

  return (
    <div className="board-container">
      {/* Board Header */}
      <header className="board-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
            <Link
              to="/boards"
              className="btn btn-ghost"
              style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 12H5M12 19l-7-7 7-7"/>
              </svg>
              <span>Back to Boards</span>
            </Link>
            
            <div style={{ width: '1px', height: '24px', backgroundColor: 'var(--color-gray-300)' }}></div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <h1 style={{ fontSize: 'var(--font-size-xl)', fontWeight: '600', color: 'var(--color-gray-900)' }}>
                {board.title}
              </h1>
              {board.sharedWith && board.sharedWith.length > 0 && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-1)',
                  padding: 'var(--space-1) var(--space-2)',
                  backgroundColor: 'var(--color-blue-50)',
                  color: 'var(--color-blue-600)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: 'var(--font-size-xs)',
                  fontWeight: '500'
                }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
                    <circle cx="9" cy="7" r="4"/>
                    <path d="m22 21-2-2"/>
                    <path d="M16 16l4 4"/>
                  </svg>
                  <span>{board.sharedWith.length} shared</span>
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
            {/* Board Menu */}
            <div className="board-menu-container">
              <button
                className="board-menu-trigger"
                onClick={() => setShowBoardMenu(!showBoardMenu)}
                title="Board options"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="12" cy="12" r="1"/>
                  <circle cx="19" cy="12" r="1"/>
                  <circle cx="5" cy="12" r="1"/>
                </svg>
              </button>
              
              {showBoardMenu && (
                <div className="board-menu-dropdown fade-in">
                  <button
                    className="board-menu-item"
                    onClick={() => {
                      setShowShareModal(true);
                      setShowBoardMenu(false);
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
                      <polyline points="16,6 12,2 8,6"/>
                      <line x1="12" y1="2" x2="12" y2="15"/>
                    </svg>
                    <span>Share board</span>
                  </button>
                  <button
                    className="board-menu-item danger"
                    onClick={() => {
                      setShowDeleteBoardModal(true);
                      setShowBoardMenu(false);
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="3,6 5,6 21,6"/>
                      <path d="M19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2"/>
                    </svg>
                    <span>Delete board</span>
                  </button>
                </div>
              )}
            </div>

            {/* User Menu */}
            <div className="user-menu-container">
              <div 
                className="user-menu-trigger"
                onClick={() => setShowUserMenu(!showUserMenu)}
              >
                <div 
                  style={{
                    width: '32px',
                    height: '32px',
                    backgroundColor: getAvatarColor(user?.id || user?.username || '').bg,
                    color: getAvatarColor(user?.id || user?.username || '').text,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 'var(--font-size-sm)',
                    fontWeight: '600'
                  }}
                >
                  <span>{getInitials(user?.firstName, user?.lastName)}</span>
                </div>
                <div className="user-info">
                  <div className="user-name">{user?.firstName} {user?.lastName}</div>
                  <div className="user-username">@{user?.username}</div>
                </div>
                <svg 
                  width="16" 
                  height="16" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="2"
                  style={{ 
                    transform: showUserMenu ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform var(--transition-fast)'
                  }}
                >
                  <polyline points="6,9 12,15 18,9"/>
                </svg>
              </div>
              
              {showUserMenu && (
                <div className="user-menu-dropdown fade-in">
                  <button
                    className="user-menu-item"
                    onClick={handleLogout}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                      <polyline points="16,17 21,12 16,7"/>
                      <line x1="21" y1="12" x2="9" y2="12"/>
                    </svg>
                    <span>Sign out</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Board Content */}
      <main className="board-content">
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="board-columns">
            {board.columns.map((col) => {
              const columnCards = board.cards.filter(card => card.columnId.toString() === col._id.toString());
              const isEmpty = columnCards.length === 0;
              
              return (
                <Droppable droppableId={col._id} key={col._id}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`column ${snapshot.isDraggingOver ? 'droppable dragging-over' : 'droppable'}`}
                    >
                      <div className="column-header">
                        <div 
                          className={`column-title ${editingColumnId === col._id ? 'editing' : ''}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (editingColumnId !== col._id) {
                              startEditingColumn(col._id, col.title || '');
                            }
                          }}
                          title={editingColumnId === col._id ? "Editing..." : "Click to edit column title"}
                        >
                          {editingColumnId === col._id ? (
                            <input
                              type="text"
                              ref={editRef}
                              className="column-title-input"
                              value={editingColumnTitle}
                              onChange={(e) => setEditingColumnTitle(e.target.value)}
                              onBlur={() => {
                                const newTitle = editingColumnTitle.trim();
                                if (newTitle && newTitle !== (col.title || '')) {
                                  handleUpdateColumnTitle(newTitle);
                                } else {
                                  cancelEditingColumn();
                                }
                              }}
                              onKeyDown={(e) => {
                                e.stopPropagation();
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  const newTitle = editingColumnTitle.trim();
                                  if (newTitle) {
                                    handleUpdateColumnTitle(newTitle);
                                  }
                                } else if (e.key === 'Escape') {
                                  e.preventDefault();
                                  cancelEditingColumn();
                                }
                              }}
                              onClick={(e) => e.stopPropagation()}
                            />
                          ) : (
                            col.title || 'Untitled Column'
                          )}
                        </div>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => isEmpty && handleDeleteColumn(col._id)}
                          disabled={!isEmpty || isDeletingColumn === col._id}
                          style={{
                            opacity: isDeletingColumn === col._id ? 0.7 : isEmpty ? 0.7 : 0.3,
                            cursor: isEmpty ? 'pointer' : 'not-allowed'
                          }}
                          title={isEmpty ? 'Delete column' : 'Cannot delete: Column contains cards'}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="3,6 5,6 21,6"/>
                            <path d="M19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2"/>
                          </svg>
                        </button>
                      </div>
                      
                      <div className="column-cards">
                        {columnCards
                          .sort((a, b) => a.position - b.position)
                          .map((card, index) => (
                            <Draggable draggableId={card._id} index={index} key={card._id}>
                              {(provided, snapshot) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  {...provided.dragHandleProps}
                                  className={`card ${snapshot.isDragging ? 'dragging' : ''}`}
                                  onClick={() => handleCardClick(card)}
                                >
                                  <div className="card-title">{card.title}</div>
                                  {card.description && (
                                    <div className="card-description">{card.description}</div>
                                  )}
                                </div>
                              )}
                            </Draggable>
                          ))}
                        {provided.placeholder}
                      </div>
                      
                      <div className="column-footer">
                        <button
                          className="add-button"
                          onClick={() => openAddCardModal(col._id)}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="12" y1="5" x2="12" y2="19"/>
                            <line x1="5" y1="12" x2="19" y2="12"/>
                          </svg>
                          <span>Add Card</span>
                        </button>
                      </div>
                    </div>
                  )}
                </Droppable>
              );
            })}
            
            <button
              className="add-column-button"
              onClick={openAddColumnModal}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="5" x2="12" y2="19"/>
                <line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              <span>Add Column</span>
            </button>
            

          </div>
        </DragDropContext>
      </main>

      {/* Add Card Modal */}
      {showAddCardModal && (
        <div className="modal-backdrop" onClick={closeAddCardModal}>
          <div className="modal fade-in" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Add Card</h2>
            </div>
            <form onSubmit={handleAddCard}>
              <div className="modal-body">
                <div style={{ marginBottom: 'var(--space-4)' }}>
                  <label htmlFor="card-title" style={{ 
                    display: 'block', 
                    marginBottom: 'var(--space-2)', 
                    fontSize: 'var(--font-size-sm)', 
                    fontWeight: '500',
                    color: 'var(--color-gray-700)'
                  }}>
                    Title
                  </label>
                  <input
                    id="card-title"
                    type="text"
                    className="input"
                    placeholder="Enter card title"
                    value={newCardTitle}
                    onChange={e => setNewCardTitle(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
                <div>
                  <label htmlFor="card-description" style={{ 
                    display: 'block', 
                    marginBottom: 'var(--space-2)', 
                    fontSize: 'var(--font-size-sm)', 
                    fontWeight: '500',
                    color: 'var(--color-gray-700)'
                  }}>
                    Description (optional)
                  </label>
                  <textarea
                    id="card-description"
                    className="textarea"
                    placeholder="Enter card description"
                    value={newCardDescription}
                    onChange={e => setNewCardDescription(e.target.value)}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={closeAddCardModal}>
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary" 
                  disabled={isSubmitting || !newCardTitle.trim()}
                >
                  {isSubmitting ? 'Adding...' : 'Add Card'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Column Modal */}
      {showAddColumnModal && (
        <div className="modal-backdrop" onClick={closeAddColumnModal}>
          <div className="modal fade-in" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Add Column</h2>
            </div>
            <form onSubmit={handleAddColumn}>
              <div className="modal-body">
                <div>
                  <label htmlFor="column-title" style={{ 
                    display: 'block', 
                    marginBottom: 'var(--space-2)', 
                    fontSize: 'var(--font-size-sm)', 
                    fontWeight: '500',
                    color: 'var(--color-gray-700)'
                  }}>
                    Column Title
                  </label>
                  <input
                    id="column-title"
                    type="text"
                    className="input"
                    placeholder="Enter column title"
                    value={newColumnName}
                    onChange={e => setNewColumnName(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={closeAddColumnModal}>
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary" 
                  disabled={isSubmittingColumn || !newColumnName.trim()}
                >
                  {isSubmittingColumn ? 'Adding...' : 'Add Column'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Card Detail Modal */}
      {selectedCard && (
        <div className="modal-backdrop" onClick={closeCardModal}>
          <div className="modal fade-in" onClick={e => e.stopPropagation()}>
            {isEditingCard ? (
              <form onSubmit={handleEditCard}>
                <div className="modal-header">
                  <h2>Edit Card</h2>
                </div>
                <div className="modal-body">
                  <div style={{ marginBottom: 'var(--space-4)' }}>
                    <label htmlFor="edit-card-title" style={{ 
                      display: 'block', 
                      marginBottom: 'var(--space-2)', 
                      fontSize: 'var(--font-size-sm)', 
                      fontWeight: '500',
                      color: 'var(--color-gray-700)'
                    }}>
                      Title
                    </label>
                    <input
                      id="edit-card-title"
                      type="text"
                      className="input"
                      placeholder="Enter card title"
                      value={editedCardTitle}
                      onChange={e => setEditedCardTitle(e.target.value)}
                      required
                      autoFocus
                    />
                  </div>
                  <div>
                    <label htmlFor="edit-card-description" style={{ 
                      display: 'block', 
                      marginBottom: 'var(--space-2)', 
                      fontSize: 'var(--font-size-sm)', 
                      fontWeight: '500',
                      color: 'var(--color-gray-700)'
                    }}>
                      Description
                    </label>
                    <textarea
                      id="edit-card-description"
                      className="textarea"
                      placeholder="Enter card description"
                      value={editedCardDescription}
                      onChange={e => setEditedCardDescription(e.target.value)}
                    />
                  </div>
                  {cardError && (
                    <div style={{ 
                      marginTop: 'var(--space-3)', 
                      padding: 'var(--space-2) var(--space-3)', 
                      backgroundColor: '#fef2f2', 
                      color: 'var(--color-error)', 
                      borderRadius: 'var(--radius-md)',
                      fontSize: 'var(--font-size-sm)'
                    }}>
                      {cardError}
                    </div>
                  )}
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={closeCardModal}>
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    className="btn btn-primary" 
                    disabled={isSubmitting || !editedCardTitle.trim()}
                  >
                    {isSubmitting ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            ) : (
              <>
                <div className="modal-header">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <h2>{selectedCard.title}</h2>
                    <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => setIsEditingCard(true)}
                      >
                        Edit
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={handleDeleteCard}
                        disabled={isDeletingCard}
                      >
                        {isDeletingCard ? 'Deleting...' : 'Delete'}
                      </button>
                    </div>
                  </div>
                </div>
                <div className="modal-body">
                  {cardError && (
                    <div style={{ 
                      marginBottom: 'var(--space-4)', 
                      padding: 'var(--space-2) var(--space-3)', 
                      backgroundColor: '#fef2f2', 
                      color: 'var(--color-error)', 
                      borderRadius: 'var(--radius-md)',
                      fontSize: 'var(--font-size-sm)'
                    }}>
                      {cardError}
                    </div>
                  )}
                  {selectedCard.description && (
                    <div style={{ marginBottom: 'var(--space-4)' }}>
                      <div className="card-description" style={{ whiteSpace: 'pre-wrap' }}>
                        {selectedCard.description}
                      </div>
                    </div>
                  )}
                  <div style={{ 
                    color: 'var(--color-gray-500)', 
                    fontSize: 'var(--font-size-xs)',
                    lineHeight: 'var(--line-height-relaxed)'
                  }}>
                    <div style={{ marginBottom: 'var(--space-2)' }}>
                      <strong>Created by:</strong> {selectedCard.createdBy?.firstName} {selectedCard.createdBy?.lastName} ({selectedCard.createdBy?.username})
                    </div>
                    <div style={{ marginBottom: 'var(--space-2)' }}>
                      <strong>Created:</strong> {new Date(selectedCard.createdAt || '').toLocaleString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </div>
                    {selectedCard.modifiedBy && (
                      <div style={{ marginBottom: 'var(--space-2)' }}>
                        <strong>Last modified by:</strong> {selectedCard.modifiedBy?.firstName} {selectedCard.modifiedBy?.lastName} ({selectedCard.modifiedBy?.username})
                      </div>
                    )}
                    {selectedCard.updatedAt && (
                      <div>
                        <strong>Last updated:</strong> {new Date(selectedCard.updatedAt).toLocaleString('en-GB', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </div>
                    )}
                  </div>
                </div>
                <div className="modal-footer">
                  <button className="btn btn-secondary" onClick={closeCardModal}>
                    Close
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Delete Board Modal */}
      {showDeleteBoardModal && (
        <div className="modal-backdrop" onClick={() => setShowDeleteBoardModal(false)}>
          <div className="modal fade-in" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  backgroundColor: '#fef2f2',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                    <line x1="12" y1="9" x2="12" y2="13"/>
                    <line x1="12" y1="17" x2="12.01" y2="17"/>
                  </svg>
                </div>
                <h2>Delete Board</h2>
              </div>
            </div>
            <div className="modal-body">
              <p style={{ 
                color: 'var(--color-gray-600)', 
                lineHeight: 'var(--line-height-relaxed)',
                marginBottom: 'var(--space-4)'
              }}>
                Are you sure you want to delete "<strong>{board?.title}</strong>"? This action cannot be undone and will permanently remove the board and all its cards.
              </p>
            </div>
            <div className="modal-footer">
              <button
                className="btn btn-secondary"
                onClick={() => setShowDeleteBoardModal(false)}
                disabled={isDeletingBoard}
              >
                Cancel
              </button>
              <button
                className="btn btn-danger"
                onClick={handleDeleteBoard}
                disabled={isDeletingBoard}
              >
                {isDeletingBoard ? 'Deleting...' : 'Delete Board'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Share Board Modal */}
      <ShareBoardModal
        boardId={board?._id || ''}
        boardTitle={board?.title || ''}
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
      />
    </div>
  );
};

export default BoardView;
