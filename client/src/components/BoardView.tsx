import React, { useEffect, useState } from 'react';
import {
  DragDropContext,
  Droppable,
  Draggable,
  DropResult
} from '@hello-pangea/dnd';
import { io, Socket } from 'socket.io-client';
import { format } from 'date-fns';
import type { Card, Column, Board } from '../types';
import { API_BASE_URL } from '../config';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useSocket } from '../hooks/useSocket';

const BoardView: React.FC = () => {
  const { token, isAuthenticated, logout } = useAuth();
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
      const columnCards = board.cards.filter((c: Card) => c.columnId === addCardColumnId);
      const maxPosition = Math.max(...columnCards.map((c: Card) => c.position), -1);
      
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

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create card');
      }
      
      const newCard = await response.json();
      console.log('Card created successfully:', newCard);
      
      // Update the board state with the new card
      setBoard((prev: Board | null) => {
        if (!prev) return null;
        return {
          ...prev,
          cards: [...prev.cards, newCard]
        };
      });
      
      closeAddCardModal();
    } catch (error) {
      console.error('Error creating card:', error);
      alert(error instanceof Error ? error.message : 'Failed to create card');
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    if (!socket || !board) return;

    // Join the board room
    socket.emit('joinBoard', board._id);

    // Cleanup function
    return () => {
      socket.emit('leaveBoard', board._id);
    };
  }, [socket, board]);

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!board) return <div>No board found</div>;

  return (
    <div style={{ padding: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1 style={{ margin: 0 }}>{board.title}</h1>
        <button onClick={logout} style={{ background: '#eee', border: 'none', borderRadius: '4px', padding: '0.5rem 1rem', cursor: 'pointer' }}>Logout</button>
      </div>
      <DragDropContext onDragEnd={() => {}}>
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
                      <h2 style={{ margin: 0 }}>{col.title || col.name}</h2>
                      <button
                        onClick={() => {}}
                        disabled={!isEmpty}
                        style={{
                          background: 'none',
                          border: 'none',
                          padding: '0.25rem',
                          cursor: isEmpty ? 'pointer' : 'not-allowed',
                          opacity: isEmpty ? 0.7 : 0.3,
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
                      onClick={() => setShowAddCardModal(true)}
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
            onClick={() => {}}
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
    </div>
  );
};

export default BoardView; 