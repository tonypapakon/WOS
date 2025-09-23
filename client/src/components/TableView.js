import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { 
  Users, 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  Plus, 
  Edit, 
  Save, 
  X,
  Settings,
  ShoppingCart,
  Minus,
  ArrowLeft,
  Check,
  Search,
  Filter
} from 'lucide-react';
import api from '../config/api';
import toast from 'react-hot-toast';
import LoadingSpinner from './LoadingSpinner';

// Reservation Modal
const ReservationModal = ({ open, onClose, onSubmit, table }) => {
  const [form, setForm] = React.useState({
    name: '',
    date: '',
    people: table?.capacity || 2
  });

  // Reset form when table changes or modal opens
  React.useEffect(() => {
    if (open && table) {
      setForm({
        name: '',
        date: '',
        people: table.capacity || 2
      });
    }
  }, [open, table]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.date || !form.people) return;
    onSubmit(form);
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg max-w-sm w-full p-6">
        <h3 className="text-lg font-semibold mb-4 text-gray-900">Reserve Table {table?.table_number}</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              type="text"
              name="name"
              value={form.name}
              onChange={handleChange}
              className="input w-full"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date & Time</label>
            <input
              type="datetime-local"
              name="date"
              value={form.date}
              onChange={handleChange}
              className="input w-full"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Number of People</label>
            <input
              type="number"
              name="people"
              min="1"
              max={table?.capacity || 20}
              value={form.people}
              onChange={handleChange}
              className="input w-full"
              required
            />
          </div>
          <div className="flex justify-end space-x-2 pt-2">
            <button type="button" onClick={onClose} className="btn btn-secondary">Cancel</button>
            <button type="submit" className="btn btn-primary">Reserve</button>
          </div>
        </form>
      </div>
    </div>
  );
};

const VALID_TABLE_STATUSES = ['available', 'occupied', 'reserved', 'cleaning'];

