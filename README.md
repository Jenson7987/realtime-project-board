# Project Board

A real-time collaboration tool for organizing work with drag-and-drop interface. Built with React, Node.js, Socket.IO, and MongoDB.

## Features

- Real-time collaboration with live updates
- Drag-and-drop card management
- User authentication and authorization
- Board sharing and team collaboration
- Responsive design with Tailwind CSS
- MongoDB for data persistence

## Project Structure

- `client/` - React frontend application
- `server/` - Node.js backend with Express and Socket.IO

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- MongoDB

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   cd client && npm install
   cd ../server && npm install
   ```
3. Set up environment variables in `.env` file
4. Start the development servers:
   ```bash
   # Terminal 1 - Start server
   cd server && npm run dev
   
   # Terminal 2 - Start client
   cd client && npm start
   ```

## Technologies Used

- **Frontend**: React, TypeScript, Tailwind CSS, Socket.IO Client
- **Backend**: Node.js, Express, Socket.IO, MongoDB, Mongoose
- **Authentication**: JWT, bcryptjs