import React, { useEffect, useState, useCallback } from "react";
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { API_BASE_URL } from '../config';
import { Board } from '../types';
import { getAvatarColor, getInitials } from '../utils/avatarColors';
import Logo from './Logo';

const Boards: React.FC = () => {
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();
  const [boards, setBoards] = useState<Board[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newBoardTitle, setNewBoardTitle] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [starringBoard, setStarringBoard] = useState<string | null>(null);

  // Get avatar color and initials
  const avatarColor = getAvatarColor(user?.id || user?.username || '');
  const initials = getInitials(user?.firstName, user?.lastName);

  const fetchBoards = useCallback(async () => {
    if (!token) return;
    
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/boards`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!response.ok) throw new Error('Failed to fetch boards');
      
      const data = await response.json();
      setBoards(data.boards || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch boards');
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) {
      fetchBoards();
    } else {
      setIsLoading(false);
    }
  }, [token, fetchBoards]);

  // Close user menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!target.closest('.user-menu-container')) {
        setShowUserMenu(false);
      }
    };

    if (showUserMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showUserMenu]);

  const createDefaultBoard = async () => {
    if (!token) return;
    
    setIsCreating(true);
    try {
      const response = await fetch(`${API_BASE_URL}/boards`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          title: 'Sample Board',
          columns: [
            { title: 'To Do', position: 0 },
            { title: 'In Progress', position: 1 },
            { title: 'Done', position: 2 }
          ],
          sampleCards: true // Flag to indicate this should include sample cards
        })
      });
      
      if (!response.ok) throw new Error('Failed to create sample board');
      
      const data = await response.json();
      navigate(`/${user?.username}/${data.board.slug}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create sample board');
    } finally {
      setIsCreating(false);
    }
  };

  const createBoard = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Create board function called');
    console.log('Token:', token);
    console.log('Board title:', newBoardTitle);
    
    if (!token || !newBoardTitle.trim()) {
      console.log('Missing token or board title');
      return;
    }
    
    setIsCreating(true);
    try {
      console.log('Making API request to create board...');
      const response = await fetch(`${API_BASE_URL}/boards`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          title: newBoardTitle.trim(),
          columns: [
            { title: 'To Do', position: 0 },
            { title: 'In Progress', position: 1 },
            { title: 'Done', position: 2 }
          ]
        })
      });
      
      console.log('Response status:', response.status);
      console.log('Response ok:', response.ok);
      
      if (!response.ok) {
        const error = await response.json();
        console.log('Error response:', error);
        throw new Error(error.error || 'Failed to create board');
      }
      
      const data = await response.json();
      console.log('Success response:', data);
      setNewBoardTitle('');
      setShowCreateModal(false);
      await fetchBoards();
      navigate(`/${user?.username}/${data.board.slug}`);
    } catch (err) {
      console.error('Error creating board:', err);
      setError(err instanceof Error ? err.message : 'Failed to create board');
    } finally {
      setIsCreating(false);
    }
  };

  const handleLogout = () => {
    logout();
  };

  const handleStarBoard = async (boardId: string, isStarred: boolean, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    setStarringBoard(boardId);
    try {
      const response = await fetch(`${API_BASE_URL}/boards/${boardId}/star`, {
        method: isStarred ? 'DELETE' : 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (!response.ok) throw new Error('Failed to update star status');

      // Update the board's starred status in the local state
      setBoards(prev => prev.map(board => 
        board._id === boardId ? { ...board, isStarred: !isStarred } : board
      ));
    } catch (err) {
      console.error('Error updating star status:', err);
    } finally {
      setStarringBoard(null);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 text-lg">Loading your boards...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center space-x-6">
                <nav className="hidden md:flex items-center space-x-8">
                  <Link to="/">
                    <Logo className="hover:opacity-80 transition-opacity" />
                  </Link>
                {user && (
                  <Link
                    to="/boards"
                    className="text-gray-700 hover:text-blue-600 font-medium transition-colors"
                  >
                    My Boards
                  </Link>
                )}
              </nav>
            </div>
            <div className="flex items-center space-x-4">
              <div className="relative user-menu-container">
                <div 
                  className="flex items-center space-x-3 bg-white/60 backdrop-blur-sm rounded-full px-4 py-2 border border-gray-200 cursor-pointer hover:bg-white hover:shadow-md transition-all duration-200"
                  onClick={() => setShowUserMenu(!showUserMenu)}
                >
                  <div 
                    className="w-8 h-8 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: avatarColor.bg, color: avatarColor.text }}
                  >
                    <span className="text-sm font-semibold">
                      {initials}
                    </span>
                  </div>
                  <div className="text-sm">
                    <p className="font-medium text-gray-900">{user?.firstName} {user?.lastName}</p>
                    <p className="text-gray-500">@{user?.username}</p>
                  </div>
                  <svg 
                    className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${showUserMenu ? 'rotate-180' : ''}`} 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
                
                {showUserMenu && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-gray-200 py-2 z-50">
                    <button
                      onClick={handleLogout}
                      className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      <span>Sign out</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {error && (
          <div className="mb-8 bg-red-50 border border-red-200 rounded-xl p-4">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-red-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <span className="text-red-800">{error}</span>
            </div>
          </div>
        )}

        {/* Welcome Section */}
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            Welcome back, {user?.firstName}!
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Create and manage your project boards. Get started with a sample board or build your own from scratch.
          </p>
        </div>

        {/* Action Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 hover:shadow-lg transition-all duration-300">
            <div className="flex items-center mb-6">
              <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center mr-4">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </div>
              <div>
                <h3 className="text-xl font-semibold text-gray-900">Create New Board</h3>
                <p className="text-gray-600">Start with a blank canvas</p>
              </div>
            </div>
            <p className="text-gray-600 mb-6">
              Create a custom board tailored to your specific project needs. Perfect for teams and complex workflows.
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="w-full bg-blue-600 text-white font-medium rounded-xl py-3 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200 transform hover:scale-[1.02]"
            >
              Create Board
            </button>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 hover:shadow-lg transition-all duration-300">
            <div className="flex items-center mb-6">
              <div className="w-12 h-12 bg-green-600 rounded-xl flex items-center justify-center mr-4">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <div>
                <h3 className="text-xl font-semibold text-gray-900">Try Sample Board</h3>
                <p className="text-gray-600">See it in action</p>
              </div>
            </div>
            <p className="text-gray-600 mb-6">
              Explore a pre-built board with sample cards to see how everything works. Great for getting started quickly.
            </p>
            <button
              onClick={createDefaultBoard}
              disabled={isCreating}
              className="w-full bg-green-600 text-white font-medium rounded-xl py-3 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-all duration-200 transform hover:scale-[1.02] disabled:opacity-50 disabled:transform-none"
            >
              {isCreating ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  Creating...
                </div>
              ) : (
                'Try Sample Board'
              )}
            </button>
          </div>
        </div>

        {/* Boards Section */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-2xl font-bold text-gray-900">Your Boards</h3>
            <div className="text-sm text-gray-500">
              {boards.length} board{boards.length !== 1 ? 's' : ''}
            </div>
          </div>

          {/* Starred Boards Section */}
          {boards.filter(board => board.isStarred).length > 0 && (
            <div className="mb-8">
              <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <svg className="w-5 h-5 text-yellow-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                Starred Boards
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {boards.filter(board => board.isStarred).map((board) => (
                  <Link
                    key={board._id}
                    to={`/${board.ownerUsername}/${board.slug}`}
                    className="group bg-white rounded-2xl shadow-sm border border-gray-200 p-6 hover:shadow-lg hover:border-blue-300 transition-all duration-300 transform hover:scale-[1.02] relative"
                  >
                    <div className="absolute top-4 right-4 z-10">
                      <button
                        onClick={(e) => handleStarBoard(board._id, true, e)}
                        disabled={starringBoard === board._id}
                        className="text-yellow-500 hover:text-yellow-600 transition-colors disabled:opacity-50"
                      >
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                      </button>
                    </div>
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1 min-w-0">
                        <h4 className="text-lg font-semibold text-gray-900 truncate group-hover:text-blue-600 transition-colors">
                          {board.title}
                        </h4>
                        <div className="text-sm text-gray-500 mt-1 space-y-1">
                          <p>Created {new Date(board.createdAt).toLocaleDateString()}</p>
                          <p>Last modified {new Date(board.updatedAt).toLocaleDateString()}</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2 mr-8">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {board.cards?.length || 0} cards
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center text-sm text-gray-500">
                        <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center mr-2">
                          <span className="text-white text-xs font-semibold">
                            {board.ownerUsername[0].toUpperCase()}
                          </span>
                        </div>
                        @{board.ownerUsername}
                      </div>
                      <svg className="w-5 h-5 text-gray-400 group-hover:text-blue-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* All Boards Section */}
          <div>
            <h4 className="text-lg font-semibold text-gray-900 mb-4">All Boards</h4>
            {boards.length === 0 ? (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-12 text-center">
                <div className="w-24 h-24 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-6">
                  <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <h4 className="text-xl font-semibold text-gray-900 mb-2">No boards yet</h4>
                <p className="text-gray-600 mb-8 max-w-md mx-auto">
                  Create your first board to start organising your projects and tasks. You can create a custom board or try our sample board to see how it works.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="px-6 py-3 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200"
                  >
                    Create Your First Board
                  </button>
                  <button
                    onClick={createDefaultBoard}
                    className="px-6 py-3 bg-white text-gray-700 font-medium rounded-xl border border-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-all duration-200"
                  >
                    Try Sample Board
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {boards.map((board) => (
                  <Link
                    key={board._id}
                    to={`/${board.ownerUsername}/${board.slug}`}
                    className="group bg-white rounded-2xl shadow-sm border border-gray-200 p-6 hover:shadow-lg hover:border-blue-300 transition-all duration-300 transform hover:scale-[1.02] relative"
                  >
                    <div className="absolute top-4 right-4 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                      <button
                        onClick={(e) => handleStarBoard(board._id, board.isStarred || false, e)}
                        disabled={starringBoard === board._id}
                        className={`transition-colors disabled:opacity-50 ${
                          board.isStarred 
                            ? 'text-yellow-500 hover:text-yellow-600' 
                            : 'text-gray-400 hover:text-yellow-500'
                        }`}
                      >
                        <svg className="w-5 h-5" fill={board.isStarred ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                      </button>
                    </div>
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1 min-w-0">
                        <h4 className="text-lg font-semibold text-gray-900 truncate group-hover:text-blue-600 transition-colors">
                          {board.title}
                        </h4>
                        <div className="text-sm text-gray-500 mt-1 space-y-1">
                          <p>Created {new Date(board.createdAt).toLocaleDateString()}</p>
                          <p>Last modified {new Date(board.updatedAt).toLocaleDateString()}</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2 mr-8">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {board.cards?.length || 0} cards
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center text-sm text-gray-500">
                        <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center mr-2">
                          <span className="text-white text-xs font-semibold">
                            {board.ownerUsername[0].toUpperCase()}
                          </span>
                        </div>
                        @{board.ownerUsername}
                      </div>
                      <svg className="w-5 h-5 text-gray-400 group-hover:text-blue-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Create Board Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-gray-900">Create New Board</h3>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <form onSubmit={createBoard}>
                <div className="mb-6">
                  <label htmlFor="boardTitle" className="block text-sm font-medium text-gray-700 mb-2">
                    Board Name
                  </label>
                  <input
                    type="text"
                    id="boardTitle"
                    value={newBoardTitle}
                    onChange={(e) => setNewBoardTitle(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    placeholder="Enter board name..."
                    required
                    autoFocus
                  />
                </div>
                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-xl hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isCreating || !newBoardTitle.trim()}
                    className="px-6 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-xl hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 transition-all duration-200"
                  >
                    {isCreating ? 'Creating...' : 'Create Board'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Boards;