const TableView = () => {
  // Reservation modal state
  const [showReservationModal, setShowReservationModal] = useState(false);
  const [reservationTable, setReservationTable] = useState(null);



  // Handle reservation form submission
  const handleReservationSubmit = async (reservationData) => {
    try {
      // Create reservation data
      const reservationPayload = {
        table_id: reservationTable.id,
        customer_name: reservationData.name,
        reservation_date: reservationData.date,
        party_size: parseInt(reservationData.people),
        status: 'confirmed'
      };

      // Make API call to create reservation
      await api.post('/api/reservations', reservationPayload);
      
      // Update table status to reserved
      await api.put(`/api/tables/${reservationTable.id}/status`, { status: 'reserved' });
      
      toast.success(`Table ${reservationTable.table_number} reserved for ${reservationData.name} on ${new Date(reservationData.date).toLocaleString()}`);
      
      // Refresh tables to show updated status
      fetchTables();
    } catch (error) {
      console.error('Failed to create reservation:', error);
      toast.error(error.response?.data?.message || 'Failed to create reservation');
    } finally {
      setShowReservationModal(false);
      setReservationTable(null);
    }
  };

  // Handle reservation request from right-click menu
  const handleReserveTable = (table) => {
    setReservationTable(table);
    setShowReservationModal(true);
  };

  // Utility and handler functions
  const getTotalItems = () => {
    return cart.reduce((total, item) => total + item.quantity, 0);
  };

  const getTotalAmount = () => {
    return cart.reduce((total, item) => total + (item.price * item.quantity), 0);
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

  const submitOrder = async () => {
    if (cart.length === 0) {
      toast.error('Cart is empty');
      return;
    }

    setSubmittingOrder(true);
    try {
      const orderData = {
        table_id: selectedTable.id,
        order_type: 'dine_in',
        items: cart.map(item => ({
          menu_item_id: item.id,
          quantity: item.quantity,
          unit_price: item.price,
          special_instructions: ''
        })),
        total_amount: getTotalAmount()
      };

      const response = await api.post('/api/orders', orderData);
      toast.success(`Table order #${response.data.order.order_number} created successfully!`);
      setCart([]);
      setShowMenu(false);
      setSelectedTable(null);
      fetchTables();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to create order');
    } finally {
      setSubmittingOrder(false);
    }
  };

  const handleTableClick = (table) => {
    if (isManagementMode && isAdmin) {
      setEditingTable(table);
      return;
    }

    if (table.has_active_orders) {
      navigate(`/orders?table_id=${table.id}`);
    } else if (table.status === 'reserved') {
      // Navigate to orders for reserved tables
      navigate(`/orders?table_id=${table.id}`);
    } else {
      setSelectedTable(table);
      setShowMenu(true);
      setCart([]);
    }
  };
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isManagementMode, setIsManagementMode] = useState(false);
  const [showAddTableModal, setShowAddTableModal] = useState(false);
  const [editingTable, setEditingTable] = useState(null);
  
  // Menu ordering state
  const [selectedTable, setSelectedTable] = useState(null);
  const [showMenu, setShowMenu] = useState(false);
  const [menuItems, setMenuItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [cart, setCart] = useState([]);
  const [submittingOrder, setSubmittingOrder] = useState(false);
  
    const { user } = useAuth();
  const navigate = useNavigate();

  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    fetchTables();
    fetchCategories();
  }, []);

  useEffect(() => {
    if (showMenu) {
      fetchMenuItems();
    }
  }, [showMenu]);

  const fetchTables = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/tables/');
      setTables(response.data.tables);
    } catch (error) {
      console.error('Failed to fetch tables:', error);
      toast.error('Failed to load tables');
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await api.get('/api/menu/categories');
      setCategories(response.data.categories);
    } catch (error) {
      console.error('Failed to fetch categories:', error);
      toast.error('Failed to load categories');
    }
  };

  const fetchMenuItems = async () => {
    try {
      const response = await api.get('/api/menu/items?order_type=dine_in');
      setMenuItems(response.data.menu_items);
    } catch (error) {
      console.error('Failed to fetch menu items:', error);
      toast.error('Failed to load menu items');
    }
  };



  const filteredMenuItems = menuItems.filter(item => {
    const matchesCategory = !selectedCategory || item.category_id?.toString() === selectedCategory;
    const matchesSearch = !searchTerm || 
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.barcode && item.barcode.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  const updateTableStatus = async (tableId, newStatus) => {
    if (!VALID_TABLE_STATUSES.includes(newStatus)) {
      toast.error(`Invalid status: ${newStatus}`);
      return;
    }
    try {
      await api.put(`/api/tables/${tableId}/status`, { status: newStatus });
      toast.success('Table status updated');
      fetchTables();
    } catch (error) {
      console.error('Failed to update table status:', error);
      toast.error('Failed to update table status');
    }
  };

  const createTable = async (tableData) => {
    try {
      await api.post('/api/tables/', tableData);
      toast.success('Table created successfully');
      setShowAddTableModal(false);
      fetchTables();
    } catch (error) {
      console.error('Failed to create table:', error);
      toast.error(error.response?.data?.error || 'Failed to create table');
    }
  };

  const updateTable = async (tableId, tableData) => {
    try {
      await api.put(`/api/tables/${tableId}`, tableData);
      toast.success('Table updated successfully');
      setEditingTable(null);
      fetchTables();
    } catch (error) {
      console.error('Failed to update table:', error);
      toast.error(error.response?.data?.error || 'Failed to update table');
    }
  };

  const deleteTable = async (tableId) => {
    if (!window.confirm('Are you sure you want to delete this table? This action cannot be undone.')) {
      return;
    }

    try {
      await api.put(`/api/tables/${tableId}`, { is_active: false });
      toast.success('Table deleted successfully');
      fetchTables();
    } catch (error) {
      console.error('Failed to delete table:', error);
      toast.error('Failed to delete table');
    }
  };

  const getTableStatusColor = (table) => {
    if (table.has_active_orders) {
      return 'border-yellow-400 bg-yellow-100 text-yellow-800';
    }

    switch (table.status) {
      case 'available':
        return 'border-green-400 bg-green-100 text-green-800';
      case 'occupied':
        return 'border-red-400 bg-red-100 text-red-800';
      case 'reserved':
        return 'border-blue-400 bg-blue-100 text-blue-800';
      case 'cleaning':
        return 'border-gray-400 bg-gray-100 text-gray-800';
      default:
        return 'border-gray-300 bg-white text-gray-700';
    }
  };

  const getTableIcon = (table) => {
    if (table.has_active_orders) {
      return <Clock className="h-6 w-6" />;
    }
    
    switch (table.status) {
      case 'available':
        return <CheckCircle className="h-6 w-6" />;
      case 'occupied':
        return <Users className="h-6 w-6" />;
      case 'reserved':
        return <AlertCircle className="h-6 w-6" />;
      case 'cleaning':
        return <AlertCircle className="h-6 w-6" />;
      default:
        return <Users className="h-6 w-6" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // Show menu ordering interface
  if (showMenu && selectedTable) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center space-x-3 mb-2">
                <Users className="h-8 w-8" />
                <h1 className="text-3xl font-bold">Table {selectedTable.table_number} - Dine-In Order</h1>
              </div>
              <p className="text-blue-100">Select items for table {selectedTable.table_number} ({selectedTable.capacity} seats)</p>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => {
                  setShowMenu(false);
                  setSelectedTable(null);
                  setCart([]);
                }}
                className="btn bg-white bg-opacity-20 hover:bg-opacity-30 text-white border-white border-opacity-30"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Tables
              </button>
              {cart.length > 0 && (
                <div className="bg-white bg-opacity-20 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold">{getTotalItems()}</div>
                  <div className="text-sm">Items in Cart</div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Filters */}
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
            <button
              onClick={submitOrder}
              className="btn btn-primary"
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
                  Complete Order (€{getTotalAmount().toFixed(2)})
                </>
              )}
            </button>
          )}
        </div>

        {/* Menu Items */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredMenuItems.map((item) => (
            <div key={item.id} className="bg-white rounded-lg shadow-sm border p-4 hover:shadow-md transition-shadow">
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
                  {!item.is_available && (
                    <span className="bg-red-100 text-red-800 text-xs font-medium px-2 py-1 rounded-full">
                      Unavailable
                    </span>
                  )}
                </div>
                
                <p className="text-sm text-gray-600 mb-3 line-clamp-2">{item.description}</p>
                
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xl font-bold text-blue-600">€{item.price.toFixed(2)}</span>
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
            </div>
          ))}
        </div>

        {/* Empty State */}
        {filteredMenuItems.length === 0 && (
          <div className="text-center py-12">
            <ShoppingCart className="h-16 w-16 mx-auto text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No items found</h3>
            <p className="text-gray-600">Try adjusting your filters to see more items.</p>
          </div>
        )}

        {/* Cart Summary */}
        {cart.length > 0 && (
          <div className="fixed bottom-4 right-4 bg-white rounded-lg shadow-lg border p-4 max-w-sm">
            <h4 className="font-medium text-gray-900 mb-3">Order Summary</h4>
            <div className="space-y-2 max-h-40 overflow-y-auto">
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
            <div className="border-t pt-2 mt-2">
              <div className="flex justify-between items-center font-semibold">
                <span>Total:</span>
                <span className="text-lg">€{getTotalAmount().toFixed(2)}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Show table management interface
  return (
    <div className="space-y-6">
      {/* Reservation Modal */}
      <ReservationModal
        open={showReservationModal}
        onClose={() => setShowReservationModal(false)}
        onSubmit={handleReservationSubmit}
        table={reservationTable}
      />
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Restaurant Floor Plan</h1>
          <p className="text-gray-600">
            {isManagementMode 
              ? 'Management Mode: Click tables to edit, or add new tables'
              : 'Left-click reserved tables to view orders. Right-click any table and select "Reserved" to make a reservation.'
            }
          </p>
        </div>
        
        {isAdmin && (
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setIsManagementMode(!isManagementMode)}
              className={`btn ${isManagementMode ? 'btn-primary' : 'btn-secondary'}`}
            >
              <Settings className="h-4 w-4 mr-2" />
              {isManagementMode ? 'Exit Management' : 'Manage Tables'}
            </button>
            
            {isManagementMode && (
              <button
                onClick={() => setShowAddTableModal(true)}
                className="btn btn-success"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Table
              </button>
            )}
          </div>
        )}
      </div>

      {/* Management Mode Notice */}
      {isManagementMode && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <Settings className="h-5 w-5 text-blue-600" />
            <span className="text-blue-800 font-medium">Management Mode Active</span>
          </div>
          <p className="text-blue-700 text-sm mt-1">
            Click on tables to edit their properties, or use the Add Table button to create new tables.
          </p>
        </div>
      )}

      {/* Legend */}
      <div className="card p-4">
        <h3 className="text-sm font-medium text-gray-900 mb-3">Table Status Legend</h3>
        <div className="flex flex-wrap gap-4 text-sm">
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 rounded border-2 border-green-400 bg-green-100"></div>
            <span>Available</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 rounded border-2 border-red-400 bg-red-100"></div>
            <span>Occupied</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 rounded border-2 border-blue-400 bg-blue-100"></div>
            <span>Reserved</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 rounded border-2 border-yellow-400 bg-yellow-100"></div>
            <span>Active Orders</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 rounded border-2 border-gray-400 bg-gray-100"></div>
            <span>Cleaning</span>
          </div>
        </div>
      </div>

      {/* Tables Grid */}
      <div className="card p-6">
        <div className="grid grid-cols-5 gap-4 md:gap-6">
          {tables.map((table) => (
            <TableCard
              key={table.id}
              table={table}
              onClick={() => handleTableClick(table)}
              onStatusChange={(status) => updateTableStatus(table.id, status)}
              onDelete={() => deleteTable(table.id)}
              statusColor={getTableStatusColor(table)}
              icon={getTableIcon(table)}
              isManagementMode={isManagementMode}
              isAdmin={isAdmin}
              onReserve={handleReserveTable}
            />
          ))}
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title="Total Tables"
          count={tables.length}
          color="text-blue-600"
        />
        <StatCard
          title="Available"
          count={tables.filter(t => t.status === 'available' && !t.has_active_orders).length}
          color="text-success-600"
        />
        <StatCard
          title="Occupied"
          count={tables.filter(t => t.status === 'occupied').length}
          color="text-danger-600"
        />
        <StatCard
          title="Active Orders"
          count={tables.filter(t => t.has_active_orders).length}
          color="text-warning-600"
        />
      </div>

      {/* Add Table Modal */}
      {showAddTableModal && (
        <TableModal
          onClose={() => setShowAddTableModal(false)}
          onSave={createTable}
          title="Add New Table"
        />
      )}

      {/* Edit Table Modal */}
      {editingTable && (
        <TableModal
          table={editingTable}
          onClose={() => setEditingTable(null)}
          onSave={(data) => updateTable(editingTable.id, data)}
          title="Edit Table"
        />
      )}
    </div>
  );
};

