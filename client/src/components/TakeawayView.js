import React, { useState, useEffect } from 'react';
import { 
  ShoppingBag, 
  Plus, 
  Minus, 
  ShoppingCart, 
  User, 
  Clock,
  Package,
  X,
  Check,
  List,
  Eye,
  Search,
  Filter,
  RefreshCw,
  Hash
} from 'lucide-react';
import api from '../config/api';
import toast from 'react-hot-toast';
import LoadingSpinner from './LoadingSpinner';

const TakeawayView = () => {
  const [activeTab, setActiveTab] = useState('create'); // 'create' or 'orders'
  const [menuItems, setMenuItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [orders, setOrders] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(true);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [showOrderDetails, setShowOrderDetails] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [orderFilter, setOrderFilter] = useState('all'); // 'all', 'pending', 'ready', 'completed'
  const [searchTerm, setSearchTerm] = useState('');
  const [customerInfo, setCustomerInfo] = useState({
    name: '',
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (activeTab === 'create') {
      loadMenuItems();
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'orders') {
      loadOrders();
    }
  }, [activeTab]);

  const loadData = async () => {
    try {
      console.log('Loading data for takeaway view...');
      
      const categoriesResponse = await api.get('/api/menu/categories');
      console.log('Categories response:', categoriesResponse.data);
      
      setCategories(categoriesResponse.data.categories);
      console.log('Data loaded successfully');
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error(`Failed to load data: ${error.response?.data?.error || error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const loadMenuItems = async () => {
    try {
      const response = await api.get('/api/menu/items?order_type=takeaway');
      setMenuItems(response.data.menu_items);
    } catch (error) {
      console.error('Failed to load menu items:', error);
      toast.error('Failed to load menu items');
    }
  };

  const loadOrders = async () => {
    setOrdersLoading(true);
    try {
      const response = await api.get('/api/orders?order_type=takeaway');
      setOrders(response.data.orders);
    } catch (error) {
      console.error('Failed to load orders:', error);
      toast.error('Failed to load orders');
    } finally {
      setOrdersLoading(false);
    }
  };

  const addToCart = (item) => {
    const existingItem = cart.find(cartItem => cartItem.id === item.id);
    if (existingItem) {
      setCart(cart.map(cartItem =>
        cartItem.id === item.id
          ? { ...cartItem, quantity: cartItem.quantity + 1 }
          : cartItem
      ));
    } else {
      setCart([...cart, { ...item, quantity: 1 }]);
    }
    toast.success(`${item.name} added to cart`);
  };

  const removeFromCart = (itemId) => {
    const existingItem = cart.find(cartItem => cartItem.id === itemId);
    if (existingItem && existingItem.quantity > 1) {
      setCart(cart.map(cartItem =>
        cartItem.id === itemId
          ? { ...cartItem, quantity: cartItem.quantity - 1 }
          : cartItem
      ));
    } else {
      setCart(cart.filter(cartItem => cartItem.id !== itemId));
    }
  };

  const clearCart = () => {
    setCart([]);
    toast.success('Cart cleared');
  };

  const getTotalAmount = () => {
    return cart.reduce((total, item) => total + (item.price * item.quantity), 0);
  };

  const getTotalItems = () => {
    return cart.reduce((total, item) => total + item.quantity, 0);
  };

  const handleSubmitOrder = async () => {
    if (cart.length === 0) {
      toast.error('Cart is empty');
      return;
    }

    // No validation needed for customer info since all fields are optional

    setSubmitting(true);
    try {
      const orderData = {
        order_type: 'takeaway',
        customer_name: customerInfo.name,
        items: cart.map(item => ({
          menu_item_id: item.id,
          quantity: item.quantity,
          unit_price: item.price,
          special_instructions: ''
        })),
        total_amount: getTotalAmount()
      };

      const response = await api.post('/api/orders', orderData);
      
      toast.success(`Takeaway order #${response.data.order.order_number} created successfully!`);
      
      // Clear cart and customer info
      setCart([]);
      setCustomerInfo({ name: "" });
      
      // Refresh orders if on orders tab
      if (activeTab === 'orders') {
        loadOrders();
      }
      
    } catch (error) {
      console.error('Failed to create order:', error);
      toast.error(error.response?.data?.message || 'Failed to create order');
    } finally {
      setSubmitting(false);
    }
  };

  const updateOrderStatus = async (orderId, newStatus) => {
    try {
      await api.put(`/api/orders/${orderId}/status`, { status: newStatus });
      toast.success('Order status updated successfully');
      loadOrders(); // Refresh orders
    } catch (error) {
      console.error('Failed to update order status:', error);
      toast.error('Failed to update order status');
    }
  };

  const viewOrderDetails = (order) => {
    setSelectedOrder(order);
    setShowOrderDetails(true);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'confirmed': return 'bg-blue-100 text-blue-800';
      case 'preparing': return 'bg-orange-100 text-orange-800';
      case 'ready': return 'bg-green-100 text-green-800';
      case 'served': return 'bg-gray-100 text-gray-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const filteredItems = selectedCategory 
    ? menuItems.filter(item => item.category_id.toString() === selectedCategory)
    : menuItems;

  const searchFilteredItems = filteredItems.filter(item => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return item.name.toLowerCase().includes(term) ||
           item.description.toLowerCase().includes(term) ||
           (item.barcode && item.barcode.toLowerCase().includes(term));
  });

  const filteredOrders = orders.filter(order => {
    const matchesFilter = orderFilter === 'all' || order.status === orderFilter;
    const matchesSearch = !searchTerm || 
      order.order_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ;
    return matchesFilter && matchesSearch;
  });

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
      <div className="bg-gradient-to-r from-orange-500 to-red-500 rounded-lg p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center space-x-3 mb-2">
              <ShoppingBag className="h-8 w-8" />
              <h1 className="text-3xl font-bold">Takeaway Orders</h1>
            </div>
            <p className="text-orange-100">Create and manage takeaway orders</p>
          </div>
          {cart.length > 0 && activeTab === 'create' && (
            <div className="bg-white bg-opacity-20 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold">{getTotalItems()}</div>
              <div className="text-sm">Items in Cart</div>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('create')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'create'
                ? 'border-orange-500 text-orange-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <ShoppingCart className="h-4 w-4 inline mr-2" />
            Create Order
          </button>
          <button
            onClick={() => setActiveTab('orders')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'orders'
                ? 'border-orange-500 text-orange-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <List className="h-4 w-4 inline mr-2" />
            Manage Orders
          </button>
        </nav>
      </div>

      {/* Create Order Tab */}
      {activeTab === 'create' && (
        <>
          {/* Filters and Cart Actions */}
          <div className="flex flex-wrap gap-4 items-center">
            <div className="relative flex-1 min-w-64">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name, description, or barcode..."
                className="input pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="flex items-center space-x-2">
              <Filter className="h-4 w-4 text-gray-400" />
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="input w-auto"
              >
                <option value="">All Categories</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>

            {cart.length > 0 && (
              <div className="ml-auto flex items-center space-x-2">
                <button
                  onClick={clearCart}
                  className="btn btn-secondary"
                >
                  Clear Cart
                </button>
              </div>
            )}
          </div>

          {/* Menu Items Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {searchFilteredItems.map((item) => (
              <div key={item.id} className="card p-4">
                {item.image_url && (
                  <img
                    src={item.image_url}
                    alt={item.name}
                    className="w-full h-32 object-cover rounded-lg mb-3"
                  />
                )}
                
                <div className="flex justify-between items-start mb-3">
                  <h3 className="text-lg font-semibold text-gray-900 flex-1">{item.name}</h3>
                  <div className="flex flex-col items-end space-y-1">
                    {item.is_takeaway_only && (
                      <span className="bg-orange-100 text-orange-800 text-xs font-medium px-2 py-1 rounded-full">
                        Takeaway Only
                      </span>
                    )}
                    {!item.is_available && (
                      <span className="bg-red-100 text-red-800 text-xs font-medium px-2 py-1 rounded-full">
                        Unavailable
                      </span>
                    )}
                  </div>
                </div>
                
                {item.barcode && (
                  <div className="flex items-center text-xs text-gray-500 mb-2">
                    <Hash className="h-3 w-3 mr-1" />
                    <span className="font-mono">{item.barcode}</span>
                  </div>
                )}
                
                <p className="text-gray-600 text-sm mb-4">{item.description}</p>
                
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-2 text-gray-500">
                    <Clock className="h-4 w-4" />
                    <span className="text-sm">{item.takeaway_preparation_time || item.preparation_time} min</span>
                  </div>
                  <div className="text-sm text-gray-500 capitalize">
                    {item.category_name}
                  </div>
                </div>
                
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-2">
                    <span className="text-xl font-bold text-green-600">€{item.price.toFixed(2)}</span>
                    {item.takeaway_price && item.takeaway_price < item.original_price && (
                      <span className="text-sm text-gray-500 line-through">€{item.original_price.toFixed(2)}</span>
                    )}
                  </div>
                  
                  {item.takeaway_price && item.takeaway_price < item.original_price && (
                    <span className="bg-green-100 text-green-800 text-xs font-medium px-2 py-1 rounded-full">
                      Save €{(item.original_price - item.takeaway_price).toFixed(2)}
                    </span>
                  )}
                </div>

                {/* Add to Cart Controls */}
                <div className="flex items-center justify-between">
                  {cart.find(cartItem => cartItem.id === item.id) ? (
                    <div className="flex items-center space-x-3">
                      <button
                        onClick={() => removeFromCart(item.id)}
                        className="p-1 rounded-full bg-red-100 text-red-600 hover:bg-red-200"
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <span className="font-medium">
                        {cart.find(cartItem => cartItem.id === item.id)?.quantity}
                      </span>
                      <button
                        onClick={() => addToCart(item)}
                        className="p-1 rounded-full bg-green-100 text-green-600 hover:bg-green-200"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => addToCart(item)}
                      className="btn btn-primary btn-sm"
                      disabled={!item.is_available}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add to Cart
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Empty State */}
          {searchFilteredItems.length === 0 && (
            <div className="text-center py-12">
              <Package className="h-16 w-16 mx-auto text-gray-300 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No items available</h3>
              <p className="text-gray-600">No takeaway items found for the selected filters.</p>
            </div>
          )}

          {/* Cart Summary and Checkout */}
          {cart.length > 0 && (
            <div className="fixed bottom-4 right-4 bg-white rounded-lg shadow-lg border p-6 max-w-md w-full">
              <h4 className="font-medium text-gray-900 mb-4">Order Summary</h4>
              
              {/* Cart Items */}
              <div className="space-y-2 max-h-40 overflow-y-auto mb-4">
                {cart.map((item) => (
                  <div key={item.id} className="flex justify-between items-center text-sm">
                    <div className="flex-1">
                      <span className="font-medium">{item.name}</span>
                      <span className="text-gray-500 ml-2">x{item.quantity}</span>
                    </div>
                    <span className="font-medium">€{(item.price * item.quantity).toFixed(2)}</span>
                  </div>
                ))}
              </div>
              
              <div className="border-t pt-2 mb-4">
                <div className="flex justify-between items-center font-semibold text-lg">
                  <span>Total:</span>
                  <span>€{getTotalAmount().toFixed(2)}</span>
                </div>
              </div>

              {/* Customer Information */}
              <div className="space-y-3 mb-4">
                <h5 className="font-medium text-gray-900">Customer Information</h5>
                
                <div>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      value={customerInfo.name}
                      onChange={(e) => setCustomerInfo({ ...customerInfo, name: e.target.value })}
                      className="input pl-10 text-sm"
                      placeholder="Customer name (optional)"
                    />
                  </div>
                </div>
              </div>

              {/* Estimated Time */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                <div className="flex items-center space-x-2">
                  <Clock className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-medium text-blue-900">
                    Estimated time: {Math.max(...cart.map(item => item.takeaway_preparation_time || item.preparation_time))} minutes
                  </span>
                </div>
              </div>

              {/* Action Button */}
              <button
                onClick={handleSubmitOrder}
                className="btn btn-primary w-full"
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <LoadingSpinner size="sm" className="mr-2" />
                    Creating Order...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Create Order
                  </>
                )}
              </button>
            </div>
          )}
        </>
      )}

      {/* Manage Orders Tab */}
      {activeTab === 'orders' && (
        <>
          {/* Orders Filters */}
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex items-center space-x-2">
              <Search className="h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search orders..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input w-64"
              />
            </div>

            <div className="flex items-center space-x-2">
              <Filter className="h-4 w-4 text-gray-400" />
              <select
                value={orderFilter}
                onChange={(e) => setOrderFilter(e.target.value)}
                className="input w-auto"
              >
                <option value="all">All Orders</option>
                <option value="pending">Pending</option>
                <option value="confirmed">Confirmed</option>
                <option value="preparing">Preparing</option>
                <option value="ready">Ready</option>
                <option value="served">Completed</option>
              </select>
            </div>

            <button
              onClick={loadOrders}
              className="btn btn-secondary"
              disabled={ordersLoading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${ordersLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          {/* Orders List */}
          {ordersLoading ? (
            <div className="flex items-center justify-center h-64">
              <LoadingSpinner size="lg" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredOrders.map((order) => (
                <div key={order.id} className="card p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">#{order.order_number}</h3>
                      <p className="text-sm text-gray-600">{order.customer_name}</p>
                    </div>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(order.status)}`}>
                      {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                    </span>
                  </div>

                  <div className="space-y-2 mb-4">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Total:</span>
                      <span className="font-medium">€{order.total_amount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Items:</span>
                      <span>{order.items.length}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Created:</span>
                      <span>{new Date(order.created_at).toLocaleTimeString()}</span>
                    </div>
                  </div>

                  <div className="flex space-x-2">
                    <button
                      onClick={() => viewOrderDetails(order)}
                      className="btn btn-secondary btn-sm flex-1"
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      View
                    </button>
                    
                    {order.status === 'pending' && (
                      <button
                        onClick={() => updateOrderStatus(order.id, 'confirmed')}
                        className="btn btn-primary btn-sm flex-1"
                      >
                        Confirm
                      </button>
                    )}
                    
                    {order.status === 'confirmed' && (
                      <button
                        onClick={() => updateOrderStatus(order.id, 'preparing')}
                        className="btn btn-primary btn-sm flex-1"
                      >
                        Prepare
                      </button>
                    )}
                    
                    {order.status === 'preparing' && (
                      <button
                        onClick={() => updateOrderStatus(order.id, 'ready')}
                        className="btn btn-success btn-sm flex-1"
                      >
                        Ready
                      </button>
                    )}
                    
                    {order.status === 'ready' && (
                      <button
                        onClick={() => updateOrderStatus(order.id, 'served')}
                        className="btn btn-success btn-sm flex-1"
                      >
                        Complete
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Empty Orders State */}
          {!ordersLoading && filteredOrders.length === 0 && (
            <div className="text-center py-12">
              <List className="h-16 w-16 mx-auto text-gray-300 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No orders found</h3>
              <p className="text-gray-600">No takeaway orders match your current filters.</p>
            </div>
          )}
        </>
      )}

      {/* Order Details Modal */}
      {showOrderDetails && selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900">
                  Order #{selectedOrder.order_number}
                </h3>
                <button
                  onClick={() => setShowOrderDetails(false)}
                  className="p-2 text-gray-400 hover:text-gray-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Order Info */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Customer Information</h4>
                  <p className="text-sm text-gray-600">Name: {selectedOrder.customer_name}</p>
                </div>
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Order Details</h4>
                  <p className="text-sm text-gray-600">Status: 
                    <span className={`ml-2 px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(selectedOrder.status)}`}>
                      {selectedOrder.status.charAt(0).toUpperCase() + selectedOrder.status.slice(1)}
                    </span>
                  </p>
                  <p className="text-sm text-gray-600">Created: {new Date(selectedOrder.created_at).toLocaleString()}</p>
                  <p className="text-sm text-gray-600">Waiter: {selectedOrder.waiter.name}</p>
                </div>
              </div>

              {/* Order Items */}
              <div className="mb-6">
                <h4 className="font-medium text-gray-900 mb-3">Order Items</h4>
                <div className="space-y-2">
                  {selectedOrder.items.map((item) => (
                    <div key={item.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                      <div className="flex-1">
                        <span className="font-medium">{item.menu_item.name}</span>
                        <span className="text-gray-500 ml-2">x{item.quantity}</span>
                        {item.special_instructions && (
                          <p className="text-sm text-gray-600 mt-1">Note: {item.special_instructions}</p>
                        )}
                      </div>
                      <span className="font-medium">€{item.total_price.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
                <div className="border-t pt-3 mt-3">
                  <div className="flex justify-between items-center font-semibold text-lg">
                    <span>Total:</span>
                    <span>€{selectedOrder.total_amount.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex space-x-3">
                <button
                  onClick={() => setShowOrderDetails(false)}
                  className="btn btn-secondary flex-1"
                >
                  Close
                </button>
                
                {selectedOrder.status === 'pending' && (
                  <button
                    onClick={() => {
                      updateOrderStatus(selectedOrder.id, 'confirmed');
                      setShowOrderDetails(false);
                    }}
                    className="btn btn-primary flex-1"
                  >
                    Confirm Order
                  </button>
                )}
                
                {selectedOrder.status === 'confirmed' && (
                  <button
                    onClick={() => {
                      updateOrderStatus(selectedOrder.id, 'preparing');
                      setShowOrderDetails(false);
                    }}
                    className="btn btn-primary flex-1"
                  >
                    Start Preparing
                  </button>
                )}
                
                {selectedOrder.status === 'preparing' && (
                  <button
                    onClick={() => {
                      updateOrderStatus(selectedOrder.id, 'ready');
                      setShowOrderDetails(false);
                    }}
                    className="btn btn-success flex-1"
                  >
                    Mark Ready
                  </button>
                )}
                
                {selectedOrder.status === 'ready' && (
                  <button
                    onClick={() => {
                      updateOrderStatus(selectedOrder.id, 'served');
                      setShowOrderDetails(false);
                    }}
                    className="btn btn-success flex-1"
                  >
                    Complete Order
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TakeawayView;