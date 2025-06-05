import React, { useEffect, useState } from 'react';

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
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [newCard, setNewCard] = useState({ title: '', description: '', column: '' });

  useEffect(() => {
    fetch('/api/boards/6842134e9f8121a878d81fad') // Temporary (Replace with dynamic board selection later)
      .then(res => res.json())
      .then(json => {
        setData(json);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load board', err);
        setLoading(false);
      });
  }, []);

  const handleAddCard = async () => {
    if (!data) return;

    await fetch('/api/cards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        boardId: data.board._id,
        column: newCard.column,
        title: newCard.title,
        description: newCard.description,
        position: 0,
      }),
    });

    setShowModal(false);
    setNewCard({ title: '', description: '', column: '' });

    // Reload
    const res = await fetch(`/api/boards/${data.board._id}`);
    const updated = await res.json();
    setData(updated);
  };

  if (loading) return <p>Loading...</p>;
  if (!data || !data.board) return <p>Board not found.</p>;

  const { board, cards } = data;

  return (
    <div className="board" style={{ position: 'relative' }}>
      <h1>{board.title}</h1>
      <button onClick={() => setShowModal(true)}>+ Add Card</button>
      <div style={{ display: 'flex', gap: '1rem' }}>
        {board.columns.map(col => (
          <div key={col.name} className="column" style={{ minWidth: '200px', border: '1px solid #ccc', padding: '1rem' }}>
            <h2>{col.name}</h2>
            {cards
              .filter(card => card.column === col.name)
              .sort((a, b) => a.position - b.position)
              .map(card => (
                <div key={card._id} className="card" style={{ margin: '0.5rem 0', padding: '0.5rem', border: '1px solid #aaa' }}>
                  <strong>{card.title}</strong>
                  {card.description && <p>{card.description}</p>}
                </div>
              ))}
          </div>
        ))}
      </div>

      {showModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', justifyContent: 'center', alignItems: 'center'
        }}>
          <div style={{ backgroundColor: 'white', padding: '2rem', borderRadius: '8px', minWidth: '300px' }}>
            <h2>New Card</h2>
            <select
              value={newCard.column}
              onChange={e => setNewCard({ ...newCard, column: e.target.value })}
            >
              <option value="" disabled>Select Column</option>
              {board.columns.map(c => (
                <option key={c.name} value={c.name}>{c.name}</option>
              ))}
            </select>
            <br /><br />
            <input
              placeholder="Title"
              value={newCard.title}
              onChange={e => setNewCard({ ...newCard, title: e.target.value })}
              style={{ width: '100%' }}
            />
            <br /><br />
            <textarea
              placeholder="Description"
              value={newCard.description}
              onChange={e => setNewCard({ ...newCard, description: e.target.value })}
              style={{ width: '100%' }}
            />
            <br /><br />
            <button onClick={handleAddCard}>Add</button>
            <button onClick={() => setShowModal(false)} style={{ marginLeft: '1rem' }}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default BoardView;
