import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useOrder } from '../contexts/OrderContext';
import { useAuth } from '../contexts/AuthContext';
import { 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  Printer,
  Eye
} from 'lucide-react';
import LoadingSpinner from './LoadingSpinner';

const OrderView = () => {
  const { tableId } = useParams();
  const [searchParams] = useSearchParams();
  const { orders, fetchOrders, updateOrderStatus, printOrder, loading } = useOrder();
  const { user } = useAuth();
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showOrderDetails, setShowOrderDetails] = useState(false);
  const [filters, setFilters] = useState({
    status: searchParams.get('status') || '',
    table_id: tableId || searchParams.get('table_id') || '',
    date_from: '',
    date_to: ''
  });

  
  // Fetch orders whenever filters change (intentionally exclude fetchOrders to avoid loops)
  useEffect(() => {
    const filterParams = {};
    Object.keys(filters).forEach(key => {
      if (filters[key]) {
        filterParams[key] = filters[key];
      }
    });
    fetchOrders(filterParams);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(filters)]);

  const handleStatusUpdate = async (orderId, newStatus) => {
    const result = await updateOrderStatus(orderId, newStatus);
    if (result.success) {
      // Refresh using current filters
      const filterParams = {};
      Object.keys(filters).forEach(key => {
        if (filters[key]) {
          filterParams[key] = filters[key];
        }
      });
      fetchOrders(filterParams);
    }
  };

  const handlePrintOrder = async (orderId, printerType = 'all') => {
    await printOrder(orderId, printerType);
  };

  const getStatusColor = (status) => {
    const colors = {
      pending: 'text-gray-600 bg-gray-100',
      confirmed: 'text-primary-600 bg-primary-100',
      preparing: 'text-warning-600 bg-warning-100',
      ready: 'text-success-600 bg-success-100',
      served: 'text-green-600 bg-green-100',
      cancelled: 'text-danger-600 bg-danger-100'
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

  const getNextStatus = (currentStatus) => {
    const statusFlow = {
      pending: 'confirmed',
      confirmed: 'preparing',
      preparing: 'ready',
      ready: 'served'
    };
    return statusFlow[currentStatus];
  };

  const canUpdateStatus = (order) => {
    if (user?.role === 'admin' || user?.role === 'manager') return true;
    if (user?.role === 'waiter' && order.waiter.id === user.id) return true;
    return false;
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
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Orders</h1>
          <p className="text-gray-600">
            {tableId ? `Orders for Table ${tableId}` : 'All orders'}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="input"
            >
              <option value="">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="confirmed">Confirmed</option>
              <option value="preparing">Preparing</option>
              <option value="ready">Ready</option>
              <option value="served">Served</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Table
            </label>
            <input
              type="text"
              placeholder="Table number"
              value={filters.table_id}
              onChange={(e) => setFilters({ ...filters, table_id: e.target.value })}
              className="input"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              From Date
            </label>
            <input
              type="date"
              value={filters.date_from}
              onChange={(e) => setFilters({ ...filters, date_from: e.target.value })}
              className="input"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              To Date
            </label>
            <input
              type="date"
              value={filters.date_to}
              onChange={(e) => setFilters({ ...filters, date_to: e.target.value })}
              className="input"
            />
          </div>
        </div>
      </div>

      {/* Orders List */}
      <div className="space-y-4">
        {orders.length === 0 ? (
          <div className="text-center py-12">
            <AlertCircle className="h-16 w-16 mx-auto text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No orders found</h3>
            <p className="text-gray-600">No orders match your current filters.</p>
          </div>
        ) : (
          orders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              onStatusUpdate={handleStatusUpdate}
              onPrint={handlePrintOrder}
              onViewDetails={(order) => {
                setSelectedOrder(order);
                setShowOrderDetails(true);
              }}
              canUpdate={canUpdateStatus(order)}
              getStatusColor={getStatusColor}
              getStatusIcon={getStatusIcon}
              getNextStatus={getNextStatus}
            />
          ))
        )}
      </div>

      {/* Order Details Modal */}
      {showOrderDetails && selectedOrder && (
        <OrderDetailsModal
          order={selectedOrder}
          onClose={() => {
            setShowOrderDetails(false);
            setSelectedOrder(null);
          }}
          onStatusUpdate={handleStatusUpdate}
          onPrint={handlePrintOrder}
          canUpdate={canUpdateStatus(selectedOrder)}
          getStatusColor={getStatusColor}
          getStatusIcon={getStatusIcon}
          getNextStatus={getNextStatus}
        />
      )}
    </div>
  );
};

