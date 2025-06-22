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
    // Wait for authentication to finish loading
    if (isLoading) return;
    
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    const fetchBoard = async () => {
      console.log('Fetching board with username/slug:', { username, slug });
      try {
        let response;
        
        if (username && slug) {
          // Fetch specific board by username and slug
          response = await fetch(`${API_BASE_URL}/boards/${username}/${slug}`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
        } else {
          // Fallback: redirect to home
          navigate('/');
          return;
        }

        console.log('Response status:', response.status);
        if (!response.ok) {
          if (response.status === 404) {
            navigate('/');
            return;
          }
          throw new Error('Failed to fetch board');
        }

        const data = await response.json();
        console.log('Received data:', data);

        if (data.board) {
          setBoard(data.board);
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

    console.log('Socket connection status:', socket.connected);
    console.log('Joining board room:', board._id);
    socket.emit('joinBoard', board._id);

    // Cleanup function
    return () => {
      console.log('Leaving board room:', board._id);
      socket.emit('leaveBoard', board._id);
    };
  }, [socket, board]);

  useEffect(() => {
    if (!socket) return;

    console.log('Setting up socket event listeners');

    const handleCardUpdate = (data: { boardId: string; card: Card }) => {
      console.log('Received cardUpdated event:', data);
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
      console.log('Received cardCreated event:', data);
      setBoard(prev => {
        if (!prev) return null;
        return {
          ...prev,
          cards: [...prev.cards, data.card]
        };
      });
    };

    const handleCardDelete = (data: { boardId: string; cardId: string }) => {
      console.log('Received cardDeleted event:', data);
      setBoard(prev => {
        if (!prev) return null;
        return {
          ...prev,
          cards: prev.cards.filter(card => card._id !== data.cardId)
        };
      });
    };

    const handleColumnUpdate = (data: { columnId: string; title: string }) => {
      console.log('Received columnUpdated event:', data);
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

    const handleColumnCreate = (newColumn: Column) => {
      console.log('Received columnCreated event:', newColumn);
      setBoard(prev => {
        if (!prev) return null;
        return {
          ...prev,
          columns: [...prev.columns, newColumn]
        };
      });
    };

    const handleColumnDelete = (deletedColumnId: string) => {
      console.log('Received columnDeleted event:', deletedColumnId);
      setBoard(prev => {
        if (!prev) return null;
        return {
          ...prev,
          columns: prev.columns.filter((col: Column) => col._id !== deletedColumnId),
          cards: prev.cards.filter(card => card.columnId !== deletedColumnId)
        };
      });
    };

    socket.on('cardUpdated', handleCardUpdate);
    socket.on('cardCreated', handleCardCreate);
    socket.on('cardDeleted', handleCardDelete);
    socket.on('columnUpdated', handleColumnUpdate);
    socket.on('columnCreated', handleColumnCreate);
    socket.on('columnDeleted', handleColumnDelete);

    // Cleanup function
    return () => {
      console.log('Cleaning up socket event listeners');
      socket.off('cardUpdated', handleCardUpdate);
      socket.off('cardCreated', handleCardCreate);
      socket.off('cardDeleted', handleCardDelete);
      socket.off('columnUpdated', handleColumnUpdate);
      socket.off('columnCreated', handleColumnCreate);
      socket.off('columnDeleted', handleColumnDelete);
    };
  }, [socket]); // Only depend on socket, not board

  const onDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result;

    if (!destination || !board) return;

    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) {
      return;
    }

    const sourceColumn = board.columns.find(col => col._id === source.droppableId);
    const destColumn = board.columns.find(col => col._id === destination.droppableId);
    const card = board.cards.find(c => c._id === draggableId);

    if (!sourceColumn || !destColumn || !card) return;

    // Create a new cards array with the updated card
    const newCards = board.cards.map(c => {
      if (c._id === draggableId) {
        return {
          ...c,
          columnId: destination.droppableId,
          position: destination.index
        };
      }
      return c;
    });

    // Update positions of other cards in the source column
    newCards.forEach(c => {
      if (c.columnId === source.droppableId && c.position >= source.index && c._id !== draggableId) {
        c.position -= 1;
      }
    });

    // Update positions of other cards in the destination column
    newCards.forEach(c => {
      if (c.columnId === destination.droppableId && c.position >= destination.index && c._id !== draggableId) {
        c.position += 1;
      }
    });

    // Update the board state immediately for smooth visual transition
    setBoard(prev => ({
      ...prev!,
      cards: newCards
    }));

    // Save the changes to the server
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

      // Emit the move event
      if (socket) {
        socket.emit('moveCard', {
          cardId: draggableId,
          sourceColumnId: source.droppableId,
          destinationColumnId: destination.droppableId,
          sourceIndex: source.index,
          destinationIndex: destination.index
        });
      }
    } catch (error) {
      console.error('Error updating card position:', error);
      // Revert the board state if the update fails
      setBoard(prev => ({
        ...prev!,
        cards: board.cards
      }));
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
      const columnCards = board.cards.filter(c => c.columnId === addCardColumnId);
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
      
      const newCard = await response.json();
      
      setBoard(prev => {
        if (!prev) return null;
        return {
          ...prev,
          cards: [...prev.cards, newCard]
        };
      });
      
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

      const data = await response.json();
      setBoard(prevBoard => {
        if (!prevBoard) return null;
        return {
          ...prevBoard,
          columns: [...prevBoard.columns, data.column]
        };
      });
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
      
      const updatedCard = await response.json();
      
      // Server will emit the socket event, so we don't need to emit it here
      // socket?.emit('cardUpdated', {
      //   card: updatedCard,
      //   boardId: board._id
      // });

      setBoard(prev => {
        if (!prev) return null;
        return {
          ...prev,
          cards: prev.cards.map(card => 
            card._id === selectedCard._id ? updatedCard : card
          )
        };
      });
      
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
      
      // Server will emit the socket event, so we don't need to emit it here
      // socket?.emit('cardDeleted', {
      //   cardId: selectedCard._id,
      //   columnId: selectedCard.columnId,
      //   boardId: board._id
      // });

      setBoard(prev => {
        if (!prev) return null;
        return {
          ...prev,
          cards: prev.cards.filter(card => card._id !== selectedCard._id)
        };
      });
      
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
      
      // Emit socket event
      socket?.emit('columnDeleted', {
        columnId,
        boardId: board._id
      });

      setBoard(prev => {
        if (!prev) return null;
        return {
          ...prev,
          columns: prev.columns.filter(col => col._id !== columnId),
          cards: prev.cards.filter(card => card.columnId !== columnId)
        };
      });
      
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
    if (!editingColumnId || !board) return;
    
    try {
      const response = await fetch(`${API_BASE_URL}/columns/${editingColumnId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ title: newTitle })
      });

      if (!response.ok) throw new Error('Failed to update column title');

      setBoard(prev => {
        if (!prev) return null;
        return {
          ...prev,
          columns: prev.columns.map(col => 
            col._id === editingColumnId ? { ...col, title: newTitle } : col
          )
        };
      });

      // Emit socket event for real-time updates
      if (socket) {
        socket.emit('columnUpdated', {
          boardId: board._id,
          columnId: editingColumnId,
          title: newTitle
        });
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
    navigate('/');
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

      // Navigate back to home after successful deletion
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

  // Focus the edit field when it becomes active
  useEffect(() => {
    if (editingColumnId && editRef.current) {
      editRef.current.focus();
      editRef.current.setSelectionRange(editRef.current.value.length, editRef.current.value.length);
    }
  }, [editingColumnId]);

  // Close user menu when clicking outside
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

  // Close board menu when clicking outside
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
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl text-red-500">{error}</div>
      </div>
    );
  }

  if (!board) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl">No board found</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100" style={{ height: '100vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {boardLoading ? (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-xl">Loading...</div>
        </div>
      ) : error ? (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-xl text-red-500">{error}</div>
        </div>
      ) : !board ? (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-xl">No board found</div>
        </div>
      ) : (
        <>
          {/* Top Bar - Logo and User Account */}
          <div className="bg-white shadow-sm border-b" style={{ flexShrink: 0 }}>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex justify-between items-center py-3">
                <div className="flex items-center space-x-4">
                  <Link
                    to="/boards"
                    className="flex items-center space-x-2 text-blue-600 hover:text-blue-700 font-medium transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                    <span>Back to Boards</span>
                  </Link>
                  <div className="h-6 w-px bg-gray-300"></div>
                  <div className="flex items-center space-x-2">
                    <h1 className="text-xl font-semibold text-gray-900">{board.title}</h1>
                    {board.sharedWith && board.sharedWith.length > 0 && (
                      <div className="flex items-center space-x-1 px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                        </svg>
                        <span>{board.sharedWith.length} shared</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="relative board-menu-container">
                    <button
                      onClick={() => setShowBoardMenu(!showBoardMenu)}
                      className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors duration-200"
                      title="Board options"
                    >
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                      </svg>
                    </button>
                    
                    {showBoardMenu && (
                      <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-gray-200 py-2 z-50">
                        <button
                          onClick={() => {
                            setShowShareModal(true);
                            setShowBoardMenu(false);
                          }}
                          className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-2"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
                          </svg>
                          <span>Share board</span>
                        </button>
                        <button
                          onClick={() => {
                            setShowDeleteBoardModal(true);
                            setShowBoardMenu(false);
                          }}
                          className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center space-x-2"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                          <span>Delete board</span>
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="relative user-menu-container">
                    <div 
                      className="flex items-center space-x-3 bg-white/60 backdrop-blur-sm rounded-full px-4 py-2 border border-gray-200 cursor-pointer hover:bg-white hover:shadow-md transition-all duration-200"
                      onClick={() => setShowUserMenu(!showUserMenu)}
                    >
                      <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                        <span className="text-white text-sm font-semibold">
                          {user?.firstName?.[0]}{user?.lastName?.[0]}
                        </span>
                      </div>
                      <div className="text-sm">
                        <p className="font-medium text-gray-900">{user?.firstName} {user?.lastName}</p>
                        <p className="text-gray-500">@{user?.username}</p>
                      </div>
                      <svg 
                        className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${showUserMenu ? 'rotate-180' : ''}`} 
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                    
                    {showUserMenu && (
                      <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-gray-200 py-2 z-50">
                        <button
                          onClick={handleLogout}
                          className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-2"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                          </svg>
                          <span>Sign out</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Board Content */}
          <div className="p-6" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <DragDropContext onDragEnd={onDragEnd}>
              <div style={{ display: 'flex', gap: '1rem', overflowX: 'auto', height: '100%', flex: 1 }}>
                {board.columns.map((col) => {
                  const columnCards = board.cards.filter(card => card.columnId === col._id);
                  const isEmpty = columnCards.length === 0;
                  
                  return (
                    <Droppable droppableId={col._id} key={col._id}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                          style={{
                            width: '275px',
                            height: '100%',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'stretch',
                            backgroundColor: snapshot.isDraggingOver ? '#f0f0f0' : '#fafafa',
                            border: '1px solid #ddd',
                            borderRadius: '8px',
                            padding: '1rem',
                            boxSizing: 'border-box',
                            flexShrink: 0,
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexShrink: 0 }}>
                            <div 
                              style={{ 
                                flex: 1,
                                marginRight: '0.5rem',
                                padding: '0.25rem 0.5rem',
                                borderRadius: '4px',
                                transition: 'background-color 0.2s',
                                cursor: editingColumnId === col._id ? 'text' : 'pointer',
                                fontSize: '1.125rem',
                                fontWeight: '600',
                                fontFamily: 'inherit',
                                display: 'flex',
                                alignItems: 'center',
                                minHeight: '1.5rem',
                                border: editingColumnId === col._id ? '2px solid #3b82f6' : '2px solid transparent',
                                backgroundColor: editingColumnId === col._id ? '#fff' : 'transparent',
                                outline: 'none'
                              }}
                              onMouseEnter={(e) => {
                                if (editingColumnId !== col._id) {
                                  e.currentTarget.style.backgroundColor = '#f3f4f6';
                                }
                              }}
                              onMouseLeave={(e) => {
                                if (editingColumnId !== col._id) {
                                  e.currentTarget.style.backgroundColor = 'transparent';
                                }
                              }}
                              onClick={() => {
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
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      const newTitle = editingColumnTitle.trim();
                                      if (newTitle) {
                                        handleUpdateColumnTitle(newTitle);
                                      }
                                    } else if (e.key === 'Escape') {
                                      cancelEditingColumn();
                                    }
                                  }}
                                  style={{
                                    width: '100%',
                                    outline: 'none',
                                    border: 'none',
                                    background: 'transparent',
                                    fontSize: 'inherit',
                                    fontWeight: 'inherit',
                                    fontFamily: 'inherit',
                                    margin: 0,
                                    padding: 0
                                  }}
                                />
                              ) : (
                                col.title || 'Untitled Column'
                              )}
                            </div>
                            <button
                              onClick={() => isEmpty && handleDeleteColumn(col._id)}
                              disabled={!isEmpty || isDeletingColumn === col._id}
                              style={{
                                background: 'none',
                                border: 'none',
                                padding: '0.25rem',
                                cursor: isEmpty ? 'pointer' : 'not-allowed',
                                opacity: isDeletingColumn === col._id ? 0.7 : isEmpty ? 0.7 : 0.3,
                                transition: 'opacity 0.2s',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                              title={isEmpty ? 'Delete column' : 'Cannot delete: Column contains cards'}
                            >
                              <svg
                                width="16"
                                height="16"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                style={{ color: '#dc3545' }}
                              >
                                <path d="M3 6h18" />
                                <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                              </svg>
                            </button>
                          </div>
                          
                          <div style={{ 
                            flex: 1, 
                            overflowY: 'auto', 
                            overflowX: 'hidden',
                            minHeight: 0,
                            marginBottom: '1rem'
                          }}>
                            {columnCards
                              .sort((a, b) => a.position - b.position)
                              .map((card, index) => (
                                <Draggable draggableId={card._id} index={index} key={card._id}>
                                  {(provided, snapshot) => (
                                    <div
                                      ref={provided.innerRef}
                                      {...provided.draggableProps}
                                      {...provided.dragHandleProps}
                                      onClick={() => handleCardClick(card)}
                                      style={{
                                        userSelect: 'none',
                                        padding: '0.75rem',
                                        marginBottom: '0.5rem',
                                        borderRadius: '4px',
                                        background: snapshot.isDragging ? '#fff' : '#ffffff',
                                        boxShadow: snapshot.isDragging ? '0 2px 8px rgba(0,0,0,0.2)' : 'none',
                                        border: '1px solid #ccc',
                                        cursor: 'pointer',
                                        ...provided.draggableProps.style
                                      }}
                                    >
                                      <strong>{card.title}</strong>
                                      {card.description && <p style={{ margin: '0.5rem 0 0' }}>{card.description}</p>}
                                    </div>
                                  )}
                                </Draggable>
                              ))}
                            {isEmpty && (
                              <div style={{
                                height: '60px',
                                marginBottom: '0.5rem',
                                opacity: 0
                              }}>
                                {provided.placeholder}
                              </div>
                            )}
                            {!isEmpty && provided.placeholder}
                          </div>
                          
                          <div style={{ flexShrink: 0 }}>
                            <button
                              style={{
                                width: '100%',
                                background: '#e0e0e0',
                                border: 'none',
                                borderRadius: '4px',
                                padding: '0.5rem',
                                cursor: 'pointer',
                                fontWeight: 600,
                              }}
                              onClick={() => openAddCardModal(col._id)}
                            >
                              + Add Card
                            </button>
                          </div>
                        </div>
                      )}
                    </Droppable>
                  );
                })}
                <button
                  style={{
                    width: '275px',
                    height: '40px',
                    background: '#e0e0e0',
                    border: '1px dashed #ccc',
                    borderRadius: '8px',
                    padding: '0.5rem',
                    cursor: 'pointer',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                  onClick={openAddColumnModal}
                >
                  + Add Column
                </button>
              </div>
            </DragDropContext>
          </div>
        </>
      )}
      {showAddCardModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            background: 'rgba(0,0,0,0.2)',
            backdropFilter: 'blur(2px)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onClick={closeAddCardModal}
        >
          <form
            onClick={e => e.stopPropagation()}
            onSubmit={handleAddCard}
            style={{
              background: '#fff',
              borderRadius: '8px',
              boxShadow: '0 4px 24px rgba(0,0,0,0.15)',
              padding: '2rem',
              minWidth: '320px',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
            }}
          >
            <h2 style={{ margin: 0 }}>Add Card</h2>
            <input
              type="text"
              placeholder="Title"
              value={newCardTitle}
              onChange={e => setNewCardTitle(e.target.value)}
              required
              style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
              autoFocus
            />
            <textarea
              placeholder="Description (optional)"
              value={newCardDescription}
              onChange={e => setNewCardDescription(e.target.value)}
              style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc', minHeight: '60px' }}
            />
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button type="button" onClick={closeAddCardModal} style={{ background: '#eee', border: 'none', borderRadius: '4px', padding: '0.5rem 1rem', cursor: 'pointer' }}>Cancel</button>
              <button type="submit" disabled={isSubmitting || !newCardTitle.trim()} style={{ background: '#1976d2', color: '#fff', border: 'none', borderRadius: '4px', padding: '0.5rem 1rem', cursor: 'pointer', fontWeight: 600 }}>
                {isSubmitting ? 'Adding...' : 'Add Card'}
              </button>
            </div>
          </form>
        </div>
      )}
      {showAddColumnModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            background: 'rgba(0,0,0,0.2)',
            backdropFilter: 'blur(2px)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onClick={closeAddColumnModal}
        >
          <form
            onClick={e => e.stopPropagation()}
            onSubmit={handleAddColumn}
            style={{
              background: '#fff',
              borderRadius: '8px',
              boxShadow: '0 4px 24px rgba(0,0,0,0.15)',
              padding: '2rem',
              minWidth: '320px',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
            }}
          >
            <h2 style={{ margin: 0 }}>Add Column</h2>
            <input
              type="text"
              placeholder="Column Title"
              value={newColumnName}
              onChange={e => setNewColumnName(e.target.value)}
              required
              style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
              autoFocus
            />
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button type="button" onClick={closeAddColumnModal} style={{ background: '#eee', border: 'none', borderRadius: '4px', padding: '0.5rem 1rem', cursor: 'pointer' }}>Cancel</button>
              <button type="submit" disabled={isSubmittingColumn || !newColumnName.trim()} style={{ background: '#1976d2', color: '#fff', border: 'none', borderRadius: '4px', padding: '0.5rem 1rem', cursor: 'pointer', fontWeight: 600 }}>
                {isSubmittingColumn ? 'Adding...' : 'Add Column'}
              </button>
            </div>
          </form>
        </div>
      )}
      {selectedCard && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            background: 'rgba(0,0,0,0.2)',
            backdropFilter: 'blur(2px)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onClick={closeCardModal}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#fff',
              borderRadius: '8px',
              boxShadow: '0 4px 24px rgba(0,0,0,0.15)',
              padding: '2rem',
              minWidth: '320px',
              maxWidth: '600px',
              width: '90%',
            }}
          >
            {isEditingCard ? (
              <form onSubmit={handleEditCard} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <h2 style={{ margin: 0 }}>Edit Card</h2>
                <input
                  type="text"
                  placeholder="Title"
                  value={editedCardTitle}
                  onChange={e => setEditedCardTitle(e.target.value)}
                  required
                  style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
                  autoFocus
                />
                <textarea
                  placeholder="Description (optional)"
                  value={editedCardDescription}
                  onChange={e => setEditedCardDescription(e.target.value)}
                  style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc', minHeight: '100px' }}
                />
                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    onClick={closeCardModal}
                    style={{ background: '#eee', border: 'none', borderRadius: '4px', padding: '0.5rem 1rem', cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || !editedCardTitle.trim()}
                    style={{ background: '#1976d2', color: '#fff', border: 'none', borderRadius: '4px', padding: '0.5rem 1rem', cursor: 'pointer', fontWeight: 600 }}
                  >
                    {isSubmitting ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
                {cardError && (
                  <p style={{ color: '#dc3545' }}>{cardError}</p>
                )}
              </form>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                  <h2 style={{ margin: 0 }}>{selectedCard.title}</h2>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    onClick={() => setIsEditingCard(true)}
                    style={{ background: '#eee', border: 'none', borderRadius: '4px', padding: '0.5rem', cursor: 'pointer' }}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={handleDeleteCard}
                    disabled={isDeletingCard}
                    style={{
                      background: '#dc3545',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '4px',
                      padding: '0.5rem',
                      cursor: 'pointer',
                      opacity: isDeletingCard ? 0.7 : 1
                    }}
                  >
                    {isDeletingCard ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </div>
              {cardError && (
                <p style={{ color: '#dc3545', marginTop: '0.5rem' }}>{cardError}</p>
              )}
              {selectedCard.description && (
                  <p style={{ margin: '1rem 0', whiteSpace: 'pre-wrap' }}>{selectedCard.description}</p>
                )}
                <div style={{ marginTop: '1rem', color: '#666', fontSize: '0.9rem' }}>
                  <p>Created: {new Date(selectedCard.createdAt || '').toLocaleString('en-GB', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}</p>
                  {selectedCard.updatedAt && (
                    <p>Last updated: {new Date(selectedCard.updatedAt).toLocaleString('en-GB', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}</p>
                  )}
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                  <button
                    onClick={closeCardModal}
                    style={{ background: '#eee', border: 'none', borderRadius: '4px', padding: '0.5rem 1rem', cursor: 'pointer' }}
                  >
                    Close
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
      {showDeleteBoardModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            background: 'rgba(0,0,0,0.2)',
            backdropFilter: 'blur(2px)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onClick={() => setShowDeleteBoardModal(false)}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#fff',
              borderRadius: '8px',
              boxShadow: '0 4px 24px rgba(0,0,0,0.15)',
              padding: '2rem',
              minWidth: '400px',
              maxWidth: '500px',
              width: '90%',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1rem' }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                background: '#fef2f2',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: '1rem'
              }}>
                <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '600' }}>Delete Board</h2>
            </div>
            
            <p style={{ marginBottom: '1.5rem', color: '#6b7280', lineHeight: '1.5' }}>
              Are you sure you want to delete "<strong>{board?.title}</strong>"? This action cannot be undone and will permanently remove the board and all its cards.
            </p>
            
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setShowDeleteBoardModal(false)}
                disabled={isDeletingBoard}
                style={{
                  background: '#f3f4f6',
                  color: '#374151',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '0.75rem 1.5rem',
                  cursor: 'pointer',
                  fontWeight: '500',
                  opacity: isDeletingBoard ? 0.5 : 1
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteBoard}
                disabled={isDeletingBoard}
                style={{
                  background: '#dc2626',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '0.75rem 1.5rem',
                  cursor: 'pointer',
                  fontWeight: '500',
                  opacity: isDeletingBoard ? 0.7 : 1
                }}
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
