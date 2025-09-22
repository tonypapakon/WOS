import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useOrder } from '../contexts/OrderContext';
import { 
  Home, 
  Grid3X3, 
  Menu, 
  ShoppingCart, 
  ShoppingBag,
  BarChart3, 
  Settings, 
  LogOut, 
  User,
  Bell,
  X,
  MenuIcon
} from 'lucide-react';

const Layout = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, logout } = useAuth();
  const { itemCount, orders } = useOrder();
  const location = useLocation();
  const navigate = useNavigate();

  const navigation = [
    { name: 'Dashboard', href: '/', icon: Home, current: location.pathname === '/' },
    { name: 'Tables', href: '/tables', icon: Grid3X3, current: location.pathname === '/tables' },
    { name: 'Takeaway', href: '/takeaway', icon: ShoppingBag, current: location.pathname === '/takeaway' },
    { name: 'Menu', href: '/menu', icon: Menu, current: location.pathname === '/menu' },
    { name: 'Orders', href: '/orders', icon: ShoppingCart, current: location.pathname === '/orders' },
  ];

  // Add admin/manager only routes
  if (user?.role === 'admin' || user?.role === 'manager') {
    navigation.push(
      { name: 'Reports', href: '/reports', icon: BarChart3, current: location.pathname === '/reports' },
      { name: 'Settings', href: '/settings', icon: Settings, current: location.pathname === '/settings' }
    );
  }

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Get pending orders count for notification
  const pendingOrdersCount = orders.filter(order => 
    order.status === 'pending' || order.status === 'confirmed'
  ).length;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile sidebar */}
      <div className={`fixed inset-0 flex z-40 md:hidden ${sidebarOpen ? '' : 'hidden'}`}>
        <div className="fixed inset-0 bg-gray-600 bg-opacity-75" onClick={() => setSidebarOpen(false)} />
        <div className="relative flex-1 flex flex-col max-w-xs w-full bg-white">
          <div className="absolute top-0 right-0 -mr-12 pt-2">
            <button
              type="button"
              className="ml-1 flex items-center justify-center h-10 w-10 rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="h-6 w-6 text-white" />
            </button>
          </div>
          <SidebarContent navigation={navigation} user={user} onLogout={handleLogout} />
        </div>
      </div>

      {/* Desktop sidebar */}
      <div className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0">
        <SidebarContent navigation={navigation} user={user} onLogout={handleLogout} />
      </div>

      {/* Main content */}
      <div className="md:pl-64 flex flex-col flex-1">
        {/* Top bar */}
        <div className="sticky top-0 z-10 md:hidden pl-1 pt-1 sm:pl-3 sm:pt-3 bg-white shadow-sm">
          <button
            type="button"
            className="-ml-0.5 -mt-0.5 h-12 w-12 inline-flex items-center justify-center rounded-md text-gray-500 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary-500"
            onClick={() => setSidebarOpen(true)}
          >
            <MenuIcon className="h-6 w-6" />
          </button>
        </div>

        {/* Header */}
        <header className="bg-white shadow-sm border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-4">
              <div className="flex items-center">
                <h1 className="text-2xl font-semibold text-gray-900">
                  {navigation.find(item => item.current)?.name || 'Dashboard'}
                </h1>
              </div>
              
              <div className="flex items-center space-x-4">
                {/* Order count badge */}
                {itemCount > 0 && (
                  <div className="relative">
                    <ShoppingCart className="h-6 w-6 text-gray-400" />
                    <span className="absolute -top-2 -right-2 bg-primary-600 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                      {itemCount}
                    </span>
                  </div>
                )}

                {/* Notifications */}
                {pendingOrdersCount > 0 && (
                  <div className="relative">
                    <Bell className="h-6 w-6 text-gray-400" />
                    <span className="absolute -top-2 -right-2 bg-danger-600 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                      {pendingOrdersCount}
                    </span>
                  </div>
                )}

                {/* User info */}
                <div className="flex items-center space-x-2">
                  <div className="text-sm">
                    <p className="font-medium text-gray-900">{user?.first_name} {user?.last_name}</p>
                    <p className="text-gray-500 capitalize">{user?.role}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

const SidebarContent = ({ navigation, user, onLogout }) => {
  return (
    <div className="flex-1 flex flex-col min-h-0 bg-white border-r border-gray-200">
      <div className="flex-1 flex flex-col pt-5 pb-4 overflow-y-auto">
        <div className="flex items-center flex-shrink-0 px-4">
          <div className="h-8 w-8 bg-primary-600 rounded-lg flex items-center justify-center">
            <ShoppingCart className="h-5 w-5 text-white" />
          </div>
          <span className="ml-2 text-xl font-semibold text-gray-900">OrderSystem</span>
        </div>
        
        <nav className="mt-8 flex-1 px-2 space-y-1">
          {navigation.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                to={item.href}
                className={`${
                  item.current
                    ? 'bg-primary-100 border-primary-500 text-primary-700'
                    : 'border-transparent text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                } group flex items-center px-2 py-2 text-sm font-medium border-l-4 transition-colors duration-200`}
              >
                <Icon
                  className={`${
                    item.current ? 'text-primary-500' : 'text-gray-400 group-hover:text-gray-500'
                  } mr-3 h-5 w-5`}
                />
                {item.name}
              </Link>
            );
          })}
        </nav>
      </div>
      
      <div className="flex-shrink-0 flex border-t border-gray-200 p-4">
        <div className="flex items-center w-full">
          <div className="flex-shrink-0">
            <div className="h-8 w-8 bg-gray-300 rounded-full flex items-center justify-center">
              <User className="h-5 w-5 text-gray-600" />
            </div>
          </div>
          <div className="ml-3 flex-1">
            <p className="text-sm font-medium text-gray-700">{user?.first_name} {user?.last_name}</p>
            <p className="text-xs text-gray-500 capitalize">{user?.role}</p>
          </div>
          <button
            onClick={onLogout}
            className="ml-3 flex-shrink-0 p-1 text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default Layout;