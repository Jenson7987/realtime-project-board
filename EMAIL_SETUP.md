# Email Verification Setup Guide

## Overview
This project now includes comprehensive email verification using SendGrid. Features include:
- Email verification on registration
- Password reset via email
- Resend verification functionality
- Email verification banner for unverified users

## Setup Instructions

### 1. SendGrid Setup

1. **Create a SendGrid Account**
   - Go to [SendGrid.com](https://sendgrid.com)
   - Sign up for a free account (100 emails/day free)

2. **Get Your API Key**
   - Go to Settings → API Keys
   - Create a new API Key with "Mail Send" permissions
   - Copy the API key

3. **Verify Your Sender Email**
   - Go to Settings → Sender Authentication
   - Verify your domain or at least one sender email
   - This is required for sending emails

### 2. Environment Variables

Create a `.env` file in the `server` directory with:

```env
# Database
MONGODB_URI=mongodb://localhost:27017/project-board

# JWT Secret
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# SendGrid Configuration
SENDGRID_API_KEY=your-sendgrid-api-key-here
SENDGRID_FROM_EMAIL=your-verified-email@domain.com

# Client URL (for email links)
CLIENT_URL=http://localhost:3000

# Server Configuration
PORT=5000
NODE_ENV=development
```

### 3. Install Dependencies

The required dependencies have already been installed:
- `@sendgrid/mail` - SendGrid email service
- `nodemailer` - Email sending library
- `jsonwebtoken` - JWT token handling
- `bcryptjs` - Password hashing

### 4. Database Migration

The User model has been updated with email verification fields:
- `isEmailVerified` - Boolean flag
- `emailVerificationToken` - Token for verification
- `emailVerificationExpires` - Token expiration

### 5. Frontend Components

New components have been added:
- `VerifyEmail.tsx` - Email verification page
- `ForgotPassword.tsx` - Password reset request
- `ResetPassword.tsx` - Password reset with token
- `EmailVerificationBanner.tsx` - Banner for unverified users

### 6. Routes Added

New API endpoints:
- `POST /api/auth/verify-email` - Verify email with token
- `POST /api/auth/resend-verification` - Resend verification email
- `POST /api/auth/forgot-password` - Request password reset
- `POST /api/auth/reset-password` - Reset password with token

New frontend routes:
- `/verify-email` - Email verification page
- `/forgot-password` - Password reset request
- `/reset-password` - Password reset form

## Testing the Implementation

### 1. Registration Flow
1. Register a new user
2. Check your email for verification link
3. Click the verification link
4. User should be marked as verified

### 2. Password Reset Flow
1. Go to login page
2. Click "Forgot your password?"
3. Enter your email
4. Check email for reset link
5. Click link and set new password

### 3. Resend Verification
1. Login with unverified account
2. Look for yellow banner at top
3. Click "Resend verification email"

## Email Templates

The emails include:
- Professional HTML templates
- Responsive design
- Clear call-to-action buttons
- Fallback text links
- Expiration warnings

## Security Features

- Tokens expire after 24 hours (verification) or 1 hour (password reset)
- Tokens are cryptographically secure (32-byte random)
- No information leakage about email existence
- Rate limiting recommended for production

## Production Considerations

1. **Domain Verification**: Verify your domain in SendGrid for better deliverability
2. **Rate Limiting**: Implement rate limiting on email endpoints
3. **Monitoring**: Set up SendGrid webhooks for email delivery tracking
4. **Backup Provider**: Consider having a backup email provider
5. **Environment Variables**: Use secure environment variable management

## Troubleshooting

### Common Issues

1. **"Invalid API Key"**
   - Check your SendGrid API key
   - Ensure it has "Mail Send" permissions

2. **"Sender not verified"**
   - Verify your sender email in SendGrid
   - Use a verified domain for better deliverability

3. **Emails not sending**
   - Check SendGrid dashboard for delivery status
   - Verify your account isn't suspended
   - Check spam folder

4. **Links not working**
   - Ensure `CLIENT_URL` is correct
   - Check that frontend routes are properly configured

### Debug Mode

To debug email issues, check the server console for:
- Email sending attempts
- API responses from SendGrid
- Token generation and verification

## Support

For SendGrid-specific issues, refer to:
- [SendGrid Documentation](https://sendgrid.com/docs/)
- [SendGrid API Reference](https://sendgrid.com/docs/api-reference/)
- [SendGrid Support](https://support.sendgrid.com/) 