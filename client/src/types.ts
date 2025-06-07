export interface Card {
  _id: string;
  columnId: string;
  title: string;
  description: string;
  position: number;
  createdAt: string;
  updatedAt: string;
}

export interface Column {
  _id: string;
  name?: string;
  title?: string;
  position: number;
}

export interface Board {
  _id: string;
  title: string;
  owner: {
    _id: string;
    username: string;
    email: string;
  };
  sharedWith: string[];
  columns: Column[];
  cards: Card[];
  createdAt: string;
  updatedAt: string;
} 