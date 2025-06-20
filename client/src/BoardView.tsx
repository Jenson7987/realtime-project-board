import React, { useEffect, useState } from 'react';
import {
  DragDropContext,
  Droppable,
  Draggable,
  DropResult
} from '@hello-pangea/dnd';
import { io, Socket } from 'socket.io-client';
import { format } from 'date-fns';
import type { Card, Column, Board } from './types';
import { API_BASE_URL } from './config';
import { useAuth } from './contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useSocket } from './hooks/useSocket';

interface BoardResponse {
  board: Board;
  cards: Card[];
}

const BoardView: React.FC = () => {
  const { token, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const socket = useSocket();
  const [board, setBoard] = useState<Board | null>(null);
  const [isLoading, setIsLoading] = useState(true);
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
  
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    const fetchBoards = async () => {
      console.log('Fetching boards...');
      try {
        const response = await fetch(`${API_BASE_URL}/boards`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        console.log('Response status:', response.status);
        if (!response.ok) {
          throw new Error('Failed to fetch boards');
        }

        const data = await response.json();
        console.log('Received data:', data);

        // If user has no boards, create a default one
        if (!data.boards || data.boards.length === 0) {
          console.log('No boards found, creating default board...');
          const createResponse = await fetch(`${API_BASE_URL}/boards`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              title: 'My First Board',
              columns: [
                { title: 'To Do', position: 0 },
                { title: 'In Progress', position: 1 },
                { title: 'Done', position: 2 }
              ]
            })
          });

          console.log('Create response status:', createResponse.status);
          if (!createResponse.ok) {
            throw new Error('Failed to create default board');
          }

          const newBoard = await createResponse.json();
          console.log('Created new board:', newBoard);
          setBoard(newBoard.board);
        } else {
          console.log('Using existing board:', data.boards[0]);
          setBoard(data.boards[0]); // Use the first board
        }
      } catch (err) {
        console.error('Error fetching/creating board:', err);
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setIsLoading(false);
      }
    };

    fetchBoards();
  }, [token, navigate, isAuthenticated]);

  useEffect(() => {
    if (!socket || !board) return;

    const handleCardUpdate = (updatedCard: Card) => {
      setBoard(prev => {
        if (!prev) return null;
        return {
          ...prev,
          cards: prev.cards.map(card => 
            card._id === updatedCard._id ? updatedCard : card
          )
        };
      });
    };

    const handleCardCreate = (newCard: Card) => {
      setBoard(prev => {
        if (!prev) return null;
        return {
          ...prev,
          cards: [...prev.cards, newCard]
        };
      });
    };

    const handleCardDelete = (deletedCardId: string) => {
      setBoard(prev => {
        if (!prev) return null;
        return {
          ...prev,
          cards: prev.cards.filter(card => card._id !== deletedCardId)
        };
      });
    };

    const handleColumnUpdate = (updatedColumn: Column) => {
      setBoard(prev => {
        if (!prev) return null;
        return {
          ...prev,
          columns: prev.columns.map((col: Column) => 
            col._id === updatedColumn._id ? updatedColumn : col
          )
        };
      });
    };

    const handleColumnCreate = (newColumn: Column) => {
      setBoard(prev => {
        if (!prev) return null;
        return {
          ...prev,
          columns: [...prev.columns, newColumn]
        };
      });
    };

    const handleColumnDelete = (deletedColumnId: string) => {
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

    return () => {
      socket.off('cardUpdated', handleCardUpdate);
      socket.off('cardCreated', handleCardCreate);
      socket.off('cardDeleted', handleCardDelete);
      socket.off('columnUpdated', handleColumnUpdate);
      socket.off('columnCreated', handleColumnCreate);
      socket.off('columnDeleted', handleColumnDelete);
    };
  }, [socket, board]);

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

    const newCards = [...board.cards];

    // Update card's columnId and position
    const updatedCard = {
      ...card,
      columnId: destination.droppableId,
      position: destination.index
    };

    // Update the card in the array
    const cardIndex = newCards.findIndex(c => c._id === draggableId);
    if (cardIndex !== -1) {
      newCards[cardIndex] = updatedCard;
    }

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

    // Update the board state
    setBoard({
      ...board,
      cards: newCards
    });

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
      setBoard({
        ...board,
        cards: board.cards
      });
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
      
      // Emit socket event
      socket?.emit('cardCreated', {
        card: newCard,
        columnId: addCardColumnId,
        boardId: board._id
      });

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
      
      // Emit socket event
      socket?.emit('cardUpdated', {
        card: updatedCard,
        boardId: board._id
      });

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
      
      // Emit socket event
      socket?.emit('cardDeleted', {
        cardId: selectedCard._id,
        columnId: selectedCard.columnId,
        boardId: board._id
      });

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

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  if (!board) {
    return <div>No board found</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {isLoading ? (
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
        <div style={{ padding: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
            <h1 style={{ margin: 0 }}>{board.title}</h1>
          </div>
          <DragDropContext onDragEnd={onDragEnd}>
            <div style={{ display: 'flex', gap: '1rem', overflowX: 'auto' }}>
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
                          minHeight: '500px',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'stretch',
                          backgroundColor: snapshot.isDraggingOver ? '#f0f0f0' : '#fafafa',
                          border: '1px solid #ddd',
                          borderRadius: '8px',
                          padding: '1rem',
                          boxSizing: 'border-box',
                          overflowY: 'auto',
                          flexShrink: 0,
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                          <h2 style={{ margin: 0 }}>{col.title}</h2>
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
                        {provided.placeholder}
                        <button
                          style={{
                            marginTop: 'auto',
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
    </div>
  );
};

export default BoardView;
