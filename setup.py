#!/usr/bin/env python3
"""
Setup script for Wireless Ordering System
This script sets up the complete development environment.
"""

import os
import sys
import subprocess
import platform

def run_command(command, cwd=None):
    """Run a command and return success status"""
    try:
        result = subprocess.run(command, shell=True, cwd=cwd, check=True, 
                              capture_output=True, text=True)
        print(f"✓ {command}")
        return True
    except subprocess.CalledProcessError as e:
        print(f"✗ {command}")
        print(f"Error: {e.stderr}")
        return False

def check_prerequisites():
    """Check if required software is installed"""
    print("Checking prerequisites...")
    
    # Check Python
    if sys.version_info < (3, 8):
        print("✗ Python 3.8+ is required")
        return False
    print("✓ Python version OK")
    
    # Check Node.js
    try:
        result = subprocess.run(['node', '--version'], capture_output=True, text=True)
        version = result.stdout.strip()
        print(f"✓ Node.js {version}")
    except FileNotFoundError:
        print("✗ Node.js is not installed")
        return False
    
    # Check MySQL
    try:
        result = subprocess.run(['mysql', '--version'], capture_output=True, text=True)
        print("✓ MySQL is available")
    except FileNotFoundError:
        print("✗ MySQL is not installed")
        return False
    
    return True

def setup_backend():
    """Set up the Python backend"""
    print("\n" + "="*50)
    print("Setting up Python backend...")
    print("="*50)
    
    # Create virtual environment
    if not os.path.exists('venv'):
        print("Creating virtual environment...")
        if not run_command(f"{sys.executable} -m venv venv"):
            return False
    
    # Determine activation script
    if platform.system() == "Windows":
        activate_script = "venv\\Scripts\\activate"
        pip_command = "venv\\Scripts\\pip"
        python_command = "venv\\Scripts\\python"
    else:
        activate_script = "venv/bin/activate"
        pip_command = "venv/bin/pip"
        python_command = "venv/bin/python"
    
    # Install Python dependencies
    print("Installing Python dependencies...")
    if not run_command(f"{pip_command} install --upgrade pip"):
        return False
    
    if not run_command(f"{pip_command} install -r requirements.txt"):
        return False
    
    return True

def setup_frontend():
    """Set up the React frontend"""
    print("\n" + "="*50)
    print("Setting up React frontend...")
    print("="*50)
    
    # Install Node.js dependencies
    print("Installing Node.js dependencies...")
    if not run_command("npm install", cwd="client"):
        return False
    
    return True

def setup_database():
    """Set up the database"""
    print("\n" + "="*50)
    print("Setting up database...")
    print("="*50)
    
    # Get database credentials
    print("Please ensure MySQL is running and you have the credentials ready.")
    
    db_host = input("Database host (default: localhost): ").strip() or "localhost"
    db_user = input("Database username (default: root): ").strip() or "root"
    db_password = input("Database password: ").strip()
    db_name = input("Database name (default: wireless_ordering): ").strip() or "wireless_ordering"
    
    # Create .env file
    env_content = f"""# Database Configuration
DATABASE_URL=mysql+pymysql://{db_user}:{db_password}@{db_host}/{db_name}

# Security Keys
SECRET_KEY=your-super-secret-key-change-this-in-production
JWT_SECRET_KEY=your-jwt-secret-key-change-this-in-production

# Printer Configuration
KITCHEN_PRINTER_IP=192.168.1.100
BAR_PRINTER_IP=192.168.1.101

# POS Integration
POS_API_URL=http://localhost:8080/api
POS_API_KEY=your-pos-api-key

# Application Settings
FLASK_ENV=development
FLASK_DEBUG=True
"""
    
    with open('.env', 'w') as f:
        f.write(env_content)
    print("✓ Created .env file")
    
    # Create database
    print(f"Creating database '{db_name}'...")
    create_db_command = f'mysql -h {db_host} -u {db_user} -p{db_password} -e "CREATE DATABASE IF NOT EXISTS {db_name};"'
    if not run_command(create_db_command):
        print("Warning: Could not create database automatically. Please create it manually.")
    
    # Initialize database
    print("Initializing database with sample data...")
    if platform.system() == "Windows":
        python_command = "venv\\Scripts\\python"
    else:
        python_command = "venv/bin/python"
    
    if not run_command(f"{python_command} init_db.py"):
        return False
    
    return True

def create_startup_scripts():
    """Create convenient startup scripts"""
    print("\n" + "="*50)
    print("Creating startup scripts...")
    print("="*50)
    
    if platform.system() == "Windows":
        # Windows batch files
        backend_script = """@echo off
echo Starting Wireless Ordering System Backend...
call venv\\Scripts\\activate
python app.py
"""
        frontend_script = """@echo off
echo Starting Wireless Ordering System Frontend...
cd client
npm start
"""
        
        with open('start_backend.bat', 'w') as f:
            f.write(backend_script)
        
        with open('start_frontend.bat', 'w') as f:
            f.write(frontend_script)
        
        print("✓ Created start_backend.bat and start_frontend.bat")
    
    else:
        # Unix shell scripts
        backend_script = """#!/bin/bash
echo "Starting Wireless Ordering System Backend..."
source venv/bin/activate
python app.py
"""
        frontend_script = """#!/bin/bash
echo "Starting Wireless Ordering System Frontend..."
cd client
npm start
"""
        
        with open('start_backend.sh', 'w') as f:
            f.write(backend_script)
        
        with open('start_frontend.sh', 'w') as f:
            f.write(frontend_script)
        
        # Make scripts executable
        os.chmod('start_backend.sh', 0o755)
        os.chmod('start_frontend.sh', 0o755)
        
        print("✓ Created start_backend.sh and start_frontend.sh")

def main():
    """Main setup function"""
    print("Wireless Ordering System Setup")
    print("=" * 50)
    
    # Check prerequisites
    if not check_prerequisites():
        print("\nPlease install the missing prerequisites and run setup again.")
        sys.exit(1)
    
    # Setup backend
    if not setup_backend():
        print("\nBackend setup failed!")
        sys.exit(1)
    
    # Setup frontend
    if not setup_frontend():
        print("\nFrontend setup failed!")
        sys.exit(1)
    
    # Setup database
    if not setup_database():
        print("\nDatabase setup failed!")
        sys.exit(1)
    
    # Create startup scripts
    create_startup_scripts()
    
    print("\n" + "="*50)
    print("Setup completed successfully!")
    print("="*50)
    print("\nTo start the application:")
    print("1. Backend: python app.py (or run start_backend script)")
    print("2. Frontend: cd client && npm start (or run start_frontend script)")
    print("\nDefault login credentials:")
    print("Admin: admin / admin123")
    print("Manager: manager / manager123")
    print("Waiter: waiter1 / waiter123")
    print("\nThe application will be available at:")
    print("- Frontend: http://localhost:3005")
    print("- Backend API: http://localhost:5005")

if __name__ == '__main__':
    main()