const TableCard = ({ 
  table, 
  onClick, 
  onStatusChange, 
  onDelete, 
  statusColor, 
  icon, 
  isManagementMode, 
  isAdmin,
  onReserve
}) => {
  const [showMenu, setShowMenu] = useState(false);

  const handleRightClick = (e) => {
    e.preventDefault();
    if (!isManagementMode) {
      setShowMenu(!showMenu);
    }
  };

  const handleStatusChange = (status) => {
    if (status === 'reserved') {
      // Show reservation modal instead of just changing status
      onReserve(table);
    } else {
      onStatusChange(status);
    }
    setShowMenu(false);
  };

  return (
    <div className="relative">
      <div
        className={`table-cell ${statusColor} relative cursor-pointer border-2 rounded-lg p-2 transition-all duration-200 ${
          isManagementMode ? 'hover:scale-105 hover:shadow-md' : ''
        }`}
        onClick={onClick}
        onContextMenu={handleRightClick}
        style={{
          width: '90px',
          height: '90px',
        }}
      >
        <div className="flex flex-col items-center justify-center space-y-1 h-full">
          {icon}
          <span className="text-xs font-medium">{table.table_number}</span>
          <span className="text-xs opacity-75">{table.capacity} seats</span>
          {table.has_active_orders && (
            <span className="text-xs font-bold">{table.active_orders_count} orders</span>
          )}
          {/* Status Badge */}
          <span
            className={`mt-1 px-2 py-0.5 rounded-full text-xs font-semibold capitalize border ${statusColor}`}
            style={{ pointerEvents: 'none' }}
          >
            {table.has_active_orders ? 'Active Orders' : table.status}
          </span>
        </div>
        
        {table.assigned_waiter && (
          <div className="absolute -top-2 -right-2 bg-primary-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
            {table.assigned_waiter.name.split(' ').map(n => n[0]).join('')}
          </div>
        )}

        {/* Management Mode Indicators */}
        {isManagementMode && isAdmin && (
          <div className="absolute -top-1 -left-1 bg-blue-600 text-white rounded-full w-4 h-4 flex items-center justify-center">
            <Edit className="h-2 w-2" />
          </div>
        )}

        {/* Delete Button in Management Mode */}
        {isManagementMode && isAdmin && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="absolute -top-1 -right-1 bg-red-600 text-white rounded-full w-4 h-4 flex items-center justify-center hover:bg-red-700"
          >
            <X className="h-2 w-2" />
          </button>
        )}
      </div>

      {/* Context Menu (only in normal mode) */}
      {showMenu && !isManagementMode && (
        <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 min-w-32">
          <button
            onClick={() => handleStatusChange('available')}
            className="block w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
          >
            Available
          </button>
          <button
            onClick={() => handleStatusChange('occupied')}
            className="block w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
          >
            Occupied
          </button>
          <button
            onClick={() => handleStatusChange('reserved')}
            className="block w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
          >
            Reserved
          </button>
          <button
            onClick={() => handleStatusChange('cleaning')}
            className="block w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
          >
            Cleaning
          </button>
        </div>
      )}
    </div>
  );
};

