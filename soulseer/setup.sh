#!/bin/bash

# SoulSeer Setup Script
# This script helps you set up the entire SoulSeer application

echo "🌟 Welcome to SoulSeer Setup 🌟"
echo "================================"
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check prerequisites
echo -e "${BLUE}Checking prerequisites...${NC}"

# Check Node.js
if ! command -v node &> /dev/null; then
    echo -e "${YELLOW}Node.js is not installed. Please install Node.js 20.x or higher.${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Node.js $(node -v) found${NC}"

# Check Python
if ! command -v python3 &> /dev/null; then
    echo -e "${YELLOW}Python 3 is not installed. Please install Python 3.11 or higher.${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Python $(python3 --version) found${NC}"

# Check npm
if ! command -v npm &> /dev/null; then
    echo -e "${YELLOW}npm is not installed. Please install npm.${NC}"
    exit 1
fi
echo -e "${GREEN}✓ npm $(npm -v) found${NC}"

echo ""
echo -e "${BLUE}Setting up Backend...${NC}"
cd backend

# Install backend dependencies
echo "Installing Node.js dependencies..."
npm install

# Create .env if it doesn't exist
if [ ! -f .env ]; then
    echo "Creating .env file from template..."
    cp .env.example .env
    echo -e "${YELLOW}⚠ Please edit backend/.env with your credentials${NC}"
fi

echo -e "${GREEN}✓ Backend setup complete${NC}"
cd ..

echo ""
echo -e "${BLUE}Setting up Frontend...${NC}"
cd frontend

# Install frontend dependencies
echo "Installing Next.js dependencies..."
npm install

# Create .env.local if it doesn't exist
if [ ! -f .env.local ]; then
    echo "Creating .env.local file from template..."
    cp .env.local.example .env.local
    echo -e "${YELLOW}⚠ Please edit frontend/.env.local with your credentials${NC}"
fi

echo -e "${GREEN}✓ Frontend setup complete${NC}"
cd ..

echo ""
echo -e "${BLUE}Setting up Admin Panel...${NC}"
cd admin-panel

# Create virtual environment
if [ ! -d "venv" ]; then
    echo "Creating Python virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment and install dependencies
echo "Installing Python dependencies..."
source venv/bin/activate
pip install -r requirements.txt

# Create .env if it doesn't exist
if [ ! -f .env ]; then
    echo "Creating .env file from template..."
    cp .env.example .env
    echo -e "${YELLOW}⚠ Please edit admin-panel/.env with your credentials${NC}"
fi

echo -e "${GREEN}✓ Admin panel setup complete${NC}"
cd ..

echo ""
echo "================================"
echo -e "${GREEN}✓ Setup Complete!${NC}"
echo ""
echo "Next steps:"
echo "1. Edit the .env files with your credentials:"
echo "   - backend/.env"
echo "   - frontend/.env.local"
echo "   - admin-panel/.env"
echo ""
echo "2. Set up your database:"
echo "   psql \$DATABASE_URL -f backend/config/schema.sql"
echo ""
echo "3. Start the services:"
echo "   Terminal 1: cd backend && npm run dev"
echo "   Terminal 2: cd frontend && npm run dev"
echo "   Terminal 3: cd admin-panel && source venv/bin/activate && python manage.py runserver"
echo ""
echo "4. Access the application:"
echo "   Frontend: http://localhost:3000"
echo "   Backend API: http://localhost:5000"
echo "   Admin Panel: http://localhost:8000/admin"
echo ""
echo "For detailed instructions, see QUICKSTART.md"
echo ""
echo "🌟 Happy coding! 🌟"