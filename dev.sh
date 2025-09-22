#!/bin/bash

# Wireless Ordering System - Enhanced Development Script v2.0
# This script starts both the backend and frontend in development mode with live reload
# Now includes database migrations, health checks, and enhanced monitoring

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[DEV]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_info() {
    echo -e "${CYAN}[INFO]${NC} $1"
}

print_migration() {
    echo -e "${PURPLE}[MIGRATION]${NC} $1"
}

# Function to check if a port is in use
check_port() {
    if lsof -Pi :$1 -sTCP:LISTEN -t >/dev/null ; then
        return 0
    else
        return 1
    fi
}

# Function to kill processes on specific ports
kill_port() {
    if check_port $1; then
        print_warning "Port $1 is in use. Killing existing processes..."
        lsof -ti:$1 | xargs kill -9 2>/dev/null || true
        sleep 2
    fi
}

# Function to check system requirements
check_requirements() {
    print_status "Checking system requirements..."
    
    # Check Python
    if ! command -v python3 &> /dev/null; then
        print_error "Python 3 is not installed"
        exit 1
    fi
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed"
        exit 1
    fi
    
    # Check npm
    if ! command -v npm &> /dev/null; then
        print_error "npm is not installed"
        exit 1
    fi
    
    print_success "System requirements check passed"
}

# Function to run database migrations
run_migrations() {
    print_migration "Running database migrations..."
    
    if python migrations.py; then
        print_success "Database migrations completed successfully"
    else
        print_warning "Database migrations encountered some issues (this may be normal)"
    fi
}

# Function to check backend health
check_backend_health() {
    local max_attempts=10
    local attempt=1
    
    print_status "Waiting for backend to be ready..."
    
    while [ $attempt -le $max_attempts ]; do
        if curl -s http://localhost:5005/api/health > /dev/null 2>&1; then
            print_success "Backend health check passed"
            return 0
        fi
        
        print_status "Attempt $attempt/$max_attempts - Backend not ready yet..."
        sleep 2
        ((attempt++))
    done
    
    print_error "Backend health check failed after $max_attempts attempts"
    return 1
}

# Function to check frontend health
check_frontend_health() {
    local max_attempts=15
    local attempt=1
    
    print_status "Waiting for frontend to be ready..."
    
    while [ $attempt -le $max_attempts ]; do
        if curl -s http://localhost:3005 > /dev/null 2>&1; then
            print_success "Frontend health check passed"
            return 0
        fi
        
        print_status "Attempt $attempt/$max_attempts - Frontend not ready yet..."
        sleep 3
        ((attempt++))
    done
    
    print_error "Frontend health check failed after $max_attempts attempts"
    return 1
}

# Function to display system information
show_system_info() {
    print_info "System Information:"
    print_info "  Python: $(python3 --version)"
    print_info "  Node.js: $(node --version)"
    print_info "  npm: $(npm --version)"
    print_info "  OS: $(uname -s)"
    print_info "  Working Directory: $(pwd)"
}

# Function to create logs directory
setup_logging() {
    if [ ! -d "logs" ]; then
        mkdir -p logs
        print_success "Created logs directory"
    fi
}

