import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { getAvatarColor, getInitials } from '../utils/avatarColors';

const Header: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Get avatar color based on user ID
  const avatarColor = getAvatarColor(user?.id || user?.username || '');
  const initials = getInitials(user?.firstName, user?.lastName);

  // Get full name
  const getFullName = () => {
    if (!user) return '';
    const { firstName, lastName } = user;
    return `${firstName || ''} ${lastName || ''}`.trim();
  };

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    logout();
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      right: 0,
      padding: '1rem',
      zIndex: 1000
    }}>
      <div style={{ position: 'relative' }} ref={menuRef}>
        <button
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            backgroundColor: avatarColor.bg,
            color: avatarColor.text,
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 'bold',
            fontSize: '0.875rem',
            transition: 'transform 0.2s'
          }}
          onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
          onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
        >
          {initials}
        </button>

        {isMenuOpen && (
          <div style={{
            position: 'absolute',
            right: 0,
            top: '100%',
            marginTop: '0.5rem',
            backgroundColor: 'white',
            borderRadius: '0.375rem',
            boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
            minWidth: '200px',
            padding: '0.5rem 0'
          }}>
            <div style={{
              padding: '0.5rem 1rem',
              borderBottom: '1px solid #e5e7eb',
              marginBottom: '0.5rem'
            }}>
              <div style={{
                fontSize: '0.875rem',
                color: '#6b7280',
                marginBottom: '0.25rem'
              }}>
                Signed in as
              </div>
              <div style={{
                fontSize: '0.875rem',
                fontWeight: 500,
                color: '#111827'
              }}>
                {getFullName()}
              </div>
            </div>
            <button
              onClick={handleLogout}
              style={{
                width: '100%',
                textAlign: 'left',
                padding: '0.5rem 1rem',
                border: 'none',
                backgroundColor: 'transparent',
                cursor: 'pointer',
                fontSize: '0.875rem',
                color: '#374151',
                transition: 'background-color 0.2s'
              }}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              Sign out
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Header; 