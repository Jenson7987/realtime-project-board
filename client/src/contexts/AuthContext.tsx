import React, { createContext, useContext, useState, useEffect } from 'react';
import { API_BASE_URL } from '../config';

interface User {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  isEmailVerified: boolean;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string, firstName: string, lastName: string) => Promise<void>;
  logout: () => void;
  updateUser: (updatedUser: User) => void;
  isAuthenticated: boolean;
  isLoading: boolean;
  requiresVerification: boolean;
  isBackendOnline: boolean;
  checkBackendStatus: () => Promise<void>;
  clearVerification: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [isLoading, setIsLoading] = useState(!!localStorage.getItem('token'));
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [requiresVerification, setRequiresVerification] = useState(false);
  const [isBackendOnline, setIsBackendOnline] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      if (!token) {
        setIsLoading(false);
        return;
      }

      try {
        const response = await fetch(`${API_BASE_URL}/auth/me`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.ok) {
          const userData = await response.json();
          // Map _id to id for consistency with the interface
          const mappedUser = {
            ...userData,
            id: userData._id || userData.id,
            isEmailVerified: userData.isEmailVerified || false
          };
          setUser(mappedUser);
          
          // Check if user needs verification
          if (!mappedUser.isEmailVerified) {
            setRequiresVerification(true);
          }
        } else {
          // If token is invalid, clear everything
          localStorage.removeItem('token');
          setToken(null);
          setUser(null);
        }
      } catch (error) {
        console.error('Error fetching user:', error);
        localStorage.removeItem('token');
        setToken(null);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUser();
  }, [token]);

  const login = async (username: string, password: string) => {
    console.log('Login attempt started:', { username });
    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, password })
      });

      console.log('Login response status:', response.status);
      const data = await response.json();
      console.log('Login response data:', data);

      if (!response.ok) {
        if (response.status === 403 && data.requiresVerification) {
          // User needs to verify email
          setRequiresVerification(true);
          setUser(data.user);
          setToken(localStorage.getItem('token')); // Keep existing token
          throw new Error('Please verify your email address before logging in');
        }
        throw new Error(data.error || 'Failed to login');
      }

      console.log('Setting token and user data');
      localStorage.setItem('token', data.token);
      setToken(data.token);
      // Map _id to id for consistency with the interface
      const mappedUser = {
        ...data.user,
        id: data.user._id || data.user.id,
        isEmailVerified: data.user.isEmailVerified || false
      };
      setUser(mappedUser);
      setRequiresVerification(false);
      console.log('Login successful');
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };

  const register = async (username: string, email: string, password: string, firstName: string, lastName: string) => {
    const response = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ username, email, password, firstName, lastName })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to register');
    }

    const data = await response.json();
    localStorage.setItem('token', data.token);
    setToken(data.token);
    // Map _id to id for consistency with the interface
    const mappedUser = {
      ...data.user,
      id: data.user._id || data.user.id,
      isEmailVerified: data.user.isEmailVerified || false
    };
    setUser(mappedUser);
    
    // Check if verification is required
    if (data.requiresVerification) {
      setRequiresVerification(true);
    }
  };

  const updateUser = (updatedUser: User) => {
    setUser(updatedUser);
    if (updatedUser.isEmailVerified) {
      setRequiresVerification(false);
    }
  };

  const logout = () => {
    setIsLoggingOut(true);
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    setRequiresVerification(false);
    
    // Use setTimeout to ensure state is cleared before navigation
    setTimeout(() => {
      setIsLoggingOut(false);
      // Use window.location to force navigation to home page and clear any cached state
      window.location.href = '/';
    }, 100);
  };

  const clearVerification = () => {
    setRequiresVerification(false);
    setUser(null);
    setToken(null);
    localStorage.removeItem('token');
  };

  const checkBackendStatus = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/health`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      setIsBackendOnline(response.ok);
    } catch (error) {
      setIsBackendOnline(false);
    }
  };

  // Check backend status on mount and periodically
  useEffect(() => {
    checkBackendStatus();
    const interval = setInterval(checkBackendStatus, 30000); // Check every 30 seconds
    return () => clearInterval(interval);
  }, []);

  return (
    <AuthContext.Provider value={{ 
      user, 
      token, 
      login, 
      register, 
      logout,
      updateUser,
      isAuthenticated: !!token && !!user && !isLoggingOut,
      isLoading: isLoading,
      requiresVerification,
      isBackendOnline,
      checkBackendStatus,
      clearVerification
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}; 