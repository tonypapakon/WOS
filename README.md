# Wireless Ordering System

A comprehensive, production-ready wireless ordering system designed for restaurants, cafés, and hospitality businesses. This system enables waiters to take customer orders on smartphones or tablets, with real-time order processing, kitchen/bar printer integration, and comprehensive management features.

[![Python](https://img.shields.io/badge/Python-3.8+-blue.svg)](https://python.org)
[![React](https://img.shields.io/badge/React-18.2+-61DAFB.svg)](https://reactjs.org)
[![Flask](https://img.shields.io/badge/Flask-Latest-green.svg)](https://flask.palletsprojects.com)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## Key Features

### **Advanced Authentication & Security**
- **Role-based Access Control**: Admin, Manager, and Waiter roles with granular permissions
- **JWT Authentication**: Secure token-based authentication with refresh tokens
- **Account Security**: Failed login attempt tracking, account lockout protection
- **Password Security**: Strong password requirements and secure hashing
- **Audit Logging**: Complete audit trail for all system actions

### **Multi-Location Support**
- **Location Management**: Support for multiple restaurant locations
- **Location-specific Settings**: Customizable configurations per location
- **Cross-location Reporting**: Consolidated reporting across all locations

### **Smart Table Management**
- **Interactive Floor Plans**: Visual table layout with drag-and-drop positioning
- **Dynamic Table Assignment**: Assign tables to specific waiters
- **Table Status Tracking**: Real-time table availability and occupancy
- **QR Code Integration**: Generate QR codes for contactless ordering

### **Digital Menu System**
- **Categorized Menu**: Organized menu with categories and subcategories
- **Dual Pricing**: Separate pricing for dine-in and takeaway orders
- **Item Availability**: Real-time availability management
- **Rich Media**: Support for item images and detailed descriptions
- **Allergen Information**: Comprehensive allergen and nutritional data
- **Barcode Support**: Barcode scanning for quick item lookup

### **Advanced Order Management**
- **Real-time Order Processing**: Instant order submission and status updates
- **Order Types**: Support for dine-in, takeaway, and delivery orders
- **Order Tracking**: Complete order lifecycle management
- **Special Instructions**: Customer notes and special requests
- **Order Modifications**: Edit orders before kitchen preparation
- **Estimated Preparation Times**: Dynamic time estimates based on order complexity

### **Professional Printing System**
- **Network Thermal Printers**: Support for kitchen and bar printers
- **Smart Routing**: Automatic order routing based on item categories
- **Print Templates**: Customizable receipt and order ticket formats
- **Printer Management**: Monitor printer status and connectivity
- **Test Printing**: Built-in printer testing functionality

### **Comprehensive Reporting & Analytics**
- **Sales Reports**: Daily, weekly, and monthly sales analytics
- **Performance Metrics**: Staff performance and productivity tracking
- **Popular Items**: Best-selling items and category analysis
- **Revenue Tracking**: Detailed financial reporting and trends
- **Export Capabilities**: Export reports to CSV and PDF formats

### **Real-time Communication**
- **WebSocket Integration**: Live order updates across all devices
- **Instant Notifications**: Real-time alerts for new orders and status changes
- **Multi-device Sync**: Synchronized data across all connected devices

### **Modern User Experience**
- **Responsive Design**: Optimized for tablets, smartphones, and desktops
- **Touch-friendly Interface**: Intuitive touch controls for mobile devices
- **Performance Optimized**: Fast loading with virtual scrolling and lazy loading
- **Offline Capability**: Service worker for offline functionality
- **Progressive Web App**: Installable PWA with native app-like experience

## Technology Stack

### **Backend Architecture**
- **Framework**: Flask (Python) with modular blueprint architecture
- **Database**: SQLAlchemy ORM with MySQL/SQLite support
- **Authentication**: Flask-JWT-Extended with refresh token support
- **Real-time**: Flask-SocketIO for WebSocket communication
- **Security**: bcrypt password hashing, CORS protection, rate limiting
- **Printing**: python-escpos for thermal printer integration
- **Caching**: Flask-Caching for performance optimization
- **Migration**: Flask-Migrate for database schema management

### **Frontend Architecture**
- **Framework**: React 18 with functional components and hooks
- **Styling**: Tailwind CSS with responsive design
- **State Management**: React Context API with custom hooks
- **HTTP Client**: Axios with interceptors for API communication
- **Real-time**: Socket.IO client for live updates
- **Routing**: React Router v6 with protected routes
- **UI Components**: Headless UI and Lucide React icons
- **Notifications**: React Hot Toast for user feedback
- **Performance**: React.memo, virtual scrolling, code splitting

### **Development & Build Tools**
- **Build Tool**: CRACO for Create React App customization
- **CSS Processing**: PostCSS with Autoprefixer
- **Code Quality**: ESLint and Prettier configuration
- **Testing**: Jest and React Testing Library
- **Performance**: Webpack Bundle Analyzer for optimization

## Getting Started

### Prerequisites
- **Python 3.8+** with pip
- **Node.js 16+** with npm
- **Git** for version control
- **MySQL 8.0+** (optional - SQLite used by default for development)

### Quick Start (Development)

#### Option 1: Enhanced Development Script (Recommended)
```bash
# Clone the repository
git clone <repository-url>
cd wireless_ordering_system

# Make script executable and run
chmod +x dev.sh
./dev.sh
```

**What this script does:**
- ✅ Checks system requirements
- ✅ Creates virtual environment
- ✅ Installs Python dependencies
- ✅ Runs database migrations
- ✅ Installs Node.js dependencies
- ✅ Starts backend on port **5005**
- ✅ Starts frontend on port **3005**
- ✅ Performs health checks
- ✅ Monitors both servers

#### Option 2: Simple Start Script
```bash
# Clone the repository
git clone <repository-url>
cd wireless_ordering_system

# Make script executable and run
chmod +x start.sh
./start.sh
```

#### Option 3: Manual Development Setup

**Step 1: Backend Setup**
```bash
# Create and activate virtual environment
python3 -m venv venv
source venv/bin/activate  # Linux/Mac
# venv\Scripts\activate   # Windows

# Install Python dependencies
pip install -r requirements.txt

# Start Flask backend (Terminal 1)
python app.py
```
*Backend runs on: http://localhost:5005*

**Step 2: Frontend Setup**
```bash
# In a new terminal, navigate to client directory
cd client

# Install Node.js dependencies
npm install

# Start React development server (Terminal 2)
npm start
```
*Frontend runs on: http://localhost:3005*


### Troubleshooting

**Backend Issues**
```bash
# Reset virtual environment
rm -rf venv
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Reset database
rm -f instance/wireless_ordering.db
python migrations.py
```

**Frontend Issues**
```bash
# Reset node modules
rm -rf node_modules package-lock.json
npm install
```

## Application Access

Once running, access the application at:

- **Frontend**: http://localhost:3005
- **Backend API**: http://localhost:5005
- **API Health Check**: http://localhost:5005/api/health

### Default Login Credentials

| Role | Username | Password | Permissions |
|------|----------|----------|-------------|
| **Admin** | `admin` | `admin123` | Full system access, user management, system configuration |
| **Manager** | `manager` | `manager123` | Order management, menu management, reports, staff oversight |
| **Waiter** | `waiter1` | `waiter123` | Take orders, view assigned tables, update order status |
| **Waiter** | `waiter2` | `waiter123` | Take orders, view assigned tables, update order status |

> ⚠️ **Security Note**: Change default passwords immediately in production environments.

## API Documentation

### Authentication Endpoints
```
POST   /api/auth/login          # User authentication
GET    /api/auth/profile        # Get current user profile
POST   /api/auth/refresh        # Refresh access token
POST   /api/auth/logout         # Logout and revoke tokens
POST   /api/auth/register       # Create new user (Admin only)
```

### Menu Management
```
GET    /api/menu/categories     # Get all menu categories
POST   /api/menu/categories     # Create new category
PUT    /api/menu/categories/:id # Update category
DELETE /api/menu/categories/:id # Delete category

GET    /api/menu/items          # Get menu items (with filtering)
POST   /api/menu/items          # Create new menu item
PUT    /api/menu/items/:id      # Update menu item
DELETE /api/menu/items/:id      # Delete menu item
```

### Order Management
```
GET    /api/orders              # Get orders (with filtering)
POST   /api/orders              # Create new order
GET    /api/orders/:id          # Get specific order details
PUT    /api/orders/:id          # Update order
PUT    /api/orders/:id/status   # Update order status
DELETE /api/orders/:id          # Cancel order
```

### Table Management
```
GET    /api/tables              # Get all tables
POST   /api/tables              # Create new table
PUT    /api/tables/:id          # Update table
DELETE /api/tables/:id          # Delete table
POST   /api/tables/assignments  # Assign table to waiter
```

### Reporting & Analytics
```
GET    /api/reports/daily-sales    # Daily sales report
GET    /api/reports/weekly-sales   # Weekly sales report
GET    /api/reports/monthly-sales  # Monthly sales report
GET    /api/reports/popular-items  # Popular items analysis
GET    /api/reports/staff-performance # Staff performance metrics
```

### Printer Management
```
GET    /api/printers/configs     # Get printer configurations
POST   /api/printers/configs     # Add new printer
PUT    /api/printers/configs/:id # Update printer config
POST   /api/printers/test/:id    # Test printer connection
POST   /api/printers/print-order/:id # Print order
```

### System Administration
```
GET    /api/admin/users          # Get all users
POST   /api/admin/users          # Create new user
PUT    /api/admin/users/:id      # Update user
DELETE /api/admin/users/:id      # Delete user
GET    /api/admin/audit-logs     # Get audit logs
GET    /api/admin/system-config  # Get system configuration
PUT    /api/admin/system-config  # Update system configuration
```

## Configuration

### Environment Variables

Create a `.env` file in the project root:

```env
# Database Configuration
DATABASE_URL=mysql+pymysql://username:password@localhost/wireless_ordering

# Security Configuration
SECRET_KEY=your-super-secret-key-change-in-production
JWT_SECRET_KEY=your-jwt-secret-key-change-in-production

# Application Settings
FLASK_ENV=development
FLASK_DEBUG=True

# Printer Configuration
KITCHEN_PRINTER_IP=192.168.1.100
KITCHEN_PRINTER_PORT=9100
BAR_PRINTER_IP=192.168.1.101
BAR_PRINTER_PORT=9100

# POS Integration (Optional)
POS_API_URL=http://localhost:8080/api
POS_API_KEY=your-pos-api-key

# Email Configuration (Optional)
SMTP_SERVER=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your-email@gmail.com
SMTP_PASSWORD=your-app-password

# File Upload Configuration
MAX_CONTENT_LENGTH=16777216  # 16MB
UPLOAD_FOLDER=uploads
```

### System Configuration

The system supports dynamic configuration through the admin panel:

- **Tax Rates**: Configure tax percentages
- **Service Charges**: Set service charge rates
- **Order Timeouts**: Configure order timeout periods
- **Printer Settings**: Manage printer configurations
- **Business Hours**: Set operating hours
- **Currency Settings**: Configure currency and formatting

## Printer Setup

### Supported Printers
- **Thermal Receipt Printers**: ESC/POS compatible printers
- **Network Printers**: Ethernet-connected thermal printers
- **USB Printers**: Direct USB connection support

### Configuration Steps

1. **Connect printers to network**
   - Ensure printers are on the same network as the server
   - Note down IP addresses

2. **Configure in admin panel**
   - Navigate to Admin → Printer Management
   - Add printer configurations with IP addresses and types
   - Test connections using the built-in test function

3. **Set up print routing**
   - Configure which categories print to which printers
   - Kitchen items → Kitchen printer
   - Bar items → Bar printer

## 👥 User Roles & Permissions

### Admin
- **Full System Access**: Complete control over all features
- **User Management**: Create, edit, and delete user accounts
- **System Configuration**: Modify system settings and configurations
- **Financial Reports**: Access to all financial data and reports
- **Audit Logs**: View complete system audit trail
- **Printer Management**: Configure and manage all printers

### Manager
- **Order Management**: View and manage all orders
- **Menu Management**: Create, edit, and manage menu items
- **Staff Oversight**: View staff performance and assignments
- **Reports**: Access to sales and performance reports
- **Table Management**: Manage table layouts and assignments
- **Limited User Management**: Manage waiter accounts only

### Waiter
- **Order Taking**: Create and submit customer orders
- **Table Assignment**: View and manage assigned tables
- **Order Status**: Update order status and add notes
- **Menu Access**: View menu items and availability
- **Personal Reports**: View own order history and performance

## Mobile Optimization

### Progressive Web App (PWA)
- **Installable**: Can be installed on mobile devices like a native app
- **Offline Support**: Service worker enables offline functionality
- **Push Notifications**: Real-time order notifications
- **App-like Experience**: Full-screen mode with native navigation

### Touch-Optimized Interface
- **Large Touch Targets**: Buttons and controls sized for finger navigation
- **Swipe Gestures**: Intuitive swipe actions for common tasks
- **Responsive Design**: Adapts to all screen sizes and orientations
- **Fast Performance**: Optimized for mobile network conditions

## Development

### Project Structure
```
wireless_ordering_system/
├── app.py                 # Main Flask application
├── models.py             # Database models
├── requirements.txt      # Python dependencies
├── setup.py             # Automated setup script
├── migrations.py        # Database migrations
├── utils.py            # Utility functions
├── routes/             # API route blueprints
│   ├── auth.py         # Authentication routes
│   ├── menu.py         # Menu management routes
│   ├── orders.py       # Order management routes
│   ├── tables.py       # Table management routes
│   ├── reports.py      # Reporting routes
│   ├── printers.py     # Printer management routes
│   └── admin.py        # Admin routes
├── client/             # React frontend
│   ├── public/         # Static assets
│   ├── src/
│   │   ├── components/ # React components
│   │   ├── contexts/   # React contexts
│   │   ├── hooks/      # Custom hooks
│   │   ├── utils/      # Utility functions
│   │   └── config/     # Configuration files
│   ├── package.json    # Node.js dependencies
│   └── tailwind.config.js # Tailwind CSS configuration
└── instance/           # Instance-specific files
    └── wireless_ordering.db # SQLite database (development)
```

### Development Commands

```bash
# Backend development
source venv/bin/activate
python app.py

# Frontend development
cd client
npm start

# Run tests
npm test

# Build for production
npm run build

# Analyze bundle size
npm run analyze
```

### Performance Monitoring

The application includes built-in performance monitoring:

- **Real-time Metrics**: Monitor response times and resource usage
- **Bundle Analysis**: Analyze JavaScript bundle size and composition
- **Database Query Optimization**: Indexed queries for fast performance
- **Caching**: Strategic caching for frequently accessed data


## Troubleshooting

### Common Issues

<details>
<summary><strong>Database Connection Issues</strong></summary>

**Problem**: Cannot connect to database
**Solutions**:
- Verify MySQL service is running: `sudo systemctl status mysql`
- Check database credentials in `.env` file
- Ensure database exists: `mysql -u root -p -e "SHOW DATABASES;"`
- For SQLite fallback, check file permissions

</details>

<details>
<summary><strong>Printer Connection Issues</strong></summary>

**Problem**: Orders not printing
**Solutions**:
- Verify printer IP addresses are correct
- Check network connectivity: `ping printer-ip`
- Test printer connection in admin panel
- Ensure printer supports ESC/POS commands
- Check firewall settings on printer port (usually 9100)

</details>

<details>
<summary><strong>Real-time Updates Not Working</strong></summary>

**Problem**: Orders not updating in real-time
**Solutions**:
- Check WebSocket connection in browser developer tools
- Verify Socket.IO client version compatibility
- Check firewall settings for WebSocket connections
- Ensure eventlet is installed: `pip install eventlet`

</details>

<details>
<summary><strong>Frontend Build Issues</strong></summary>

**Problem**: npm build fails
**Solutions**:
- Clear node modules: `rm -rf node_modules package-lock.json && npm install`
- Check Node.js version: `node --version` (requires 16+)
- Increase memory limit: `export NODE_OPTIONS="--max-old-space-size=4096"`
- Check for TypeScript errors in console

</details>

<details>
<summary><strong>Performance Issues</strong></summary>

**Problem**: Slow application performance
**Solutions**:
- Enable database query optimization
- Check database indexes are created
- Monitor memory usage and optimize queries
- Enable caching in production
- Use production build for frontend: `npm run build`

</details>

## Security Considerations

### Production Security Checklist

- [ ] Change all default passwords
- [ ] Use strong, unique SECRET_KEY and JWT_SECRET_KEY
- [ ] Enable HTTPS with SSL certificates
- [ ] Configure firewall rules
- [ ] Set up database user with minimal privileges
- [ ] Enable audit logging
- [ ] Regular security updates
- [ ] Backup strategy implementation
- [ ] Rate limiting configuration
- [ ] Input validation and sanitization

### Data Protection

- **Password Security**: bcrypt hashing with salt
- **JWT Tokens**: Secure token generation with expiration
- **SQL Injection Protection**: SQLAlchemy ORM with parameterized queries
- **XSS Protection**: Input sanitization and output encoding
- **CSRF Protection**: CORS configuration and token validation

## Roadmap

### Upcoming Features

- [ ] **Advanced Analytics**: Machine learning-powered insights
- [ ] **Inventory Management**: Stock tracking and low-stock alerts
- [ ] **Multi-language Support**: Internationalization and localization
- [ ] **Advanced Reporting**: Custom report builder
- [ ] **Integration APIs**: Third-party POS and accounting system integrations
- [ ] **Delivery Integration**: Third-party delivery service integration

### Performance Improvements

- [ ] **Database Optimization**: Query optimization and indexing
- [ ] **Caching Layer**: Redis integration for improved performance
- [ ] **CDN Integration**: Static asset delivery optimization
- [ ] **Load Balancing**: Multi-server deployment support
- [ ] **Microservices**: Service-oriented architecture migration

## Contributing

I welcome contributions! Please follow these steps:

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/amazing-feature`
3. **Make your changes** with proper testing
4. **Commit your changes**: `git commit -m 'Add amazing feature'`
5. **Push to the branch**: `git push origin feature/amazing-feature`
6. **Open a Pull Request**

### Development Guidelines

- Write unit tests for new features
- Update documentation for API changes
- Ensure all tests pass before submitting PR

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

### Getting Help

- **Documentation**: Check this README and inline code comments
- **Issues**: Create a GitHub issue for bugs or feature requests
- **Discussions**: Use GitHub Discussions for questions and ideas

### Professional Support

For commercial support, custom development, or enterprise deployment assistance, please contact the development team.

---

<div align="center">

**Built with ❤️ for the hospitality industry**

[⭐ Star this repo](https://github.com/tonypapakon/WOS) | [🐛 Report Bug](https://github.com/tonypapakon/WOS/issues)

</div>
