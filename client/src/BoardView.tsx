import React, { useEffect, useState } from 'react';
import {
  DragDropContext,
  Droppable,
  Draggable,
  DropResult
} from '@hello-pangea/dnd';

interface Card {
  _id: string;
  column: string;
  title: string;
  description?: string;
  position: number;
}

interface Column {
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

    const sourceCol = source.droppableId;
    const destCol = destination.droppableId;

    const fromCards = updatedCards
      .filter(c => c.column === sourceCol && c._id !== draggableId)
      .sort((a, b) => a.position - b.position);

    const toCards = updatedCards
      .filter(c => c.column === destCol && c._id !== draggableId)
      .sort((a, b) => a.position - b.position);

    if (sourceCol === destCol) {
      toCards.splice(destination.index, 0, draggedCard);
    } else {
      draggedCard.column = destCol;
      toCards.splice(destination.index, 0, draggedCard);
    }

    const affected = sourceCol === destCol ? toCards : [...fromCards, ...toCards];

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
        body: JSON.stringify({ column: card.column, position: card.position }),
      }).catch(console.error);
    });
  };

  if (!data || !data.board) return <p>Loading...</p>;
  const { board, cards } = data;

  return (
    <div className="board" style={{ padding: '1rem' }}>
      <h1>{board.title}</h1>
      <DragDropContext onDragEnd={onDragEnd}>
        <div style={{ display: 'flex', gap: '1rem', overflowX: 'auto' }}>
          {board.columns.map(col => (
            <Droppable droppableId={col.name} key={col.name}>
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
                  <h2>{col.name}</h2>
                  {cards
                    .filter(card => card.column === col.name)
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
                </div>
              )}
            </Droppable>
          ))}
        </div>
      </DragDropContext>
    </div>
  );
}

export default BoardView;