const OrderCard = ({ 
  order, 
  onStatusUpdate, 
  onPrint, 
  onViewDetails, 
  canUpdate,
  getStatusColor,
  getStatusIcon,
  getNextStatus
}) => {
  const nextStatus = getNextStatus(order.status);

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{order.order_number}</h3>
            <p className="text-sm text-gray-600">
              {order.table ? `Table ${order.table.table_number}` : 'Takeaway'} • {order.waiter.name}
            </p>
          </div>
          <div className={`px-3 py-1 rounded-full text-sm font-medium flex items-center space-x-1 ${getStatusColor(order.status)}`}>
            {getStatusIcon(order.status)}
            <span className="capitalize">{order.status}</span>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <span className="text-lg font-bold text-gray-900">
            €{order.total_amount.toFixed(2)}
          </span>
          <div className="flex items-center space-x-1">
            <button
              onClick={() => onViewDetails(order)}
              className="p-2 text-gray-400 hover:text-gray-600"
              title="View Details"
            >
              <Eye className="h-4 w-4" />
            </button>
            <button
              onClick={() => onPrint(order.id)}
              className="p-2 text-gray-400 hover:text-gray-600"
              title="Print Order"
            >
              <Printer className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
          <p className="text-sm text-gray-600">Items: {order.items.length}</p>
          <p className="text-sm text-gray-600">
            Created: {new Date(order.created_at).toLocaleString()}
          </p>
        </div>
        <div>
          <p className="text-sm text-gray-600">
            Updated: {new Date(order.updated_at).toLocaleString()}
          </p>
          {order.notes && (
            <p className="text-sm text-gray-600">Notes: {order.notes}</p>
          )}
        </div>
      </div>

      {/* Order Items Preview */}
      <div className="mb-4">
        <h4 className="text-sm font-medium text-gray-900 mb-2">Items:</h4>
        <div className="space-y-1">
          {order.items.slice(0, 3).map((item, index) => (
            <div key={index} className="flex justify-between text-sm">
              <span>{item.quantity}x {item.menu_item.name}</span>
              <span>€{item.total_price.toFixed(2)}</span>
            </div>
          ))}
          {order.items.length > 3 && (
            <p className="text-sm text-gray-500">
              +{order.items.length - 3} more items
            </p>
          )}
        </div>
      </div>

      {/* Actions */}
      {canUpdate && nextStatus && order.status !== 'served' && order.status !== 'cancelled' && (
        <div className="flex space-x-2">
          <button
            onClick={() => onStatusUpdate(order.id, nextStatus)}
            className="btn btn-primary btn-sm"
          >
            Mark as {nextStatus}
          </button>
          {order.status === 'pending' && (
            <button
              onClick={() => onStatusUpdate(order.id, 'cancelled')}
              className="btn btn-danger btn-sm"
            >
              Cancel
            </button>
          )}
        </div>
      )}
    </div>
  );
};

const OrderDetailsModal = ({ 
  order, 
  onClose, 
  onStatusUpdate, 
  onPrint, 
  canUpdate,
  getStatusColor,
  getStatusIcon,
  getNextStatus
}) => {
  const nextStatus = getNextStatus(order.status);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900">Order Details</h2>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600"
            >
              <AlertCircle className="h-5 w-5" />
            </button>
          </div>

          {/* Order Info */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <h3 className="font-semibold text-gray-900">{order.order_number}</h3>
              <p className="text-gray-600">{order.table ? `Table ${order.table.table_number}` : 'Takeaway'}</p>
              <p className="text-gray-600">Waiter: {order.waiter.name}</p>
            </div>
            <div>
              <div className={`inline-flex items-center space-x-1 px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(order.status)}`}>
                {getStatusIcon(order.status)}
                <span className="capitalize">{order.status}</span>
              </div>
              <p className="text-sm text-gray-600 mt-2">
                Created: {new Date(order.created_at).toLocaleString()}
              </p>
            </div>
          </div>

          {/* Order Items */}
          <div className="mb-6">
            <h4 className="font-semibold text-gray-900 mb-3">Items</h4>
            <div className="space-y-3">
              {order.items.map((item, index) => (
                <div key={index} className="flex justify-between items-start p-3 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <h5 className="font-medium text-gray-900">{item.menu_item.name}</h5>
                    <p className="text-sm text-gray-600">{item.menu_item.category}</p>
                    {item.special_instructions && (
                      <p className="text-sm text-gray-500 italic">
                        Note: {item.special_instructions}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="font-medium">{item.quantity}x €{item.unit_price.toFixed(2)}</p>
                    <p className="text-sm text-gray-600">€{item.total_price.toFixed(2)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Order Total */}
          <div className="border-t pt-4 mb-6">
            <div className="flex justify-between text-lg font-semibold">
              <span>Total:</span>
              <span>€{order.total_amount.toFixed(2)}</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-between">
            <div className="flex space-x-2">
              <button
                onClick={() => onPrint(order.id, 'kitchen')}
                className="btn btn-secondary btn-sm"
              >
                Print Kitchen
              </button>
              <button
                onClick={() => onPrint(order.id, 'bar')}
                className="btn btn-secondary btn-sm"
              >
                Print Bar
              </button>
              <button
                onClick={() => onPrint(order.id, 'receipt')}
                className="btn btn-secondary btn-sm"
              >
                Print Receipt
              </button>
            </div>
            
            {canUpdate && nextStatus && order.status !== 'served' && order.status !== 'cancelled' && (
              <div className="flex space-x-2">
                <button
                  onClick={() => {
                    onStatusUpdate(order.id, nextStatus);
                    onClose();
                  }}
                  className="btn btn-primary btn-sm"
                >
                  Mark as {nextStatus}
                </button>
                {order.status === 'pending' && (
                  <button
                    onClick={() => {
                      onStatusUpdate(order.id, 'cancelled');
                      onClose();
                    }}
                    className="btn btn-danger btn-sm"
                  >
                    Cancel
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderView;