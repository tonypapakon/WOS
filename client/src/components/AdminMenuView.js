import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Search, 
  Save,
  X,
  Clock,
  Package,
  ShoppingBag,
  Eye,
  EyeOff,
  Hash
} from 'lucide-react';
import api from '../config/api';
import toast from 'react-hot-toast';
import LoadingSpinner from './LoadingSpinner';

const AdminMenuView = () => {
  const [menuItems, setMenuItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  
  const { user } = useAuth();

  
  const fetchCategories = useCallback(async () => {
    try {
      const response = await api.get('/api/menu/categories');
      setCategories(response.data.categories);
    } catch (error) {
      console.error('Failed to fetch categories:', error);
      toast.error('Failed to load categories');
    }
  }, []);

  const fetchMenuItems = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (selectedCategory) params.append('category_id', selectedCategory);
      if (searchTerm) params.append('search', searchTerm);
      
      const response = await api.get(`/api/menu/items/admin?${params}`);
      setMenuItems(response.data.menu_items);
    } catch (error) {
      console.error('Failed to fetch menu items:', error);
      toast.error('Failed to load menu items');
    } finally {
      setLoading(false);
    }
  }, [selectedCategory, searchTerm]);

  // Initialize data once user is present and authorized
  useEffect(() => {
    if (user?.role === 'admin' || user?.role === 'manager') {
      fetchCategories();
      fetchMenuItems();
    }
  }, [user, fetchCategories, fetchMenuItems]);

  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      fetchMenuItems();
    }, 300);
    return () => clearTimeout(debounceTimer);
  }, [fetchMenuItems]);

  const handleCreateItem = () => {
    setEditingItem({
      name: '',
      barcode: '',
      description: '',
      price: '',
      takeaway_price: '',
      takeaway_description: '',
      category_id: categories[0]?.id || '',
      image_url: '',
      is_available: true,
      is_available_takeaway: true,
      is_takeaway_only: false,
      preparation_time: 15,
      takeaway_preparation_time: '',
      allergens: '',
      nutritional_info: '',
      sort_order: 0
    });
    setShowModal(true);
  };

  const handleEditItem = (item) => {
    setEditingItem({
      ...item,
      price: item.price.toString(),
      takeaway_price: item.takeaway_price?.toString() || '',
      preparation_time: item.preparation_time || 15,
      takeaway_preparation_time: item.takeaway_preparation_time?.toString() || '',
      sort_order: item.sort_order || 0,
      barcode: item.barcode || ''
    });
    setShowModal(true);
  };

  const handleSaveItem = async () => {
    try {
      const itemData = {
        ...editingItem,
        price: parseFloat(editingItem.price),
        takeaway_price: editingItem.takeaway_price ? parseFloat(editingItem.takeaway_price) : null,
        preparation_time: parseInt(editingItem.preparation_time),
        takeaway_preparation_time: editingItem.takeaway_preparation_time ? parseInt(editingItem.takeaway_preparation_time) : null,
        sort_order: parseInt(editingItem.sort_order),
        barcode: editingItem.barcode || null
      };

      if (editingItem.id) {
        await api.put(`/api/menu/items/${editingItem.id}`, itemData);
        toast.success('Menu item updated successfully');
      } else {
        await api.post('/api/menu/items', itemData);
        toast.success('Menu item created successfully');
      }

      setShowModal(false);
      setEditingItem(null);
      fetchMenuItems();
    } catch (error) {
      console.error('Failed to save menu item:', error);
      toast.error(error.response?.data?.error || 'Failed to save menu item');
    }
  };

  const handleDeleteItem = async (itemId) => {
    if (!window.confirm('Are you sure you want to delete this menu item?')) return;

    try {
      await api.delete(`/api/menu/items/${itemId}`);
      toast.success('Menu item deleted successfully');
      fetchMenuItems();
    } catch (error) {
      console.error('Failed to delete menu item:', error);
      toast.error('Failed to delete menu item');
    }
  };

  const handleCreateCategory = async (categoryData) => {
    try {
      await api.post('/api/menu/categories', categoryData);
      toast.success('Category created successfully');
      fetchCategories();
      setShowCategoryModal(false);
    } catch (error) {
      console.error('Failed to create category:', error);
      toast.error('Failed to create category');
    }
  };

  if (user?.role !== 'admin' && user?.role !== 'manager') {
    return (
      <div className="text-center py-12">
        <h3 className="text-lg font-medium text-gray-900 mb-2">Access Denied</h3>
        <p className="text-gray-600">You don't have permission to access this page.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Menu Management</h1>
          <p className="text-gray-600">Manage menu items and pricing for dine-in and takeaway</p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={() => setShowCategoryModal(true)}
            className="btn btn-secondary"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Category
          </button>
          <button
            onClick={handleCreateItem}
            className="btn btn-primary"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Menu Item
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, description, or barcode..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input pl-10"
            />
          </div>
          
          <div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="input"
            >
              <option value="">All Categories</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>

          <div className="text-sm text-gray-600 flex items-center">
            Total Items: {menuItems.length}
          </div>
        </div>
      </div>

      {/* Menu Items Table */}
      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <LoadingSpinner size="lg" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Item
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Hash
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Category
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Dine-in Price
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Takeaway Price
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Availability
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {menuItems.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {item.image_url && (
                          <img
                            src={item.image_url}
                            alt={item.name}
                            className="h-10 w-10 rounded-lg object-cover mr-3"
                          />
                        )}
                        <div>
                          <div className="text-sm font-medium text-gray-900 flex items-center">
                            {item.name}
                            {item.is_takeaway_only && (
                              <span className="ml-2 bg-orange-100 text-orange-800 text-xs font-medium px-2 py-1 rounded-full">
                                Takeaway Only
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-gray-500 max-w-xs truncate">
                            {item.description}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {item.barcode ? (
                        <div className="flex items-center">
                          <Hash className="h-4 w-4 text-gray-400 mr-2" />
                          <span className="text-sm font-mono text-gray-900">{item.barcode}</span>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">No barcode</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {item.category_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <span className="text-green-600 mr-1 text-sm font-medium">€</span>
                        <span className="text-sm font-medium text-gray-900">
                          {item.price.toFixed(2)}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {item.takeaway_price ? (
                        <div className="flex items-center">
                          <span className="text-orange-600 mr-1 text-sm font-medium">€</span>
                          <span className="text-sm font-medium text-gray-900">
                            {item.takeaway_price.toFixed(2)}
                          </span>
                          {item.takeaway_price < item.price && (
                            <span className="ml-2 bg-green-100 text-green-800 text-xs font-medium px-2 py-1 rounded-full">
                              Save €{(item.price - item.takeaway_price).toFixed(2)}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-sm text-gray-500">Same as dine-in</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex space-x-2">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          item.is_available 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {item.is_available ? (
                            <>
                              <Eye className="h-3 w-3 mr-1" />
                              Dine-in
                            </>
                          ) : (
                            <>
                              <EyeOff className="h-3 w-3 mr-1" />
                              Hidden
                            </>
                          )}
                        </span>
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          item.is_available_takeaway 
                            ? 'bg-orange-100 text-orange-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {item.is_available_takeaway ? (
                            <>
                              <ShoppingBag className="h-3 w-3 mr-1" />
                              Takeaway
                            </>
                          ) : (
                            <>
                              <EyeOff className="h-3 w-3 mr-1" />
                              Hidden
                            </>
                          )}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleEditItem(item)}
                          className="text-primary-600 hover:text-primary-900"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteItem(item.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && menuItems.length === 0 && (
          <div className="text-center py-12">
            <Package className="h-16 w-16 mx-auto text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No menu items found</h3>
            <p className="text-gray-600">
              {searchTerm || selectedCategory 
                ? 'No items match your current filters.' 
                : 'Start by creating your first menu item.'
              }
            </p>
          </div>
        )}
      </div>

      {/* Menu Item Modal */}
      {showModal && (
        <MenuItemModal
          item={editingItem}
          categories={categories}
          onSave={handleSaveItem}
          onClose={() => {
            setShowModal(false);
            setEditingItem(null);
          }}
          onChange={setEditingItem}
        />
      )}

      {/* Category Modal */}
      {showCategoryModal && (
        <CategoryModal
          onSave={handleCreateCategory}
          onClose={() => setShowCategoryModal(false)}
        />
      )}
    </div>
  );
};

const MenuItemModal = ({ item, categories, onSave, onClose, onChange }) => {
  const handleSubmit = (e) => {
    e.preventDefault();
    onSave();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">
              {item.id ? 'Edit Menu Item' : 'Add New Menu Item'}
            </h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="h-5 w-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Basic Information */}
              <div className="space-y-4">
                <h4 className="text-md font-medium text-gray-900">Basic Information</h4>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Item Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={item.name}
                    onChange={(e) => onChange({ ...item, name: e.target.value })}
                    className="input"
                    placeholder="Enter item name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Hash
                  </label>
                  <div className="relative">
                    <Hash className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      value={item.barcode}
                      onChange={(e) => onChange({ ...item, barcode: e.target.value })}
                      className="input pl-10"
                      placeholder="Enter barcode (optional)"
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Hash helps with quick item identification and search
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    value={item.description}
                    onChange={(e) => onChange({ ...item, description: e.target.value })}
                    className="input"
                    rows="3"
                    placeholder="Enter item description"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Category *
                  </label>
                  <select
                    required
                    value={item.category_id}
                    onChange={(e) => onChange({ ...item, category_id: e.target.value })}
                    className="input"
                  >
                    <option value="">Select a category</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Image URL
                  </label>
                  <input
                    type="url"
                    value={item.image_url}
                    onChange={(e) => onChange({ ...item, image_url: e.target.value })}
                    className="input"
                    placeholder="https://example.com/image.jpg"
                  />
                </div>
              </div>

              {/* Pricing & Availability */}
              <div className="space-y-4">
                <h4 className="text-md font-medium text-gray-900">Pricing & Availability</h4>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Dine-in Price *
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 text-sm">€</span>
                      <input
                        type="number"
                        step="0.01"
                        required
                        value={item.price}
                        onChange={(e) => onChange({ ...item, price: e.target.value })}
                        className="input pl-10"
                        placeholder="0.00"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Takeaway Price
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 text-sm">€</span>
                      <input
                        type="number"
                        step="0.01"
                        value={item.takeaway_price}
                        onChange={(e) => onChange({ ...item, takeaway_price: e.target.value })}
                        className="input pl-10"
                        placeholder="Same as dine-in"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Takeaway Description
                  </label>
                  <textarea
                    value={item.takeaway_description}
                    onChange={(e) => onChange({ ...item, takeaway_description: e.target.value })}
                    className="input"
                    rows="2"
                    placeholder="Special description for takeaway (optional)"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Prep Time (min)
                    </label>
                    <div className="relative">
                      <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <input
                        type="number"
                        value={item.preparation_time}
                        onChange={(e) => onChange({ ...item, preparation_time: e.target.value })}
                        className="input pl-10"
                        placeholder="15"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Takeaway Prep Time
                    </label>
                    <div className="relative">
                      <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <input
                        type="number"
                        value={item.takeaway_preparation_time}
                        onChange={(e) => onChange({ ...item, takeaway_preparation_time: e.target.value })}
                        className="input pl-10"
                        placeholder="Same as dine-in"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="is_available"
                      checked={item.is_available}
                      onChange={(e) => onChange({ ...item, is_available: e.target.checked })}
                      className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                    />
                    <label htmlFor="is_available" className="ml-2 block text-sm text-gray-900">
                      Available for dine-in
                    </label>
                  </div>

                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="is_available_takeaway"
                      checked={item.is_available_takeaway}
                      onChange={(e) => onChange({ ...item, is_available_takeaway: e.target.checked })}
                      className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                    />
                    <label htmlFor="is_available_takeaway" className="ml-2 block text-sm text-gray-900">
                      Available for takeaway
                    </label>
                  </div>

                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="is_takeaway_only"
                      checked={item.is_takeaway_only}
                      onChange={(e) => onChange({ ...item, is_takeaway_only: e.target.checked })}
                      className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                    />
                    <label htmlFor="is_takeaway_only" className="ml-2 block text-sm text-gray-900">
                      Takeaway only (not available for dine-in)
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* Additional Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Allergens
                </label>
                <input
                  type="text"
                  value={item.allergens}
                  onChange={(e) => onChange({ ...item, allergens: e.target.value })}
                  className="input"
                  placeholder="e.g., nuts, dairy, gluten"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Sort Order
                </label>
                <input
                  type="number"
                  value={item.sort_order}
                  onChange={(e) => onChange({ ...item, sort_order: e.target.value })}
                  className="input"
                  placeholder="0"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nutritional Information
              </label>
              <textarea
                value={item.nutritional_info}
                onChange={(e) => onChange({ ...item, nutritional_info: e.target.value })}
                className="input"
                rows="2"
                placeholder="Calories, protein, etc."
              />
            </div>

            <div className="flex justify-end space-x-3 pt-4 border-t">
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
                {item.id ? 'Update Item' : 'Create Item'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

const CategoryModal = ({ onSave, onClose }) => {
  const [categoryData, setCategoryData] = useState({
    name: '',
    description: '',
    image_url: '',
    sort_order: 0,
    printer_destination: 'kitchen'
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(categoryData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Add New Category</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="h-5 w-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Category Name *
              </label>
              <input
                type="text"
                required
                value={categoryData.name}
                onChange={(e) => setCategoryData({ ...categoryData, name: e.target.value })}
                className="input"
                placeholder="Enter category name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                value={categoryData.description}
                onChange={(e) => setCategoryData({ ...categoryData, description: e.target.value })}
                className="input"
                rows="2"
                placeholder="Enter category description"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Printer Destination
              </label>
              <select
                value={categoryData.printer_destination}
                onChange={(e) => setCategoryData({ ...categoryData, printer_destination: e.target.value })}
                className="input"
              >
                <option value="kitchen">Kitchen</option>
                <option value="bar">Bar</option>
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
                Create Category
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AdminMenuView;