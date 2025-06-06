import React, { useEffect, useState } from 'react';
import {
  DragDropContext,
  Droppable,
  Draggable,
  DropResult
} from '@hello-pangea/dnd';

interface Card {
  _id: string;
  columnId: string;
  title: string;
  description?: string;
  position: number;
  createdAt?: string;
  updatedAt?: string;
}

interface Column {
  _id: string;
  name: string;
  position: number;
}

interface Board {
  _id: string;
  title: string;
  columns: Column[];
}

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

  useEffect(() => {
    fetch('/api/boards/6842134e9f8121a878d81fad')
      .then(res => res.json())
      .then(json => setData(json))
      .catch(console.error);
  }, []);

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

    affected.forEach(card => {
      fetch(`/api/cards/${card._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ columnId: card.columnId, position: card.position }),
      }).catch(console.error);
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
    if (!data || !addCardColumnId || !newCardTitle.trim()) return;
    setIsSubmitting(true);
    const columnCards = data.cards.filter(c => c.columnId === addCardColumnId);
    const newCard = {
      boardId: data.board._id,
      columnId: addCardColumnId,
      title: newCardTitle.trim(),
      description: newCardDescription.trim(),
      position: columnCards.length,
    };
    try {
      const res = await fetch('/api/cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCard),
      });
      const created = await res.json();
      setData({
        ...data,
        cards: [...data.cards, created],
      });
      closeAddCardModal();
    } catch (err) {
      alert('Failed to add card');
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
    if (!data || !newColumnName.trim()) return;

    setIsSubmittingColumn(true);
    try {
      const newColumn = {
        name: newColumnName.trim(),
        position: data.board.columns ? data.board.columns.length : 0,
      };

      const response = await fetch(`/api/boards/${data.board._id}/columns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newColumn),
      });

      if (!response.ok) throw new Error('Failed to add column');

      const updatedBoard = await response.json();
      setData({
        ...data,
        board: updatedBoard,
      });
      setNewColumnName('');
      closeAddColumnModal();
    } catch (error) {
      console.error('Error adding column:', error);
      alert('Failed to add column. Please try again.');
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
    if (!selectedCard || !editedCardTitle.trim()) return;

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/cards/${selectedCard._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editedCardTitle.trim(),
          description: editedCardDescription.trim(),
        }),
      });

      if (!response.ok) throw new Error('Failed to update card');

      const updatedCard = await response.json();
      setData(prev => {
        if (!prev) return null;
        return {
          ...prev,
          cards: prev.cards.map(card => 
            card._id === updatedCard._id ? updatedCard : card
          ),
        };
      });
      closeCardModal();
    } catch (error) {
      console.error('Error updating card:', error);
      alert('Failed to update card. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteCard = async () => {
    if (!selectedCard) return;
    
    if (!window.confirm('Are you sure you want to delete this card?')) return;
    
    setIsDeletingCard(true);
    try {
      const response = await fetch(`/api/cards/${selectedCard._id}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete card');

      setData(prev => {
        if (!prev) return null;
        return {
          ...prev,
          cards: prev.cards.filter(card => card._id !== selectedCard._id),
        };
      });
      closeCardModal();
    } catch (error) {
      console.error('Error deleting card:', error);
      alert('Failed to delete card. Please try again.');
    } finally {
      setIsDeletingCard(false);
    }
  };

  const handleDeleteColumn = async (columnId: string) => {
    if (!data) return;
    
    const columnCards = data.cards.filter(card => card.columnId === columnId);
    if (columnCards.length > 0) {
      alert('Cannot delete column: Please remove all cards from this column first.');
      return;
    }
    
    if (!window.confirm('Are you sure you want to delete this column?')) return;
    
    setIsDeletingColumn(columnId);
    try {
      const response = await fetch(`/api/boards/${data.board._id}/columns/${columnId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete column');
      }

      const updatedBoard = await response.json();
      setData({
        ...data,
        board: updatedBoard,
      });
    } catch (error) {
      console.error('Error deleting column:', error);
      alert(error instanceof Error ? error.message : 'Failed to delete column. Please try again.');
    } finally {
      setIsDeletingColumn(null);
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
