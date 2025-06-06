export interface Card {
  _id: string;
  columnId: string;
  title: string;
  description?: string;
  position: number;
  dueDate?: Date;
  createdAt?: string;
  updatedAt?: string;
}

export interface Column {
  _id: string;
  name: string;
  position: number;
  cards: Card[];
}

export interface Board {
  _id: string;
  title: string;
  columns: Column[];
} 