const TableModal = ({ table, onClose, onSave, title }) => {
  const [formData, setFormData] = useState({
    table_number: table?.table_number || '',
    capacity: table?.capacity || 4,
    x_position: table?.x_position || 0,
    y_position: table?.y_position || 0,
    status: table?.status || 'available'
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!formData.table_number.trim()) {
      toast.error('Table number is required');
      return;
    }

    if (formData.capacity < 1 || formData.capacity > 20) {
      toast.error('Capacity must be between 1 and 20');
      return;
    }

    onSave(formData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Table Number
              </label>
              <input
                type="text"
                required
                value={formData.table_number}
                onChange={(e) => setFormData({ ...formData, table_number: e.target.value })}
                className="input"
                placeholder="e.g., T01, Table 1, etc."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Seating Capacity
              </label>
              <input
                type="number"
                required
                min="1"
                max="20"
                value={formData.capacity}
                onChange={(e) => setFormData({ ...formData, capacity: parseInt(e.target.value) })}
                className="input"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  X Position
                </label>
                <input
                  type="number"
                  value={formData.x_position}
                  onChange={(e) => setFormData({ ...formData, x_position: parseFloat(e.target.value) })}
                  className="input"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Y Position
                </label>
                <input
                  type="number"
                  value={formData.y_position}
                  onChange={(e) => setFormData({ ...formData, y_position: parseFloat(e.target.value) })}
                  className="input"
                  placeholder="0"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Initial Status
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="input"
              >
                <option value="available">Available</option>
                <option value="occupied">Occupied</option>
                <option value="reserved">Reserved</option>
                <option value="cleaning">Cleaning</option>
              </select>
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
              >
                <Save className="h-4 w-4 mr-2" />
                Save Table
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ title, count, color }) => {
  return (
    <div className="card p-4 text-center">
      <div className={`text-2xl font-bold ${color}`}>{count}</div>
      <div className="text-sm text-gray-600">{title}</div>
    </div>
  );
};

export default TableView;