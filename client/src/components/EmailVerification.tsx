import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const EmailVerification: React.FC = () => {
  const navigate = useNavigate();
  const { user, updateUser, clearVerification } = useAuth();
  const [verificationCode, setVerificationCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [isResending, setIsResending] = useState(false);
  const [timeLeft, setTimeLeft] = useState(30); // 30 seconds for resend cooldown

  // Countdown timer
  useEffect(() => {
    if (timeLeft > 0) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [timeLeft]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/verify-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code: verificationCode }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage(data.message);
        // Update user context with verified status and new token
        if (data.user && updateUser) {
          updateUser(data.user);
        }
        if (data.token) {
          localStorage.setItem('token', data.token);
        }
        // Redirect to home page after a short delay
        setTimeout(() => {
          navigate('/');
        }, 2000);
      } else {
        setError(data.error);
        // Clear the input field on error
        setVerificationCode('');
      }
    } catch (error) {
      setError('Failed to verify email. Please try again.');
      setVerificationCode('');
    } finally {
      setIsLoading(false);
    }
  };

  const resendVerification = async () => {
    if (!user) {
      console.log('No user found, cannot resend verification');
      return;
    }

    console.log('Resend verification clicked');
    console.log('User:', user);
    console.log('Token:', localStorage.getItem('token'));

    setIsResending(true);
    setError('');
    setMessage('');
    
    try {
      const response = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ email: user.email }), // Include email as fallback
      });

      console.log('Resend response status:', response.status);
      const data = await response.json();
      console.log('Resend response data:', data);

      if (response.ok) {
        setMessage('Verification email sent successfully!');
        setTimeLeft(30); // Reset resend cooldown timer to 30 seconds
        setVerificationCode(''); // Clear any existing code
      } else {
        setError(data.error || 'Failed to resend verification email');
      }
    } catch (error) {
      console.error('Resend verification error:', error);
      setError('Failed to resend verification email');
    } finally {
      setIsResending(false);
    }
  };

  // Clear error when resend timer expires
  useEffect(() => {
    if (timeLeft === 0 && !isResending) {
      setError(''); // Clear any previous errors when resend becomes available
    }
  }, [timeLeft, isResending]);

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 6); // Only allow digits, max 6
    setVerificationCode(value);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Verify your email
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          We sent a verification code to <span className="font-medium">{user?.email}</span>
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          {/* Spam folder warning */}
          <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-md p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-yellow-800">
                  Check your spam folder!
                </h3>
                <div className="mt-2 text-sm text-yellow-700">
                  <p>
                    Verification emails are very likely to end up in your spam/junk folder. 
                    Please check there first if you don't see the email in your inbox.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <form className="space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-md p-4">
                <div className="text-red-800 text-sm">{error}</div>
              </div>
            )}

            {message && (
              <div className="bg-green-50 border border-green-200 rounded-md p-4">
                <div className="text-green-800 text-sm">{message}</div>
              </div>
            )}

            <div>
              <label htmlFor="verificationCode" className="block text-sm font-medium text-gray-700">
                Verification Code
              </label>
              <div className="mt-1">
                <input
                  id="verificationCode"
                  name="verificationCode"
                  type="text"
                  autoComplete="one-time-code"
                  required
                  value={verificationCode}
                  onChange={handleCodeChange}
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm text-center text-2xl font-mono tracking-widest"
                  placeholder="000000"
                  maxLength={6}
                />
              </div>
              <p className="mt-2 text-sm text-gray-500">
                Enter the 6-digit code from your email
              </p>
            </div>

            {timeLeft > 0 && (
              <div className="text-center">
                <p className="text-sm text-gray-600">
                  Resend available in: <span className="font-mono font-medium">{formatTime(timeLeft)}</span>
                </p>
              </div>
            )}

            <div>
              <button
                type="submit"
                disabled={isLoading || verificationCode.length !== 6}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Verifying...' : 'Verify Email'}
              </button>
            </div>

            <div className="text-center">
              <p className="text-sm text-gray-600">
                Didn't receive the code?{' '}
                <button
                  type="button"
                  onClick={resendVerification}
                  disabled={isResending || timeLeft > 0}
                  className="text-blue-600 hover:text-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isResending ? 'Sending...' : 'Resend code'}
                </button>
              </p>
              {timeLeft > 0 && (
                <p className="text-xs text-gray-500 mt-1">
                  You can resend the code after the timer expires
                </p>
              )}
            </div>

            <div className="text-center">
              <button
                type="button"
                onClick={() => {
                  clearVerification();
                  window.location.href = '/login';
                }}
                className="text-sm text-gray-600 hover:text-gray-500"
              >
                Back to login
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default EmailVerification; 