# Function to cleanup on exit
cleanup() {
    print_status "Shutting down development servers..."
    kill_port 3005
    kill_port 5005
    
    # Kill any remaining processes
    if [ ! -z "$BACKEND_PID" ]; then
        kill $BACKEND_PID 2>/dev/null || true
    fi
    if [ ! -z "$FRONTEND_PID" ]; then
        kill $FRONTEND_PID 2>/dev/null || true
    fi
    
    print_success "Development servers stopped"
    print_status "Thank you for using Wireless Ordering System!"
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

print_status "🚀 Starting Wireless Ordering System Development Environment v2.0"
print_status "=================================================================="

# Show system information
show_system_info

# Check system requirements
check_requirements

# Check if we're in the right directory
if [ ! -f "app.py" ]; then
    print_error "app.py not found. Please run this script from the project root directory."
    exit 1
fi

# Setup logging
setup_logging

# Kill any existing processes on our ports
kill_port 3005
kill_port 5005

# Set development environment variables
export FLASK_ENV=development
export FLASK_DEBUG=1
export PYTHONPATH="$(pwd)"

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    print_warning "Virtual environment not found. Creating one..."
    python3 -m venv venv
    print_success "Virtual environment created"
fi

# Activate virtual environment
print_status "Activating virtual environment..."
source venv/bin/activate

# Install/update Python dependencies
print_status "Installing/updating Python dependencies..."
pip install -r requirements.txt > logs/pip_install.log 2>&1
if [ $? -eq 0 ]; then
    print_success "Python dependencies installed successfully"
else
    print_error "Failed to install Python dependencies. Check logs/pip_install.log"
    exit 1
fi

# Run database migrations
run_migrations

# Check if client directory exists
if [ ! -d "client" ]; then
    print_error "Client directory not found"
    exit 1
fi

# Install Node.js dependencies
print_status "Installing/updating Node.js dependencies..."
cd client
if [ ! -d "node_modules" ] || [ "package.json" -nt "node_modules" ]; then
    npm install > ../logs/npm_install.log 2>&1
    if [ $? -eq 0 ]; then
        print_success "Node.js dependencies installed successfully"
    else
        print_error "Failed to install Node.js dependencies. Check logs/npm_install.log"
        exit 1
    fi
else
    print_success "Node.js dependencies are up to date"
fi

cd ..

# Start backend server
print_status "Starting Flask backend server on port 5005..."
python app.py > logs/backend.log 2>&1 &
BACKEND_PID=$!

# Check backend health
if check_backend_health; then
    print_success "Backend server is running and healthy"
else
    print_error "Backend server failed to start properly. Check logs/backend.log"
    cleanup
    exit 1
fi

# Start frontend development server
print_status "Starting React frontend server on port 3005..."
cd client
export PORT=3005
export FAST_REFRESH=true
export GENERATE_SOURCEMAP=true
export BROWSER=none  # Don't auto-open browser
npm start > ../logs/frontend.log 2>&1 &
FRONTEND_PID=$!

cd ..

# Check frontend health
if check_frontend_health; then
    print_success "Frontend server is running and healthy"
else
    print_error "Frontend server failed to start properly. Check logs/frontend.log"
    cleanup
    exit 1
fi

# Display final status
print_success "🎉 Development environment is ready!"
print_status "=================================================================="
print_status "🌐 Frontend Application: http://localhost:3005"
print_status "🔧 Backend API: http://localhost:5005"
print_status "📚 API Documentation: http://localhost:5005/api/docs/"
print_status "🏥 Health Check: http://localhost:5005/api/health"
print_status "💾 Database: SQLite (wireless_ordering.db)"
print_status "📊 System Stats: http://localhost:5005/api/v1/system/stats"
print_status "=================================================================="
print_status "🔑 Default Login Credentials:"
print_status "   Admin: admin / admin123"
print_status "   Manager: manager / manager123"
print_status "   Barista: barista1 / barista123"
print_status "=================================================================="
print_status "📝 Log Files:"
print_status "   Backend: logs/backend.log"
print_status "   Frontend: logs/frontend.log"
print_status "   Application: logs/wireless_ordering.log"
print_status "=================================================================="
print_status "🛑 Press Ctrl+C to stop both servers"
print_status ""

# Monitor the servers
while true; do
    # Check if backend is still running
    if ! kill -0 $BACKEND_PID 2>/dev/null; then
        print_error "Backend server has stopped unexpectedly"
        cleanup
        exit 1
    fi
    
    # Check if frontend is still running
    if ! kill -0 $FRONTEND_PID 2>/dev/null; then
        print_error "Frontend server has stopped unexpectedly"
        cleanup
        exit 1
    fi
    
    sleep 5
done