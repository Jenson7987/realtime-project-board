const sgMail = require('@sendgrid/mail');

// Configure SendGrid
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const sendVerificationEmail = async (email, code, username) => {
  const msg = {
    to: email,
    from: process.env.SENDGRID_FROM_EMAIL, // Must be verified in SendGrid
    subject: 'Verify your email address - Project Board',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f8f9fa; padding: 20px;">
        <div style="background-color: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <h2 style="color: #333; margin-bottom: 20px; text-align: center;">Welcome to Project Board!</h2>
          <p style="color: #666; font-size: 16px; line-height: 1.6;">Hi ${username},</p>
          <p style="color: #666; font-size: 16px; line-height: 1.6;">Thank you for registering! Please enter the verification code below to verify your email address:</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <div style="background-color: #3B82F6; color: white; padding: 20px; border-radius: 8px; display: inline-block; font-size: 24px; font-weight: bold; letter-spacing: 4px;">
              ${code}
            </div>
          </div>
          
          <p style="color: #666; font-size: 14px; line-height: 1.6;">Enter this code on the verification page to complete your registration.</p>
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
            <p style="color: #999; font-size: 12px; margin: 0;">This code will expire in 10 minutes.</p>
            <p style="color: #999; font-size: 12px; margin: 5px 0 0 0;">If you didn't create an account, you can safely ignore this email.</p>
          </div>
        </div>
      </div>
    `
  };

  try {
    await sgMail.send(msg);
    console.log('Verification email sent to:', email);
  } catch (error) {
    console.error('Error sending verification email:', error);
    throw new Error('Failed to send verification email');
  }
};

const sendPasswordResetEmail = async (email, token, username) => {
  const resetUrl = `${process.env.CLIENT_URL}/reset-password?token=${token}`;
  
  const msg = {
    to: email,
    from: process.env.SENDGRID_FROM_EMAIL,
    subject: 'Reset your password - Project Board',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f8f9fa; padding: 20px;">
        <div style="background-color: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <h2 style="color: #333; margin-bottom: 20px; text-align: center;">Password Reset Request</h2>
          <p style="color: #666; font-size: 16px; line-height: 1.6;">Hi ${username},</p>
          <p style="color: #666; font-size: 16px; line-height: 1.6;">You requested to reset your password. Click the button below to create a new password:</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" 
               style="background-color: #EF4444; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold; font-size: 16px;">
              Reset Password
            </a>
          </div>
          
          <p style="color: #666; font-size: 14px; line-height: 1.6;">If the button doesn't work, you can copy and paste this link into your browser:</p>
          <p style="word-break: break-all; color: #EF4444; font-size: 14px; background-color: #fef2f2; padding: 10px; border-radius: 4px;">${resetUrl}</p>
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
            <p style="color: #999; font-size: 12px; margin: 0;">This link will expire in 1 hour.</p>
            <p style="color: #999; font-size: 12px; margin: 5px 0 0 0;">If you didn't request a password reset, you can safely ignore this email.</p>
          </div>
        </div>
      </div>
    `
  };

  try {
    await sgMail.send(msg);
    console.log('Password reset email sent to:', email);
  } catch (error) {
    console.error('Error sending password reset email:', error);
    throw new Error('Failed to send password reset email');
  }
};

module.exports = {
  sendVerificationEmail,
  sendPasswordResetEmail
}; 