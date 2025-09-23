import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useOrder } from '../contexts/OrderContext';
import { Link } from 'react-router-dom';
import { 
  Grid3X3, 
  ShoppingCart, 
  Euro, 
  Users, 
  Clock,
  TrendingUp,
  AlertCircle,
  CheckCircle
} from 'lucide-react';
import api from '../config/api';
import LoadingSpinner from './LoadingSpinner';

const Dashboard = () => {
  const { user } = useAuth();
  const { orders, fetchOrders } = useOrder();
  const [stats, setStats] = useState({
    todayOrders: 0,
    todayRevenue: 0,
    activeOrders: 0,
    availableTables: 0
  });
  const [recentOrders, setRecentOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  
  // Fetch metrics (sales/tables) once on mount
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        setLoading(true);
        const today = new Date().toISOString().split('T')[0];
        const salesResponse = await api.get(`/api/reports/daily-sales?date=${today}`);
        const salesData = salesResponse.data;
        const tablesResponse = await api.get('/api/tables/');
        const tablesData = tablesResponse.data.tables;
        if (!isMounted) return;
        setStats(prev => ({
          ...prev,
          todayOrders: salesData.summary.total_orders,
          todayRevenue: salesData.summary.total_revenue,
          availableTables: tablesData.filter(table => table.status === 'available').length
        }));
      } catch (error) {
        console.error('Failed to load dashboard data:', error);
      } finally {
        if (isMounted) setLoading(false);
      }
    })();
    return () => { isMounted = false; };
  }, []);

  // Derive active orders and recent list from orders changes
  useEffect(() => {
    const activeOrders = orders.filter(order => 
      ['pending', 'confirmed', 'preparing', 'ready'].includes(order.status)
    ).length;
    setStats(prev => ({ ...prev, activeOrders }));
    setRecentOrders(orders.slice(0, 10));
  }, [orders]);

  // Request orders once
  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const getStatusColor = (status) => {
    const colors = {
      pending: 'text-gray-600 bg-gray-100',
      confirmed: 'text-blue-600 bg-blue-100',
      preparing: 'text-yellow-600 bg-yellow-100',
      ready: 'text-green-600 bg-green-100',
      served: 'text-green-600 bg-green-100',
      cancelled: 'text-red-600 bg-red-100'
    };
    return colors[status] || 'text-gray-600 bg-gray-100';
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-4 w-4" />;
      case 'confirmed':
        return <CheckCircle className="h-4 w-4" />;
      case 'preparing':
        return <AlertCircle className="h-4 w-4" />;
      case 'ready':
        return <CheckCircle className="h-4 w-4" />;
      case 'served':
        return <CheckCircle className="h-4 w-4" />;
      case 'cancelled':
        return <AlertCircle className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg p-6 text-white">
        <h1 className="text-2xl font-bold mb-2">
          Welcome back, {user?.first_name}!
        </h1>
        <p className="text-blue-100">
          Here's what's happening in your restaurant today.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Today's Orders"
          value={stats.todayOrders}
          icon={<ShoppingCart className="h-6 w-6" />}
          color="bg-blue-500"
          link="/orders"
        />
        <StatCard
          title="Today's Revenue"
          value={`€${stats.todayRevenue.toFixed(2)}`}
          icon={<Euro className="h-6 w-6" />}
          color="bg-green-500"
          link="/reports"
        />
        <StatCard
          title="Active Orders"
          value={stats.activeOrders}
          icon={<Clock className="h-6 w-6" />}
          color="bg-yellow-500"
          link="/orders"
        />
        <StatCard
          title="Available Tables"
          value={stats.availableTables}
          icon={<Grid3X3 className="h-6 w-6" />}
          color="bg-purple-500"
          link="/tables"
        />
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <QuickActionCard
          title="Take New Order"
          description="Start taking orders for customers"
          icon={<ShoppingCart className="h-8 w-8" />}
          link="/menu"
          color="bg-primary-500"
        />
        <QuickActionCard
          title="View Tables"
          description="Check table status and assignments"
          icon={<Grid3X3 className="h-8 w-8" />}
          link="/tables"
          color="bg-success-500"
        />
        <QuickActionCard
          title="Menu Management"
          description="Update menu items and prices"
          icon={<Users className="h-8 w-8" />}
          link="/settings"
          color="bg-warning-500"
        />
      </div>

      {/* Recent Orders */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Recent Orders</h2>
          <Link to="/orders" className="text-primary-600 hover:text-primary-700 text-sm font-medium">
            View all orders
          </Link>
        </div>
        
        {recentOrders.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <ShoppingCart className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p>No recent orders</p>
          </div>
        ) : (
          <div className="space-y-3">
            {recentOrders.map((order) => (
              <div key={order.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className={`p-2 rounded-full ${getStatusColor(order.status)}`}>
                    {getStatusIcon(order.status)}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{order.order_number}</p>
                    <p className="text-sm text-gray-500">
                      {order.table ? `Table ${order.table.table_number}` : 'Takeaway'} • {order.waiter.name}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-medium text-gray-900">€{order.total_amount.toFixed(2)}</p>
                  <p className="text-sm text-gray-500">
                    {new Date(order.created_at).toLocaleTimeString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Performance Metrics (Admin/Manager only) */}
      {(user?.role === 'admin' || user?.role === 'manager') && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Today's Performance</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Average Order Value</span>
                <span className="font-medium">
                  €{stats.todayOrders > 0 ? (stats.todayRevenue / stats.todayOrders).toFixed(2) : '0.00'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Orders per Hour</span>
                <span className="font-medium">
                  {(stats.todayOrders / Math.max(new Date().getHours(), 1)).toFixed(1)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Table Utilization</span>
                <span className="font-medium">
                  {stats.availableTables > 0 ? 
                    `${((20 - stats.availableTables) / 20 * 100).toFixed(0)}%` : 
                    '0%'
                  }
                </span>
              </div>
            </div>
          </div>

          <div className="card p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Stats</h3>
            <div className="space-y-4">
              <div className="flex items-center space-x-3">
                <TrendingUp className="h-5 w-5 text-success-500" />
                <span className="text-gray-600">Revenue trending up</span>
              </div>
              <div className="flex items-center space-x-3">
                <CheckCircle className="h-5 w-5 text-success-500" />
                <span className="text-gray-600">All systems operational</span>
              </div>
              <div className="flex items-center space-x-3">
                <Users className="h-5 w-5 text-primary-500" />
                <span className="text-gray-600">Staff performance good</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const StatCard = ({ title, value, icon, color, link }) => {
  const content = (
    <div className="card p-6 hover:shadow-md transition-shadow duration-200">
      <div className="flex items-center">
        <div className={`p-3 rounded-lg ${color} text-white`}>
          {icon}
        </div>
        <div className="ml-4">
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
        </div>
      </div>
    </div>
  );

  return link ? <Link to={link}>{content}</Link> : content;
};

const QuickActionCard = ({ title, description, icon, link, color }) => {
  return (
    <Link to={link} className="card p-6 hover:shadow-md transition-all duration-200 hover:scale-105">
      <div className="flex items-center space-x-4">
        <div className={`p-3 rounded-lg ${color} text-white`}>
          {icon}
        </div>
        <div>
          <h3 className="font-semibold text-gray-900">{title}</h3>
          <p className="text-sm text-gray-600">{description}</p>
        </div>
      </div>
    </Link>
  );
};

export default Dashboard;