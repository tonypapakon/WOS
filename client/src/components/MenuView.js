import React, { useState, useEffect, memo, useCallback } from 'react';
import { 
  Search, 
  Plus, 
  Minus, 
  ShoppingCart, 
  Clock,
  X,
  Check,
  Filter,
  Grid,
  List as ListIcon,
  DollarSign,
  Package,
  User
} from 'lucide-react';
import api from '../config/api';
import toast from 'react-hot-toast';
import LoadingSpinner from './LoadingSpinner';
import VirtualScrollList from './VirtualScrollList';

const MenuView = () => {
  const [categories, setCategories] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [allMenuItems, setAllMenuItems] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [showTableCart, setShowTableCart] = useState(false);
  const [showTakeawayCart, setShowTakeawayCart] = useState(false);
  const [showTableSelection, setShowTableSelection] = useState(false);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'list'
  const [orderType, setOrderType] = useState('all'); // 'all', 'dine_in', 'takeaway'
  const [priceFilter, setPriceFilter] = useState('all'); // 'all', 'low', 'medium', 'high'
  const [availabilityFilter, setAvailabilityFilter] = useState('all'); // 'all', 'available', 'unavailable'
  
  // Separate carts for table and takeaway orders
  const [tableCart, setTableCart] = useState([]);
  const [takeawayCart, setTakeawayCart] = useState([]);
  const [submittingOrder, setSubmittingOrder] = useState(false);
  const [tables, setTables] = useState([]);
  const [tablesLoading, setTablesLoading] = useState(false);
  const [selectedTableForOrder, setSelectedTableForOrder] = useState(null);
  
  // Customer info for takeaway orders
  const [customerInfo, setCustomerInfo] = useState({
    name: '',
    phone: '',
    email: ''
  });

  useEffect(() => {
    fetchCategories();
    fetchAllMenuItems();
  }, []);

  const applyFilters = useCallback(() => {
    let filtered = [...allMenuItems];
    
    // Category filter
    if (selectedCategory) {
      filtered = filtered.filter(item => item.category_id === selectedCategory.id);
    }
    
    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(item => 
        item.name.toLowerCase().includes(term) ||
        item.description.toLowerCase().includes(term) ||
        item.category_name.toLowerCase().includes(term)
      );
    }
    
    // Order type filter
    if (orderType === 'dine_in') {
      filtered = filtered.filter(item => item.dine_in_available && !item.is_takeaway_only);
    } else if (orderType === 'takeaway') {
      filtered = filtered.filter(item => item.takeaway_available || item.is_takeaway_only);
    }
    
    // Price filter
    if (priceFilter !== 'all') {
      filtered = filtered.filter(item => {
        const price = item.dine_in_price || item.takeaway_price || item.price;
        if (priceFilter === 'low') return price < 10;
        if (priceFilter === 'medium') return price >= 10 && price < 20;
        if (priceFilter === 'high') return price >= 20;
        return true;
      });
    }
    
    // Availability filter
    if (availabilityFilter === 'available') {
      filtered = filtered.filter(item => item.is_available);
    } else if (availabilityFilter === 'unavailable') {
      filtered = filtered.filter(item => !item.is_available);
    }
    
    setMenuItems(filtered);
  }, [selectedCategory, searchTerm, orderType, priceFilter, availabilityFilter, allMenuItems]);

  useEffect(() => {
    applyFilters();
  }, [applyFilters]);

  const fetchCategories = async () => {
    try {
      const response = await api.get('/api/menu/categories');
      setCategories(response.data.categories);
    } catch (error) {
      console.error('Failed to fetch categories:', error);
      toast.error('Failed to load menu categories');
    }
  };

  const fetchAllMenuItems = async () => {
    try {
      setLoading(true);
      // Fetch both dine-in and takeaway items
      const [dineInResponse, takeawayResponse] = await Promise.all([
        api.get('/api/menu/items?order_type=dine_in'),
        api.get('/api/menu/items?order_type=takeaway')
      ]);
      
      // Combine and deduplicate items
      const itemMap = new Map();
      
      // Add dine-in items
      dineInResponse.data.menu_items.forEach(item => {
        itemMap.set(item.id, {
          ...item,
          dine_in_available: true,
          dine_in_price: item.price,
          is_available: item.is_available !== false // Default to true if not specified
        });
      });
      
      // Add takeaway items (merge with existing or add new)
      takeawayResponse.data.menu_items.forEach(item => {
        if (itemMap.has(item.id)) {
          const existing = itemMap.get(item.id);
          itemMap.set(item.id, {
            ...existing,
            takeaway_available: true,
            takeaway_price: item.price,
            takeaway_description: item.description !== existing.description ? item.description : existing.description,
            is_available: existing.is_available !== false && item.is_available !== false // Both must be available
          });
        } else {
          itemMap.set(item.id, {
            ...item,
            takeaway_available: true,
            takeaway_price: item.price,
            dine_in_available: false,
            is_available: item.is_available !== false // Default to true if not specified
          });
        }
      });
      
      setAllMenuItems(Array.from(itemMap.values()));
    } catch (error) {
      console.error('Failed to fetch menu items:', error);
      toast.error('Failed to load menu items');
    } finally {
      setLoading(false);
    }
  };

  
  // Cart management functions with useCallback for performance
  const addToTableCart = useCallback((item) => {
    const existingItem = tableCart.find(cartItem => cartItem.id === item.id);
    if (existingItem) {
      setTableCart(prev => prev.map(cartItem =>
        cartItem.id === item.id
          ? { ...cartItem, quantity: cartItem.quantity + 1 }
          : cartItem
      ));
    } else {
      setTableCart(prev => [...prev, { 
        ...item, 
        quantity: 1,
        price: item.dine_in_price || item.price
      }]);
    }
    toast.success(`${item.name} added to table cart`);
  }, [tableCart]);

  const removeFromTableCart = useCallback((itemId) => {
    const existingItem = tableCart.find(cartItem => cartItem.id === itemId);
    if (existingItem && existingItem.quantity > 1) {
      setTableCart(prev => prev.map(cartItem =>
        cartItem.id === itemId
          ? { ...cartItem, quantity: cartItem.quantity - 1 }
          : cartItem
      ));
    } else {
      setTableCart(prev => prev.filter(cartItem => cartItem.id !== itemId));
    }
  }, [tableCart]);

  const addToTakeawayCart = useCallback((item) => {
    const existingItem = takeawayCart.find(cartItem => cartItem.id === item.id);
    if (existingItem) {
      setTakeawayCart(prev => prev.map(cartItem =>
        cartItem.id === item.id
          ? { ...cartItem, quantity: cartItem.quantity + 1 }
          : cartItem
      ));
    } else {
      setTakeawayCart(prev => [...prev, { 
        ...item, 
        quantity: 1,
        price: item.takeaway_price || item.price
      }]);
    }
    toast.success(`${item.name} added to takeaway cart`);
  }, [takeawayCart]);

  const removeFromTakeawayCart = useCallback((itemId) => {
    const existingItem = takeawayCart.find(cartItem => cartItem.id === itemId);
    if (existingItem && existingItem.quantity > 1) {
      setTakeawayCart(prev => prev.map(cartItem =>
        cartItem.id === itemId
          ? { ...cartItem, quantity: cartItem.quantity - 1 }
          : cartItem
      ));
    } else {
      setTakeawayCart(prev => prev.filter(cartItem => cartItem.id !== itemId));
    }
  }, [takeawayCart]);

  const getTableCartTotal = () => {
    return tableCart.reduce((total, item) => total + (item.price * item.quantity), 0);
  };

  const getTakeawayCartTotal = () => {
    return takeawayCart.reduce((total, item) => total + (item.price * item.quantity), 0);
  };

  const getTableCartItemCount = () => {
    return tableCart.reduce((total, item) => total + item.quantity, 0);
  };

  const getTakeawayCartItemCount = () => {
    return takeawayCart.reduce((total, item) => total + item.quantity, 0);
  };

  // Load tables for table selection
  const loadTables = async () => {
    setTablesLoading(true);
    try {
      const response = await api.get('/api/tables/');
      console.log('Tables loaded:', response.data.tables);
      setTables(response.data.tables);
    } catch (error) {
      console.error('Failed to load tables:', error);
      toast.error('Failed to load tables');
    } finally {
      setTablesLoading(false);
    }
  };

  // Submit table order
  const submitTableOrder = async () => {
    if (!selectedTableForOrder) {
      toast.error('Please select a table');
      return;
    }

    setSubmittingOrder(true);
    try {
      const orderData = {
        table_id: selectedTableForOrder.id,
        order_type: 'dine_in',
        items: tableCart.map(item => ({
          menu_item_id: item.id,
          quantity: item.quantity,
          unit_price: item.price,
          special_instructions: ''
        })),
        total_amount: getTableCartTotal()
      };

      const response = await api.post('/api/orders', orderData);
      
      toast.success(`Table order #${response.data.order.order_number} created successfully!`);
      
      // Clear cart and close modals
      setTableCart([]);
      setShowTableSelection(false);
      setShowTableCart(false);
      setSelectedTableForOrder(null);
      
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to create table order');
    } finally {
      setSubmittingOrder(false);
    }
  };

  // Submit takeaway order
  const submitTakeawayOrder = async () => {
    if (takeawayCart.length === 0) {
      toast.error('Cart is empty');
      return;
    }

    // No validation needed for customer info since all fields are optional

    setSubmittingOrder(true);
    try {
      const orderData = {
        location_id: 1, // Default location
        order_type: 'takeaway',
        customer_name: customerInfo.name,
        items: takeawayCart.map(item => ({
          menu_item_id: item.id,
          quantity: item.quantity,
          unit_price: item.price,
          special_instructions: ''
        })),
        total_amount: getTakeawayCartTotal()
      };

      const response = await api.post('/api/orders', orderData);
      
      toast.success(`Takeaway order #${response.data.order.order_number} created successfully!`);
      
      // Clear cart and customer info
      setTakeawayCart([]);
      setCustomerInfo({ name: '', phone: '', email: '' });
      setShowTakeawayCart(false);
      
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to create takeaway order');
    } finally {
      setSubmittingOrder(false);
    }
  };

  const handleTableCartCheckout = () => {
    if (tableCart.length === 0) {
      toast.error('Table cart is empty');
      return;
    }
    console.log('Loading tables for table selection...');
    loadTables();
    setShowTableSelection(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center space-x-3 mb-2">
              <Package className="h-8 w-8" />
              <h1 className="text-3xl font-bold">Complete Menu</h1>
            </div>
            <p className="text-blue-100">Browse all available menu items</p>
          </div>
          <div className="flex items-center space-x-4">
            {/* Cart Buttons */}
            <button
              onClick={() => setShowTableCart(true)}
              className="btn bg-white bg-opacity-20 hover:bg-opacity-30 text-white border-white border-opacity-30 relative"
            >
              <ShoppingCart className="h-4 w-4 mr-2" />
              Table Cart
              {getTableCartItemCount() > 0 && (
                <span className="absolute -top-2 -right-2 bg-red-600 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                  {getTableCartItemCount()}
                </span>
              )}
            </button>
            
            <button
              onClick={() => setShowTakeawayCart(true)}
              className="btn bg-white bg-opacity-20 hover:bg-opacity-30 text-white border-white border-opacity-30 relative"
            >
              <Package className="h-4 w-4 mr-2" />
              Takeaway Cart
              {getTakeawayCartItemCount() > 0 && (
                <span className="absolute -top-2 -right-2 bg-orange-600 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                  {getTakeawayCartItemCount()}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Search, Categories and Filters */}
      <div className="bg-gradient-to-br from-white to-gray-50 rounded-xl p-6 shadow-lg border border-gray-100 backdrop-blur-sm">
        {/* Search and Filters Row */}
        <div className="flex flex-col lg:flex-row gap-4 items-start mb-4">
          {/* Left Side - Search Bar */}
          <div className="relative group w-80">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-gray-400 group-focus-within:text-blue-500 transition-colors duration-200" />
            </div>
            <input
              type="text"
              placeholder="Search menu items..."
              className="w-full pl-10 pr-3 py-2.5 bg-white border border-gray-200 rounded-lg text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 shadow-sm hover:shadow-md text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Middle - Filters */}
          <div className="flex flex-wrap gap-3 items-center flex-1">
            {/* Order Type Filter */}
            <div className="flex items-center space-x-2 bg-white rounded-lg p-3 shadow-sm border border-gray-100">
              <label className="text-sm font-semibold text-gray-700 flex items-center">
                <Package className="h-4 w-4 mr-2 text-blue-500" />
                Type:
              </label>
              <select
                value={orderType}
                onChange={(e) => setOrderType(e.target.value)}
                className="bg-transparent border-none focus:outline-none text-sm font-semibold text-gray-800 cursor-pointer min-w-0"
              >
                <option value="all" className="font-medium text-gray-700">All Items</option>
                <option value="dine_in" className="font-medium text-gray-700">Dine-In Only</option>
                <option value="takeaway" className="font-medium text-gray-700">Takeaway Available</option>
              </select>
            </div>

            {/* Price Filter */}
            <div className="flex items-center space-x-2 bg-white rounded-lg p-3 shadow-sm border border-gray-100">
              <label className="text-sm font-semibold text-gray-700 flex items-center">
                <DollarSign className="h-4 w-4 mr-2 text-green-500" />
                Price:
              </label>
              <select
                value={priceFilter}
                onChange={(e) => setPriceFilter(e.target.value)}
                className="bg-transparent border-none focus:outline-none text-sm font-semibold text-gray-800 cursor-pointer min-w-0"
              >
                <option value="all" className="font-medium text-gray-700">All Prices</option>
                <option value="low" className="font-medium text-gray-700">Under €10</option>
                <option value="medium" className="font-medium text-gray-700">€10 - €20</option>
                <option value="high" className="font-medium text-gray-700">Over €20</option>
              </select>
            </div>

            {/* Availability Filter */}
            <div className="flex items-center space-x-2 bg-white rounded-lg p-3 shadow-sm border border-gray-100">
              <label className="text-sm font-semibold text-gray-700 flex items-center">
                <Filter className="h-4 w-4 mr-2 text-purple-500" />
                Status:
              </label>
              <select
                value={availabilityFilter}
                onChange={(e) => setAvailabilityFilter(e.target.value)}
                className="bg-transparent border-none focus:outline-none text-sm font-semibold text-gray-800 cursor-pointer min-w-0"
              >
                <option value="all" className="font-medium text-gray-700">All Items</option>
                <option value="available" className="font-medium text-gray-700">Available</option>
                <option value="unavailable" className="font-medium text-gray-700">Unavailable</option>
              </select>
            </div>
          </div>

          {/* Right Side - Controls */}
          <div className="flex gap-3 items-center">
            {/* View Mode Toggle */}
            <div className="flex items-center bg-white rounded-lg p-1 shadow-sm border border-gray-100">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-lg transition-all duration-200 ${
                  viewMode === 'grid' 
                    ? 'bg-blue-500 text-white shadow-md' 
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Grid className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded-lg transition-all duration-200 ${
                  viewMode === 'list' 
                    ? 'bg-blue-500 text-white shadow-md' 
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                <ListIcon className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Categories */}
        <div className="flex flex-wrap gap-2 mb-6">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 transform hover:scale-105 ${
              !selectedCategory
                ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/25'
                : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 hover:border-gray-300 shadow-sm'
            }`}
          >
            All Categories
            <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
              !selectedCategory 
                ? 'bg-white/20 text-white' 
                : 'bg-gray-100 text-gray-600'
            }`}>
              {allMenuItems.length}
            </span>
          </button>
          {categories.map((category) => (
            <button
              key={category.id}
              onClick={() => setSelectedCategory(category)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 transform hover:scale-105 ${
                selectedCategory?.id === category.id
                  ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/25'
                  : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 hover:border-gray-300 shadow-sm'
              }`}
            >
              {category.name}
              <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
                selectedCategory?.id === category.id 
                  ? 'bg-white/20 text-white' 
                  : 'bg-gray-100 text-gray-600'
              }`}>
                {category.item_count}
              </span>
            </button>
          ))}
        </div>

        {/* Active Filters Display */}
        {(selectedCategory || searchTerm || orderType !== 'all' || priceFilter !== 'all' || availabilityFilter !== 'all') && (
          <div className="border-t border-gray-200 pt-4">
            <div className="flex items-center mb-3">
              <Filter className="h-4 w-4 text-gray-500 mr-2" />
              <span className="text-sm font-semibold text-gray-700">Active Filters:</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {selectedCategory && (
                <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium bg-gradient-to-r from-blue-100 to-blue-200 text-blue-800 border border-blue-300">
                  <Package className="h-3 w-3 mr-1" />
                  {selectedCategory.name}
                  <button
                    onClick={() => setSelectedCategory(null)}
                    className="ml-2 text-blue-600 hover:text-blue-800 transition-colors"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
              {searchTerm && (
                <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium bg-gradient-to-r from-green-100 to-green-200 text-green-800 border border-green-300">
                  <Search className="h-3 w-3 mr-1" />
                  "{searchTerm}"
                  <button
                    onClick={() => setSearchTerm('')}
                    className="ml-2 text-green-600 hover:text-green-800 transition-colors"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
              {orderType !== 'all' && (
                <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium bg-gradient-to-r from-purple-100 to-purple-200 text-purple-800 border border-purple-300">
                  <Package className="h-3 w-3 mr-1" />
                  {orderType === 'dine_in' ? 'Dine-In' : 'Takeaway'}
                  <button
                    onClick={() => setOrderType('all')}
                    className="ml-2 text-purple-600 hover:text-purple-800 transition-colors"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
              {priceFilter !== 'all' && (
                <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium bg-gradient-to-r from-yellow-100 to-yellow-200 text-yellow-800 border border-yellow-300">
                  <DollarSign className="h-3 w-3 mr-1" />
                  {priceFilter === 'low' ? 'Under €10' : priceFilter === 'medium' ? '€10-€20' : 'Over €20'}
                  <button
                    onClick={() => setPriceFilter('all')}
                    className="ml-2 text-yellow-600 hover:text-yellow-800 transition-colors"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
              {availabilityFilter !== 'all' && (
                <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium bg-gradient-to-r from-gray-100 to-gray-200 text-gray-800 border border-gray-300">
                  <Filter className="h-3 w-3 mr-1" />
                  {availabilityFilter === 'available' ? 'Available' : 'Unavailable'}
                  <button
                    onClick={() => setAvailabilityFilter('all')}
                    className="ml-2 text-gray-600 hover:text-gray-800 transition-colors"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Menu Items */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <LoadingSpinner size="lg" />
        </div>
      ) : (
        <>
          {viewMode === 'grid' ? (
            menuItems.length > 50 ? (
              <VirtualScrollList
                items={menuItems}
                itemHeight={320}
                containerHeight={600}
                className="bg-white rounded-lg shadow-sm border"
                renderItem={(item) => (
                  <div className="p-3">
                    <MenuItemCard
                      item={item}
                      addToTableCart={addToTableCart}
                      addToTakeawayCart={addToTakeawayCart}
                    />
                  </div>
                )}
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {menuItems.map((item) => (
                  <MenuItemCard
                    key={item.id}
                    item={item}
                    addToTableCart={addToTableCart}
                    addToTakeawayCart={addToTakeawayCart}
                  />
                ))}
              </div>
            )
          ) : (
            menuItems.length > 20 ? (
              <VirtualScrollList
                items={menuItems}
                itemHeight={120}
                containerHeight={600}
                className="bg-white rounded-lg shadow-sm border"
                renderItem={(item) => (
                  <MenuItemListRow
                    item={item}
                    addToTableCart={addToTableCart}
                    addToTakeawayCart={addToTakeawayCart}
                  />
                )}
              />
            ) : (
              <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
                <div className="divide-y divide-gray-200">
                  {menuItems.map((item) => (
                    <MenuItemListRow
                      key={item.id}
                      item={item}
                      addToTableCart={addToTableCart}
                      addToTakeawayCart={addToTakeawayCart}
                    />
                  ))}
                </div>
              </div>
            )
          )}

          {/* Empty State */}
          {menuItems.length === 0 && (
            <div className="text-center py-12">
              <Package className="h-16 w-16 mx-auto text-gray-300 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No items found</h3>
              <p className="text-gray-600">Try adjusting your filters to see more items.</p>
            </div>
          )}
        </>
      )}

      {/* Table Cart Modal */}
      {showTableCart && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900">Table Order Cart</h3>
                <button
                  onClick={() => setShowTableCart(false)}
                  className="p-2 text-gray-400 hover:text-gray-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Cart Items */}
              <div className="mb-6">
                {tableCart.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <ShoppingCart className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p>No items in table cart</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-60 overflow-y-auto">
                    {tableCart.map((item) => (
                      <div key={item.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                        <div className="flex-1">
                          <h4 className="font-medium text-gray-900">{item.name}</h4>
                          <p className="text-sm text-gray-600">€{item.price.toFixed(2)} each</p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => removeFromTableCart(item.id)}
                            className="p-1 text-gray-400 hover:text-gray-600"
                          >
                            <Minus className="h-4 w-4" />
                          </button>
                          <span className="w-8 text-center font-medium">{item.quantity}</span>
                          <button
                            onClick={() => addToTableCart(item)}
                            className="p-1 text-gray-400 hover:text-gray-600"
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                        </div>
                        <div className="text-right ml-4">
                          <p className="font-medium">€{(item.price * item.quantity).toFixed(2)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {tableCart.length > 0 && (
                <>
                  <div className="border-t pt-4 mb-6">
                    <div className="flex justify-between items-center font-semibold text-lg">
                      <span>Total:</span>
                      <span>€{getTableCartTotal().toFixed(2)}</span>
                    </div>
                  </div>

                  <div className="flex space-x-3">
                    <button
                      onClick={() => setShowTableCart(false)}
                      className="btn btn-secondary flex-1"
                    >
                      Continue Shopping
                    </button>
                    <button
                      onClick={handleTableCartCheckout}
                      className="btn btn-primary flex-1"
                    >
                      Select Table & Order
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Takeaway Cart Modal */}
      {showTakeawayCart && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900">Takeaway Order Cart</h3>
                <button
                  onClick={() => setShowTakeawayCart(false)}
                  className="p-2 text-gray-400 hover:text-gray-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Cart Items */}
              <div className="mb-6">
                {takeawayCart.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Package className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p>No items in takeaway cart</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-40 overflow-y-auto">
                    {takeawayCart.map((item) => (
                      <div key={item.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                        <div className="flex-1">
                          <h4 className="font-medium text-gray-900">{item.name}</h4>
                          <p className="text-sm text-gray-600">€{item.price.toFixed(2)} each</p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => removeFromTakeawayCart(item.id)}
                            className="p-1 text-gray-400 hover:text-gray-600"
                          >
                            <Minus className="h-4 w-4" />
                          </button>
                          <span className="w-8 text-center font-medium">{item.quantity}</span>
                          <button
                            onClick={() => addToTakeawayCart(item)}
                            className="p-1 text-gray-400 hover:text-gray-600"
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                        </div>
                        <div className="text-right ml-4">
                          <p className="font-medium">€{(item.price * item.quantity).toFixed(2)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {takeawayCart.length > 0 && (
                <>
                  <div className="border-t pt-4 mb-6">
                    <div className="flex justify-between items-center font-semibold text-lg">
                      <span>Total:</span>
                      <span>€{getTakeawayCartTotal().toFixed(2)}</span>
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

                  <div className="flex space-x-3">
                    <button
                      onClick={() => setShowTakeawayCart(false)}
                      className="btn btn-secondary flex-1"
                      disabled={submittingOrder}
                    >
                      Continue Shopping
                    </button>
                    <button
                      onClick={submitTakeawayOrder}
                      className="btn btn-primary flex-1"
                      disabled={submittingOrder}
                    >
                      {submittingOrder ? (
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
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Table Selection Modal */}
      {showTableSelection && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900">Select Table</h3>
                <button
                  onClick={() => setShowTableSelection(false)}
                  className="p-2 text-gray-400 hover:text-gray-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-3 mb-6 max-h-60 overflow-y-auto">
                {tablesLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <LoadingSpinner size="lg" />
                  </div>
                ) : tables.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <p>No tables available</p>
                  </div>
                ) : tables.map((table) => (
                  <button
                    key={table.id}
                    onClick={() => setSelectedTableForOrder(table)}
                    className={`w-full p-3 text-left rounded-lg border transition-colors ${
                      selectedTableForOrder?.id === table.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <h4 className="font-medium">Table {table.table_number}</h4>
                        <p className="text-sm text-gray-600">Capacity: {table.capacity} people</p>
                      </div>
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        table.status === 'available' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {table.status}
                      </span>
                    </div>
                  </button>
                ))}
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={() => setShowTableSelection(false)}
                  className="btn btn-secondary flex-1"
                  disabled={submittingOrder}
                >
                  Cancel
                </button>
                <button
                  onClick={submitTableOrder}
                  className="btn btn-primary flex-1"
                  disabled={submittingOrder || !selectedTableForOrder}
                >
                  {submittingOrder ? (
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

const MenuItemCard = memo(({ item, addToTableCart, addToTakeawayCart }) => {
  const handleTableCartClick = () => {
    addToTableCart(item);
  };
  
  const handleTakeawayCartClick = () => {
    addToTakeawayCart(item);
  };
  
  return (
    <div className="bg-white rounded-lg shadow-sm border p-4 hover:shadow-md transition-shadow">
      {item.image_url && (
        <img
          src={item.image_url}
          alt={item.name}
          className="w-full h-32 object-cover rounded-lg mb-3"
        />
      )}
      
      <div className="flex-1">
        <div className="flex justify-between items-start mb-2">
          <h3 className="font-semibold text-gray-900 flex-1">{item.name}</h3>
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
        
        <p className="text-sm text-gray-600 mb-3 line-clamp-2">{item.description}</p>
        
        {/* Pricing */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex flex-col">
            {item.dine_in_available && item.takeaway_available ? (
              <>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-600">Dine-in:</span>
                  <span className="font-bold text-blue-600">€{item.dine_in_price.toFixed(2)}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-600">Takeaway:</span>
                  <span className="font-bold text-green-600">€{item.takeaway_price.toFixed(2)}</span>
                  {item.takeaway_price < item.dine_in_price && (
                    <span className="text-xs text-green-600 font-medium">
                      Save €{(item.dine_in_price - item.takeaway_price).toFixed(2)}
                    </span>
                  )}
                </div>
              </>
            ) : (
              <span className="font-bold text-primary-600">€{item.price.toFixed(2)}</span>
            )}
          </div>
          
          <div className="text-right">
            {item.preparation_time && (
              <div className="flex items-center text-xs text-gray-500 mb-1">
                <Clock className="h-3 w-3 mr-1" />
                {item.preparation_time}m
              </div>
            )}
            <span className="text-xs text-gray-500 capitalize">
              {item.category_name}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2">
          <div className="flex space-x-2">
            {/* Table Cart Button */}
            {(item.dine_in_available || !item.is_takeaway_only) && (
              <button
                onClick={handleTableCartClick}
                className="btn btn-primary btn-sm flex-1"
                disabled={!item.is_available}
              >
                <ShoppingCart className="h-4 w-4 mr-1" />
                Table Cart
              </button>
            )}
            
            {/* Takeaway Cart Button */}
            {(item.takeaway_available || item.is_takeaway_only) && (
              <button
                onClick={handleTakeawayCartClick}
                className="btn btn-success btn-sm flex-1"
                disabled={!item.is_available}
              >
                <Package className="h-4 w-4 mr-1" />
                Takeaway Cart
              </button>
            )}
          </div>
          
          <div className="flex justify-between items-center text-xs text-gray-500">
            <span className="capitalize">{item.printer_destination}</span>
            <span>{item.preparation_time}m prep</span>
          </div>
        </div>
      </div>
    </div>
  );
});

const MenuItemListRow = memo(({ item, addToTableCart, addToTakeawayCart }) => {
  return (
    <div className="p-4 hover:bg-gray-50 transition-colors">
      <div className="flex items-center space-x-4">
        {/* Image */}
        {item.image_url && (
          <img
            src={item.image_url}
            alt={item.name}
            className="w-16 h-16 object-cover rounded-lg flex-shrink-0"
          />
        )}
        
        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center space-x-2 mb-1">
                <h3 className="font-semibold text-gray-900">{item.name}</h3>
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
              <p className="text-sm text-gray-600 mb-2">{item.description}</p>
              <div className="flex items-center space-x-4 text-xs text-gray-500">
                <span className="capitalize">{item.category_name}</span>
                <span className="capitalize">{item.printer_destination}</span>
                {item.preparation_time && (
                  <div className="flex items-center">
                    <Clock className="h-3 w-3 mr-1" />
                    {item.preparation_time}m
                  </div>
                )}
              </div>
            </div>
            
            {/* Pricing and Actions */}
            <div className="flex items-center space-x-4 ml-4">
              {/* Pricing */}
              <div className="text-right">
                {item.dine_in_available && item.takeaway_available ? (
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs text-gray-600">Dine-in:</span>
                      <span className="font-bold text-blue-600">€{item.dine_in_price.toFixed(2)}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs text-gray-600">Takeaway:</span>
                      <span className="font-bold text-green-600">€{item.takeaway_price.toFixed(2)}</span>
                    </div>
                  </div>
                ) : (
                  <span className="font-bold text-primary-600">€{item.price.toFixed(2)}</span>
                )}
              </div>
              
              {/* Actions */}
              <div className="flex flex-col space-y-1">
                {/* Table Cart Button */}
                {(item.dine_in_available || !item.is_takeaway_only) && (
                  <button
                    onClick={() => addToTableCart(item)}
                    className="btn btn-primary btn-sm"
                    disabled={!item.is_available}
                  >
                    <ShoppingCart className="h-4 w-4 mr-1" />
                    Table
                  </button>
                )}
                
                {/* Takeaway Cart Button */}
                {(item.takeaway_available || item.is_takeaway_only) && (
                  <button
                    onClick={() => addToTakeawayCart(item)}
                    className="btn btn-success btn-sm"
                    disabled={!item.is_available}
                  >
                    <Package className="h-4 w-4 mr-1" />
                    Takeaway
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

export default MenuView;