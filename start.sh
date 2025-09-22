#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Starting Wireless Ordering System${NC}"
echo -e "${BLUE}====================================${NC}"

# Start backend
echo -e "${YELLOW}📡 Starting Backend Server...${NC}"
./venv/bin/python app.py &
BACKEND_PID=$!

# Wait a moment for backend to start
sleep 3

# Start frontend
echo -e "${YELLOW}🎨 Starting Frontend Server...${NC}"
cd client
npm start &
FRONTEND_PID=$!

echo -e "\n${GREEN}🎉 Both servers are starting up!${NC}"
echo -e "${BLUE}📊 Access URLs:${NC}"
echo -e "   Frontend: ${GREEN}http://localhost:3005${NC}"
echo -e "   Backend:  ${GREEN}http://localhost:5005${NC}"
echo -e "\n${YELLOW}📝 Default Login Credentials:${NC}"
echo -e "   Admin:   admin/admin123"
echo -e "   Manager: manager/manager123"
echo -e "   Waiter:  waiter1/waiter123"

# Function to cleanup on exit
cleanup() {
    echo -e "\n${YELLOW}🛑 Stopping servers...${NC}"
    kill $BACKEND_PID 2>/dev/null
    kill $FRONTEND_PID 2>/dev/null
    exit 0
}

# Set trap to cleanup on script exit
trap cleanup SIGINT SIGTERM

# Wait for user to stop
wait