#!/bin/bash

echo "Project Board Deployment Setup"
echo "=============================="

# Check if we're in the right directory
if [ ! -f "server/package.json" ] || [ ! -f "client/package.json" ]; then
    echo "Error: Please run this script from the project root directory"
    exit 1
fi

echo "Project structure looks good"

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "Creating .env.example file..."
    cat > .env.example << EOF
# Database Configuration
MONGODB_URI=mongodb+srv://your-username:your-password@your-cluster.mongodb.net/project-board?retryWrites=true&w=majority

# JWT Configuration
JWT_SECRET=your_super_secret_jwt_key_here_make_it_long_and_random

# Email Configuration (Optional - for email verification)
SENDGRID_API_KEY=your_sendgrid_api_key_here
FROM_EMAIL=your_email@domain.com

# Frontend URL (for CORS)
FRONTEND_URL=https://your-app-name.netlify.app

# Server Configuration
PORT=3001
EOF
    echo "Created .env.example file"
    echo "Please create a .env file with your actual values"
else
    echo ".env file already exists"
fi

# Check server dependencies
echo "Checking server dependencies..."
cd server
if ! npm list cors > /dev/null 2>&1; then
    echo "Installing missing server dependencies..."
    npm install cors
else
    echo "Server dependencies are up to date"
fi
cd ..

# Check client dependencies
echo "Checking client dependencies..."
cd client
if ! npm list > /dev/null 2>&1; then
    echo "Installing client dependencies..."
    npm install
else
    echo "Client dependencies are up to date"
fi
cd ..

echo ""
echo "Setup complete!"
echo ""
echo "Next steps:"
echo "1. Create a .env file with your environment variables"
echo "2. Set up MongoDB Atlas database"
echo "3. Deploy backend to Render"
echo "4. Deploy frontend to Netlify"
echo ""
echo "See DEPLOYMENT.md for detailed instructions" 