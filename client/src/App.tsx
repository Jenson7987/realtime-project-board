import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import BoardView from './BoardView';
import Home from './components/Home';
import Boards from './components/Boards';
import Login from './components/Login';
import Register from './components/Register';
import VerifyEmail from './components/VerifyEmail';
import EmailVerification from './components/EmailVerification';
import ForgotPassword from './components/ForgotPassword';
import ResetPassword from './components/ResetPassword';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, requiresVerification } = useAuth();
  
  // Show loading while authentication is being checked
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }
  
  // Redirect to verification page if user needs to verify email
  if (requiresVerification) {
    return <Navigate to="/verify-email" replace />;
  }
  
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, requiresVerification } = useAuth();
  
  // If user needs verification, redirect to verification page
  if (requiresVerification) {
    return <Navigate to="/verify-email" replace />;
  }
  
  return isAuthenticated ? <Navigate to="/" replace /> : <>{children}</>;
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          <Route
            path="/login"
            element={
              <PublicRoute>
                <Login />
              </PublicRoute>
            }
          />
          <Route
            path="/register"
            element={
              <PublicRoute>
                <Register />
              </PublicRoute>
            }
          />
          <Route
            path="/verify-email"
            element={<EmailVerification />}
          />
          <Route
            path="/verify-email-link"
            element={<VerifyEmail />}
          />
          <Route
            path="/forgot-password"
            element={
              <PublicRoute>
                <ForgotPassword />
              </PublicRoute>
            }
          />
          <Route
            path="/reset-password"
            element={
              <PublicRoute>
                <ResetPassword />
              </PublicRoute>
            }
          />
          <Route
            path="/boards"
            element={
              <PrivateRoute>
                <Boards />
              </PrivateRoute>
            }
          />
          <Route
            path="/:username/:slug"
            element={
              <PrivateRoute>
                <BoardView />
              </PrivateRoute>
            }
          />
          <Route
            path="/"
            element={<Home />}
          />
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;
