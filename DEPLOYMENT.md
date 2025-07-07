# Deployment Guide: Render + Netlify

This guide will help you deploy your realtime project board to Render (backend) and Netlify (frontend) for free.

## Prerequisites

1. GitHub Account - Your code should be in a GitHub repository
2. MongoDB Atlas Account - Free database hosting
3. Render Account - Free backend hosting
4. Netlify Account - Free frontend hosting

## Step 1: Set Up MongoDB Atlas (Database)

1. Go to [MongoDB Atlas](https://www.mongodb.com/atlas)
2. Create a free account
3. Create a new cluster (free tier)
4. Create a database user:
   - Go to Database Access → Add New Database User
   - Username: `project-board-user`
   - Password: Generate a secure password
   - Role: `Read and write to any database`
5. Get your connection string:
   - Go to Clusters → Connect → Connect your application
   - Copy the connection string
   - Replace `<password>` with your actual password
   - Replace `<dbname>` with `project-board`

## Step 2: Deploy Backend to Render

1. Go to [Render](https://render.com) and sign up
2. Click "New +" → "Web Service"
3. Connect your GitHub repository
4. Configure the service:
   - Name: `project-board-backend` (or your preferred name)
   - Root Directory: `server`
   - Environment: `Node`
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Plan: Free

5. Add Environment Variables:
   - `MONGODB_URI`: Your MongoDB Atlas connection string
   - `JWT_SECRET`: A long, random string (e.g., `my-super-secret-jwt-key-2024`)
   - `PORT`: `3001`
   - `FRONTEND_URL`: Leave empty for now (we'll update after frontend deployment)

6. Click "Create Web Service"
7. Wait for deployment to complete
8. Note your backend URL (e.g., `https://project-board-backend.onrender.com`)

## Step 3: Deploy Frontend to Netlify

1. Go to [Netlify](https://netlify.com) and sign up
2. Click "New site from Git"
3. Connect your GitHub repository
4. Configure the build:
   - Base directory: `client`
   - Build command: `npm run build`
   - Publish directory: `build`

5. Add Environment Variables:
   - `REACT_APP_API_URL`: Your Render backend URL + `/api` (e.g., `https://project-board-backend.onrender.com/api`)

6. Click "Deploy site"
7. Wait for deployment to complete
8. Note your frontend URL (e.g., `https://project-board-app.netlify.app`)

## Step 4: Update Backend with Frontend URL

1. Go back to Render dashboard
2. Find your backend service
3. Go to Environment → Environment Variables
4. Update `FRONTEND_URL` with your Netlify URL
5. Click "Save Changes"
6. The service will automatically redeploy

## Step 5: Test Your Deployment

1. Visit your Netlify URL
2. Test the following features:
   - User registration
   - User login
   - Creating boards
   - Adding cards
   - Real-time collaboration (open in multiple tabs)

## Environment Variables Reference

**Important**: Never commit real credentials to Git. The examples below use placeholder values. Replace them with your actual values in your deployment platform's environment variables.

### Backend (Render)
```
MONGODB_URI=mongodb+srv://your-username:your-password@your-cluster.mongodb.net/project-board?retryWrites=true&w=majority
JWT_SECRET=your_super_secret_jwt_key_here
PORT=3001
FRONTEND_URL=https://your-app-name.netlify.app

# Email Configuration (Optional - for email verification)
SENDGRID_API_KEY=your_sendgrid_api_key_here
SENDGRID_FROM_EMAIL=your_email@domain.com
```

### Frontend (Netlify)
```
REACT_APP_API_URL=https://your-backend-name.onrender.com/api
```

## Troubleshooting

### Common Issues

1. CORS Errors - Make sure `FRONTEND_URL` is set correctly in Render
2. Database Connection - Verify your MongoDB Atlas connection string
3. Build Failures - Check that all dependencies are in package.json
4. Socket Connection - Ensure the backend URL is correct in the frontend

### Debugging

1. Check Render Logs - Go to your Render service → Logs
2. Check Netlify Logs - Go to your Netlify site → Deploys → Click on a deploy
3. Browser Console - Check for JavaScript errors

## Free Tier Limits

- Render: 750 hours/month (enough for 24/7)
- Netlify: 100GB bandwidth/month
- MongoDB Atlas: 512MB storage

## Security Notes

1. JWT_SECRET: Use a long, random string
2. MongoDB: Use a strong password
3. Environment Variables: Never commit them to Git
4. HTTPS: Both platforms provide free SSL certificates

## Support

If you encounter issues:
1. Check the logs in both Render and Netlify
2. Verify all environment variables are set correctly
3. Test locally first to ensure the code works
4. Check the browser console for frontend errors 