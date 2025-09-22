import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { 
  ShoppingBag, 
  Plus, 
  Minus, 
  ShoppingCart, 
  User, 
  
  
  Clock,
  DollarSign,
  Package,
  X,
  Check,
  AlertCircle
} from 'lucide-react';
import api from '../config/api';
import toast from 'react-hot-toast';
import LoadingSpinner from './LoadingSpinner';

const TakeawayOrderView = () => {
  const { user } = useAuth();
  const [menuItems, setMenuItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [locations, setLocations] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCheckout, setShowCheckout] = useState(false);
  const [customerInfo, setCustomerInfo] = useState({
    name: '',
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (selectedLocation) {
      loadMenuItems();
    }
  }, [selectedLocation]);

  const loadData = async () => {
    try {
      const [locationsResponse, categoriesResponse] = await Promise.all([
        api.get('/api/locations'),
        api.get('/api/categories')
      ]);
      
      setLocations(locationsResponse.data.locations);
      setCategories(categoriesResponse.data.categories);
      
      // Set user's location as default, or first location
      const userLocation = user?.location_id;
      const defaultLocation = userLocation || locationsResponse.data.locations[0]?.id;
      if (defaultLocation) {
        setSelectedLocation(defaultLocation.toString());
      }
    } catch (error) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const loadMenuItems = async () => {
    try {
      const response = await api.get(`/api/menu/items?location_id=${selectedLocation}&order_type=takeaway`);
      setMenuItems(response.data.menu_items);
    } catch (error) {
      toast.error('Failed to load menu items');
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
    return cart.reduce((total, item) => total + (item.takeaway_price * item.quantity), 0);
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
        location_id: parseInt(selectedLocation),
        order_type: 'takeaway',
        customer_name: customerInfo.name,
        items: cart.map(item => ({
          menu_item_id: item.id,
          quantity: item.quantity,
          unit_price: item.takeaway_price,
          special_instructions: ''
        })),
        total_amount: getTotalAmount()
      };

      const response = await api.post('/api/orders', orderData);
      
      toast.success(`Takeaway order #${response.data.order.order_number} created successfully!`);
      
      // Clear cart and customer info
      setCart([]);
      setCustomerInfo({ name: "" });
      setShowCheckout(false);
      
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to create order');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredItems = selectedCategory 
    ? menuItems.filter(item => item.category_id.toString() === selectedCategory)
    : menuItems;

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
            <p className="text-orange-100">Create takeaway orders for customers</p>
          </div>
          {cart.length > 0 && (
            <div className="bg-white bg-opacity-20 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold">{getTotalItems()}</div>
              <div className="text-sm">Items in Cart</div>
            </div>
          )}
        </div>
      </div>

      {/* Location and Category Filters */}
      <div className="flex flex-wrap gap-4 items-center">
        <div className="flex items-center space-x-2">
          <label className="text-sm font-medium text-gray-700">Location:</label>
          <select
            value={selectedLocation}
            onChange={(e) => setSelectedLocation(e.target.value)}
            className="input w-auto"
          >
            {locations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center space-x-2">
          <label className="text-sm font-medium text-gray-700">Category:</label>
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
              onClick={() => setShowCheckout(true)}
              className="btn btn-primary"
            >
              <ShoppingCart className="h-4 w-4 mr-2" />
              Checkout ({getTotalItems()})
            </button>
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
        {filteredItems.map((item) => (
          <div key={item.id} className="card p-4">
            <div className="flex justify-between items-start mb-3">
              <h3 className="text-lg font-semibold text-gray-900 flex-1">{item.name}</h3>
              {item.is_takeaway_only && (
                <span className="bg-orange-100 text-orange-800 text-xs font-medium px-2 py-1 rounded-full ml-2">
                  Takeaway Only
                </span>
              )}
            </div>
            
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
                <span className="text-xl font-bold text-green-600">€{item.takeaway_price.toFixed(2)}</span>
                {item.takeaway_price < item.dine_in_price && (
                  <span className="text-sm text-gray-500 line-through">€{item.dine_in_price.toFixed(2)}</span>
                )}
              </div>
              
              {item.takeaway_price < item.dine_in_price && (
                <span className="bg-green-100 text-green-800 text-xs font-medium px-2 py-1 rounded-full">
                  Save €{(item.dine_in_price - item.takeaway_price).toFixed(2)}
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
      {filteredItems.length === 0 && (
        <div className="text-center py-12">
          <Package className="h-16 w-16 mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No items available</h3>
          <p className="text-gray-600">No takeaway items found for the selected filters.</p>
        </div>
      )}

      {/* Checkout Modal */}
      {showCheckout && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900">Takeaway Order Checkout</h3>
                <button
                  onClick={() => setShowCheckout(false)}
                  className="p-2 text-gray-400 hover:text-gray-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Order Summary */}
              <div className="mb-6">
                <h4 className="font-medium text-gray-900 mb-3">Order Summary</h4>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {cart.map((item) => (
                    <div key={item.id} className="flex justify-between items-center text-sm">
                      <div className="flex-1">
                        <span className="font-medium">{item.name}</span>
                        <span className="text-gray-500 ml-2">x{item.quantity}</span>
                      </div>
                      <span className="font-medium">€{(item.takeaway_price * item.quantity).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
                <div className="border-t pt-2 mt-2">
                  <div className="flex justify-between items-center font-semibold">
                    <span>Total:</span>
                    <span className="text-lg">€{getTotalAmount().toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Customer Information */}
              <div className="space-y-4 mb-6">
                <h4 className="font-medium text-gray-900">Customer Information</h4>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Customer Name (Optional)
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      value={customerInfo.name}
                      onChange={(e) => setCustomerInfo({ ...customerInfo, name: e.target.value })}
                      className="input pl-10"
                      placeholder="Enter customer name (optional)"
                    />
                  </div>
                </div>
              </div>

              {/* Estimated Time */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-6">
                <div className="flex items-center space-x-2">
                  <Clock className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-medium text-blue-900">
                    Estimated preparation time: {Math.max(...cart.map(item => item.takeaway_preparation_time || item.preparation_time))} minutes
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex space-x-3">
                <button
                  onClick={() => setShowCheckout(false)}
                  className="btn btn-secondary flex-1"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmitOrder}
                  className="btn btn-primary flex-1"
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
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TakeawayOrderView;