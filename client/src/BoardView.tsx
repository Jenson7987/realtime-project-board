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

interface BoardResponse {
  board: Board;
  cards: Card[];
}

function BoardView() {
  const [data, setData] = useState<BoardResponse | null>(null);
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
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const newSocket = io('http://localhost:3001', {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      withCredentials: true
    });

    newSocket.on('connect', () => {
      console.log('Connected to Socket.io server');
    });

    newSocket.on('connect_error', (error) => {
      console.error('Socket.io connection error:', error);
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, []);

  useEffect(() => {
    // Fetch initial board data
    const fetchBoardData = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/boards/6842134e9f8121a878d81fad`);
        const boardData = await response.json();
        setData(boardData);
      } catch (error) {
        console.error('Error fetching board data:', error);
        setError('Failed to load board data');
      } finally {
        setIsLoading(false);
      }
    };

    fetchBoardData();
  }, []);

  useEffect(() => {
    if (socket && data) {
      // Join the board room
      socket.emit('joinBoard', data.board._id);
      console.log('Joined board room:', data.board._id);

      // Listen for real-time updates
      socket.on('cardUpdated', handleCardUpdate);
      socket.on('cardCreated', handleCardCreate);
      socket.on('cardDeleted', handleCardDelete);
      socket.on('columnUpdated', handleColumnUpdate);
      socket.on('columnCreated', handleColumnCreate);
      socket.on('columnDeleted', handleColumnDelete);

      return () => {
        socket.emit('leaveBoard', data.board._id);
        console.log('Left board room:', data.board._id);
        socket.off('cardUpdated');
        socket.off('cardCreated');
        socket.off('cardDeleted');
        socket.off('columnUpdated');
        socket.off('columnCreated');
        socket.off('columnDeleted');
      };
    }
  }, [socket, data]);

  // Real-time event handlers
  const handleCardUpdate = (eventData: { card: Card; boardId: string }) => {
    if (data && eventData.boardId === data.board._id) {
      setData(prev => {
        if (!prev) return null;
        return {
          ...prev,
          cards: prev.cards.map(card => 
            card._id === eventData.card._id ? eventData.card : card
          )
        };
      });
    }
  };

  const handleCardCreate = (eventData: { card: Card; columnId: string; boardId: string }) => {
    if (data && eventData.boardId === data.board._id) {
      setData(prev => {
        if (!prev) return null;
        return {
          ...prev,
          cards: [...prev.cards, eventData.card]
        };
      });
    }
  };

  const handleCardDelete = (eventData: { cardId: string; columnId: string; boardId: string }) => {
    if (data && eventData.boardId === data.board._id) {
      setData(prev => {
        if (!prev) return null;
        return {
          ...prev,
          cards: prev.cards.filter(card => card._id !== eventData.cardId)
        };
      });
    }
  };

  const handleColumnUpdate = (eventData: { column: Column; boardId: string }) => {
    if (data && eventData.boardId === data.board._id) {
      setData(prev => {
        if (!prev) return null;
        return {
          ...prev,
          board: {
            ...prev.board,
            columns: prev.board.columns.map((col: Column) => 
              col._id === eventData.column._id ? eventData.column : col
            )
          }
        };
      });
    }
  };

  const handleColumnCreate = (eventData: { column: Column; boardId: string }) => {
    if (data && eventData.boardId === data.board._id) {
      setData(prev => {
        if (!prev) return null;
        return {
          ...prev,
          board: {
            ...prev.board,
            columns: [...prev.board.columns, eventData.column]
          }
        };
      });
    }
  };

  const handleColumnDelete = (eventData: { columnId: string; boardId: string }) => {
    if (data && eventData.boardId === data.board._id) {
      setData(prev => {
        if (!prev) return null;
        return {
          ...prev,
          board: {
            ...prev.board,
            columns: prev.board.columns.filter((col: Column) => col._id !== eventData.columnId)
          }
        };
      });
    }
  };

  const onDragEnd = (result: DropResult) => {
    const { destination, source, draggableId } = result;
    if (!destination || !data) return;

    const updatedCards = [...data.cards];
    const draggedCard = updatedCards.find(c => c._id === draggableId);
    if (!draggedCard) return;

    const sourceColId = source.droppableId;
    const destColId = destination.droppableId;

    const fromCards = updatedCards
      .filter(c => c.columnId === sourceColId && c._id !== draggableId)
      .sort((a, b) => a.position - b.position);

    const toCards = updatedCards
      .filter(c => c.columnId === destColId && c._id !== draggableId)
      .sort((a, b) => a.position - b.position);

    if (sourceColId === destColId) {
      toCards.splice(destination.index, 0, draggedCard);
    } else {
      draggedCard.columnId = destColId;
      toCards.splice(destination.index, 0, draggedCard);
    }

    const affected = sourceColId === destColId ? toCards : [...fromCards, ...toCards];

    affected.forEach((card, i) => {
      card.position = i;
    });

    const newCards = updatedCards.map(c =>
      affected.find(a => a._id === c._id) || c
    );

    setData({ ...data, cards: newCards });

    // Update each affected card and emit socket events
    affected.forEach(async card => {
      try {
        const response = await fetch(`${API_BASE_URL}/cards/${card._id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ columnId: card.columnId, position: card.position }),
        });
        
        if (!response.ok) throw new Error('Failed to update card position');
        
        const updatedCard = await response.json();
        
        // Emit socket event
        socket?.emit('cardUpdated', {
          card: updatedCard,
          boardId: data.board._id
        });
      } catch (error) {
        console.error('Error updating card position:', error);
      }
    });
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
    if (!addCardColumnId || !data) return;

    setIsSubmitting(true);
    try {
      const columnCards = data.cards.filter(c => c.columnId === addCardColumnId);
      const maxPosition = Math.max(...columnCards.map(c => c.position), -1);
      
      const response = await fetch(`${API_BASE_URL}/cards`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newCardTitle,
          description: newCardDescription,
          columnId: addCardColumnId,
          position: maxPosition + 1,
          boardId: data.board._id
        }),
      });

      if (!response.ok) throw new Error('Failed to create card');
      
      const newCard = await response.json();
      
      // Emit socket event
      socket?.emit('cardCreated', {
        card: newCard,
        columnId: addCardColumnId,
        boardId: data.board._id
      });

      setData(prev => {
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
    if (!data) return;

    setIsSubmittingColumn(true);
    try {
      const maxPosition = Math.max(...data.board.columns.map(c => c.position), -1);
      
      const response = await fetch(`${API_BASE_URL}/boards/${data.board._id}/columns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newColumnName,
          position: maxPosition + 1
        }),
      });

      if (!response.ok) throw new Error('Failed to create column');
      
      const newColumn = await response.json();
      
      // Emit socket event
      socket?.emit('columnCreated', {
        column: newColumn,
        boardId: data.board._id
      });

      setData(prev => {
        if (!prev) return null;
        return {
          ...prev,
          board: {
            ...prev.board,
            columns: [...prev.board.columns, newColumn]
          }
        };
      });
      
      closeAddColumnModal();
    } catch (error) {
      console.error('Error creating column:', error);
    } finally {
      setIsSubmittingColumn(false);
    }
  };

  const handleCardClick = (card: Card) => {
    setSelectedCard(card);
    setEditedCardTitle(card.title);
    setEditedCardDescription(card.description || '');
  };

  const closeCardModal = () => {
    setSelectedCard(null);
    setIsEditingCard(false);
  };

  const handleEditCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCard || !data) return;

    try {
      const response = await fetch(`${API_BASE_URL}/cards/${selectedCard._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editedCardTitle,
          description: editedCardDescription
        }),
      });

      if (!response.ok) throw new Error('Failed to update card');
      
      const updatedCard = await response.json();
      
      // Emit socket event
      socket?.emit('cardUpdated', {
        card: updatedCard,
        boardId: data.board._id
      });

      setData(prev => {
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
    }
  };

  const handleDeleteCard = async () => {
    if (!selectedCard || !data) return;

    try {
      const response = await fetch(`${API_BASE_URL}/cards/${selectedCard._id}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete card');
      
      // Emit socket event
      socket?.emit('cardDeleted', {
        cardId: selectedCard._id,
        columnId: selectedCard.columnId,
        boardId: data.board._id
      });

      setData(prev => {
        if (!prev) return null;
        return {
          ...prev,
          cards: prev.cards.filter(card => card._id !== selectedCard._id)
        };
      });
      
      closeCardModal();
    } catch (error) {
      console.error('Error deleting card:', error);
    }
  };

  const handleDeleteColumn = async (columnId: string) => {
    if (!data) return;

    try {
      const response = await fetch(`${API_BASE_URL}/boards/${data.board._id}/columns/${columnId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete column');
      
      // Emit socket event
      socket?.emit('columnDeleted', {
        columnId,
        boardId: data.board._id
      });

      setData(prev => {
        if (!prev) return null;
        return {
          ...prev,
          board: {
            ...prev.board,
            columns: prev.board.columns.filter(col => col._id !== columnId)
          },
          cards: prev.cards.filter(card => card.columnId !== columnId)
        };
      });
      
      setIsDeletingColumn(null);
    } catch (error) {
      console.error('Error deleting column:', error);
    }
  };

  if (!data || !data.board) return <p>Loading...</p>;
  const { board, cards } = data;

  return (
    <div className="board" style={{ padding: '1rem', position: 'relative' }}>
      <h1>{board.title}</h1>
      <DragDropContext onDragEnd={onDragEnd}>
        <div style={{ display: 'flex', gap: '1rem', overflowX: 'auto' }}>
          {board.columns && board.columns.map(col => {
            const columnCards = cards.filter(card => card.columnId === col._id);
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
                      <h2 style={{ margin: 0 }}>{col.name}</h2>
                      <button
                        onClick={() => handleDeleteColumn(col._id)}
                        disabled={isDeletingColumn === col._id}
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
              placeholder="Column Name"
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
}

export default BoardView;
