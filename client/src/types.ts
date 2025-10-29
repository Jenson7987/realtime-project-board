export interface Card {
  _id: string;
  columnId: string;
  title: string;
  description: string;
  position: number;
  createdAt: string;
  updatedAt: string;
  createdBy: User;
  modifiedBy: User;
}

export interface Column {
  _id: string;
  name?: string;
  title?: string;
  position: number;
}

export interface User {
  _id: string;
  username: string;
  firstName: string;
  lastName: string;
}

export interface Board {
  _id: string;
  title: string;
  slug: string;
  owner: User;
  ownerUsername: string;
  sharedWith: string[];
  columns: Column[];
  cards: Card[];
  createdAt: string;
  updatedAt: string;
  isStarred?: boolean;
} 