import React, { useState, useEffect } from 'react';
import { 
  Menu, 
  Plus, 
  Edit, 
  Trash2, 
  Save, 
  X, 
  DollarSign,
  Clock,
  Eye,
  EyeOff,
  Package,
  Tag,
  MapPin,
  Copy
} from 'lucide-react';
import api from '../config/api';
import toast from 'react-hot-toast';
import LoadingSpinner from './LoadingSpinner';

const MenuPricingManagement = () => {
  const [activeTab, setActiveTab] = useState('items');
  const [menuItems, setMenuItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [itemsResponse, categoriesResponse, locationsResponse] = await Promise.all([
        api.get('/api/admin/menu-items'),
        api.get('/api/admin/categories'),
        api.get('/api/admin/locations')
      ]);
      setMenuItems(itemsResponse.data.items);
      setCategories(categoriesResponse.data.categories);
      setLocations(locationsResponse.data.locations);
    } catch (error) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: 'items', name: 'Menu Items', icon: Menu },
    { id: 'categories', name: 'Categories', icon: Tag },
    { id: 'pricing', name: 'Location Pricing', icon: DollarSign },
  ];

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Menu & Pricing Management</h2>
        <p className="text-sm text-gray-600">Manage menu items, categories, and location-specific pricing</p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{tab.name}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Content */}
      <div>
        {activeTab === 'items' && (
          <MenuItemsManagement 
            menuItems={menuItems} 
            categories={categories}
            locations={locations}
            onDataChange={loadData}
          />
        )}
        {activeTab === 'categories' && (
          <CategoriesManagement 
            categories={categories}
            onDataChange={loadData}
          />
        )}
        {activeTab === 'pricing' && (
          <LocationPricingManagement 
            menuItems={menuItems}
            locations={locations}
            onDataChange={loadData}
          />
        )}
      </div>
    </div>
  );
};

// Menu Items Management Component
const MenuItemsManagement = ({ menuItems, categories, locations, onDataChange }) => {
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category_id: '',
    preparation_time: 15,
    allergens: '',
    nutritional_info: '',
    is_available: true,
    image_url: ''
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingItem) {
        await api.put(`/api/admin/menu-items/${editingItem.id}`, formData);
        toast.success('Menu item updated successfully');
      } else {
        await api.post('/api/admin/menu-items', formData);
        toast.success('Menu item created successfully');
      }
      setShowForm(false);
      setEditingItem(null);
      resetForm();
      onDataChange();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to save menu item');
    }
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      description: item.description || '',
      category_id: item.category_id,
      preparation_time: item.preparation_time,
      allergens: item.allergens || '',
      nutritional_info: item.nutritional_info || '',
      is_available: item.is_available,
      image_url: item.image_url || ''
    });
    setShowForm(true);
  };

  const handleDelete = async (itemId) => {
    if (window.confirm('Are you sure you want to delete this menu item?')) {
      try {
        await api.delete(`/api/admin/menu-items/${itemId}`);
        toast.success('Menu item deleted successfully');
        onDataChange();
      } catch (error) {
        toast.error('Failed to delete menu item');
      }
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      category_id: '',
      preparation_time: 15,
      allergens: '',
      nutritional_info: '',
      is_available: true,
      image_url: ''
    });
  };

  const filteredItems = selectedCategory 
    ? menuItems.filter(item => item.category_id.toString() === selectedCategory)
    : menuItems;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-4">
          <h3 className="text-lg font-semibold text-gray-900">Menu Items</h3>
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
        <button
          onClick={() => {
            resetForm();
            setEditingItem(null);
            setShowForm(true);
          }}
          className="btn btn-primary"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Menu Item
        </button>
      </div>

      {/* Menu Items Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredItems.map((item) => (
          <div key={item.id} className="card p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <h4 className="font-semibold text-gray-900">{item.name}</h4>
                <p className="text-sm text-gray-600 mt-1">{item.description}</p>
                <div className="flex items-center space-x-2 mt-2">
                  <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-xs">
                    {item.category?.name}
                  </span>
                  <div className="flex items-center space-x-1 text-xs text-gray-500">
                    <Clock className="h-3 w-3" />
                    <span>{item.preparation_time}min</span>
                  </div>
                </div>
              </div>
              <div className="flex space-x-1 ml-2">
                <button
                  onClick={() => handleEdit(item)}
                  className="p-1 text-gray-400 hover:text-gray-600"
                >
                  <Edit className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleDelete(item.id)}
                  className="p-1 text-gray-400 hover:text-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Pricing Summary */}
            <div className="space-y-2">
              {item.prices?.map((price) => (
                <div key={price.location_id} className="flex justify-between text-sm">
                  <span className="text-gray-600">{price.location?.name}:</span>
                  <div className="space-x-2">
                    <span className="font-medium">€{price.dine_in_price}</span>
                    <span className="text-gray-500">/ €{price.takeaway_price}</span>
                  </div>
                </div>
              ))}
            </div>

            {!item.is_available && (
              <div className="mt-3">
                <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs">
                  Unavailable
                </span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Menu Item Form Modal */}
      {showForm && (
        <MenuItemFormModal
          formData={formData}
          setFormData={setFormData}
          categories={categories}
          editingItem={editingItem}
          onSubmit={handleSubmit}
          onClose={() => setShowForm(false)}
        />
      )}
    </div>
  );
};

// Categories Management Component
const CategoriesManagement = ({ categories, onDataChange }) => {
  const [showForm, setShowForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    printer_destination: 'kitchen',
    sort_order: 0,
    is_active: true,
    image_url: ''
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingCategory) {
        await api.put(`/api/admin/categories/${editingCategory.id}`, formData);
        toast.success('Category updated successfully');
      } else {
        await api.post('/api/admin/categories', formData);
        toast.success('Category created successfully');
      }
      setShowForm(false);
      setEditingCategory(null);
      resetForm();
      onDataChange();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to save category');
    }
  };

  const handleEdit = (category) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      description: category.description || '',
      printer_destination: category.printer_destination,
      sort_order: category.sort_order,
      is_active: category.is_active,
      image_url: category.image_url || ''
    });
    setShowForm(true);
  };

  const handleDelete = async (categoryId) => {
    if (window.confirm('Are you sure you want to delete this category?')) {
      try {
        await api.delete(`/api/admin/categories/${categoryId}`);
        toast.success('Category deleted successfully');
        onDataChange();
      } catch (error) {
        toast.error('Failed to delete category');
      }
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      printer_destination: 'kitchen',
      sort_order: 0,
      is_active: true,
      image_url: ''
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-gray-900">Categories</h3>
        <button
          onClick={() => {
            resetForm();
            setEditingCategory(null);
            setShowForm(true);
          }}
          className="btn btn-primary"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Category
        </button>
      </div>

      {/* Categories Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Category
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Printer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Order
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {categories.map((category) => (
                <tr key={category.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{category.name}</div>
                      <div className="text-sm text-gray-500">{category.description}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      category.printer_destination === 'kitchen' 
                        ? 'bg-orange-100 text-orange-700' 
                        : 'bg-blue-100 text-blue-700'
                    }`}>
                      {category.printer_destination}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {category.sort_order}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      category.is_active 
                        ? 'bg-green-100 text-green-700' 
                        : 'bg-red-100 text-red-700'
                    }`}>
                      {category.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleEdit(category)}
                        className="text-primary-600 hover:text-primary-900"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(category.id)}
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
      </div>

      {/* Category Form Modal */}
      {showForm && (
        <CategoryFormModal
          formData={formData}
          setFormData={setFormData}
          editingCategory={editingCategory}
          onSubmit={handleSubmit}
          onClose={() => setShowForm(false)}
        />
      )}
    </div>
  );
};

// Location Pricing Management Component
const LocationPricingManagement = ({ menuItems, locations, onDataChange }) => {
  const [selectedLocation, setSelectedLocation] = useState('');
  const [editingPrices, setEditingPrices] = useState({});
  const [showBulkUpdate, setShowBulkUpdate] = useState(false);

  const handlePriceUpdate = async (itemId, locationId, priceData) => {
    try {
      await api.put(`/api/admin/menu-items/${itemId}/prices/${locationId}`, priceData);
      toast.success('Price updated successfully');
      onDataChange();
    } catch (error) {
      toast.error('Failed to update price');
    }
  };

  const handleBulkPriceUpdate = async (percentage, locationType) => {
    try {
      await api.post('/api/admin/menu-items/bulk-price-update', {
        percentage,
        location_type: locationType,
        location_id: selectedLocation
      });
      toast.success('Bulk price update completed');
      onDataChange();
      setShowBulkUpdate(false);
    } catch (error) {
      toast.error('Failed to update prices');
    }
  };

  const copyPricesFromLocation = async (fromLocationId, toLocationId) => {
    if (window.confirm('This will overwrite all prices for the target location. Continue?')) {
      try {
        await api.post('/api/admin/menu-items/copy-prices', {
          from_location_id: fromLocationId,
          to_location_id: toLocationId
        });
        toast.success('Prices copied successfully');
        onDataChange();
      } catch (error) {
        toast.error('Failed to copy prices');
      }
    }
  };

  const filteredItems = selectedLocation 
    ? menuItems.filter(item => 
        item.prices?.some(price => price.location_id.toString() === selectedLocation)
      )
    : menuItems;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-4">
          <h3 className="text-lg font-semibold text-gray-900">Location Pricing</h3>
          <select
            value={selectedLocation}
            onChange={(e) => setSelectedLocation(e.target.value)}
            className="input w-auto"
          >
            <option value="">All Locations</option>
            {locations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={() => setShowBulkUpdate(true)}
            className="btn btn-secondary"
          >
            Bulk Update
          </button>
        </div>
      </div>

      {/* Pricing Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Menu Item
                </th>
                {locations.map((location) => (
                  <th key={location.id} className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {location.name}
                    <div className="text-xs font-normal text-gray-400">Dine-in / Takeaway</div>
                  </th>
                ))}
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredItems.map((item) => (
                <tr key={item.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{item.name}</div>
                      <div className="text-sm text-gray-500">{item.category?.name}</div>
                    </div>
                  </td>
                  {locations.map((location) => {
                    const price = item.prices?.find(p => p.location_id === location.id);
                    return (
                      <td key={location.id} className="px-6 py-4 whitespace-nowrap text-center">
                        {price ? (
                          <PriceEditor
                            price={price}
                            onUpdate={(priceData) => handlePriceUpdate(item.id, location.id, priceData)}
                          />
                        ) : (
                          <span className="text-gray-400 text-sm">Not available</span>
                        )}
                      </td>
                    );
                  })}
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button
                      onClick={() => {/* Open detailed pricing modal */}}
                      className="text-primary-600 hover:text-primary-900"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bulk Update Modal */}
      {showBulkUpdate && (
        <BulkPriceUpdateModal
          locations={locations}
          onUpdate={handleBulkPriceUpdate}
          onCopyPrices={copyPricesFromLocation}
          onClose={() => setShowBulkUpdate(false)}
        />
      )}
    </div>
  );
};

// Price Editor Component
const PriceEditor = ({ price, onUpdate }) => {
  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState({
    dine_in_price: price.dine_in_price,
    takeaway_price: price.takeaway_price,
    is_available_dine_in: price.is_available_dine_in,
    is_available_takeaway: price.is_available_takeaway
  });

  const handleSave = () => {
    onUpdate(values);
    setEditing(false);
  };

  const handleCancel = () => {
    setValues({
      dine_in_price: price.dine_in_price,
      takeaway_price: price.takeaway_price,
      is_available_dine_in: price.is_available_dine_in,
      is_available_takeaway: price.is_available_takeaway
    });
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="space-y-2">
        <div className="flex space-x-1">
          <input
            type="number"
            step="0.01"
            value={values.dine_in_price}
            onChange={(e) => setValues({ ...values, dine_in_price: parseFloat(e.target.value) })}
            className="w-16 px-1 py-1 text-xs border rounded"
          />
          <input
            type="number"
            step="0.01"
            value={values.takeaway_price}
            onChange={(e) => setValues({ ...values, takeaway_price: parseFloat(e.target.value) })}
            className="w-16 px-1 py-1 text-xs border rounded"
          />
        </div>
        <div className="flex space-x-1">
          <button onClick={handleSave} className="p-1 text-green-600 hover:text-green-800">
            <Save className="h-3 w-3" />
          </button>
          <button onClick={handleCancel} className="p-1 text-red-600 hover:text-red-800">
            <X className="h-3 w-3" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="cursor-pointer hover:bg-gray-50 p-1 rounded"
      onClick={() => setEditing(true)}
    >
      <div className="text-sm font-medium">
        €{price.dine_in_price} / €{price.takeaway_price}
      </div>
      <div className="flex justify-center space-x-1 mt-1">
        {price.is_available_dine_in ? (
          <Eye className="h-3 w-3 text-green-500" />
        ) : (
          <EyeOff className="h-3 w-3 text-red-500" />
        )}
        {price.is_available_takeaway ? (
          <Package className="h-3 w-3 text-green-500" />
        ) : (
          <Package className="h-3 w-3 text-red-500" />
        )}
      </div>
    </div>
  );
};

// Form Modals (simplified for brevity)
const MenuItemFormModal = ({ formData, setFormData, categories, editingItem, onSubmit, onClose }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
        <form onSubmit={onSubmit} className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">
              {editingItem ? 'Edit Menu Item' : 'Add Menu Item'}
            </h3>
            <button type="button" onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="input"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="input"
                rows="3"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <select
                value={formData.category_id}
                onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                className="input"
                required
              >
                <option value="">Select Category</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Preparation Time (minutes)
              </label>
              <input
                type="number"
                min="1"
                value={formData.preparation_time}
                onChange={(e) => setFormData({ ...formData, preparation_time: parseInt(e.target.value) })}
                className="input"
                required
              />
            </div>

            <div>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.is_available}
                  onChange={(e) => setFormData({ ...formData, is_available: e.target.checked })}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="ml-2 text-sm text-gray-700">Available</span>
              </label>
            </div>
          </div>

          <div className="flex justify-end space-x-3 mt-6">
            <button type="button" onClick={onClose} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              <Save className="h-4 w-4 mr-2" />
              {editingItem ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const CategoryFormModal = ({ formData, setFormData, editingCategory, onSubmit, onClose }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full">
        <form onSubmit={onSubmit} className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">
              {editingCategory ? 'Edit Category' : 'Add Category'}
            </h3>
            <button type="button" onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="input"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="input"
                rows="2"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Printer Destination</label>
              <select
                value={formData.printer_destination}
                onChange={(e) => setFormData({ ...formData, printer_destination: e.target.value })}
                className="input"
              >
                <option value="kitchen">Kitchen</option>
                <option value="bar">Bar</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sort Order</label>
              <input
                type="number"
                value={formData.sort_order}
                onChange={(e) => setFormData({ ...formData, sort_order: parseInt(e.target.value) })}
                className="input"
              />
            </div>

            <div>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="ml-2 text-sm text-gray-700">Active</span>
              </label>
            </div>
          </div>

          <div className="flex justify-end space-x-3 mt-6">
            <button type="button" onClick={onClose} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              <Save className="h-4 w-4 mr-2" />
              {editingCategory ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const BulkPriceUpdateModal = ({ locations, onUpdate, onCopyPrices, onClose }) => {
  const [updateType, setUpdateType] = useState('percentage');
  const [percentage, setPercentage] = useState(0);
  const [selectedLocation, setSelectedLocation] = useState('');
  const [fromLocation, setFromLocation] = useState('');
  const [toLocation, setToLocation] = useState('');

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Bulk Price Update</h3>
            <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Update Type</label>
              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="percentage"
                    checked={updateType === 'percentage'}
                    onChange={(e) => setUpdateType(e.target.value)}
                    className="text-primary-600"
                  />
                  <span className="ml-2 text-sm">Percentage Increase/Decrease</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="copy"
                    checked={updateType === 'copy'}
                    onChange={(e) => setUpdateType(e.target.value)}
                    className="text-primary-600"
                  />
                  <span className="ml-2 text-sm">Copy Prices Between Locations</span>
                </label>
              </div>
            </div>

            {updateType === 'percentage' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Percentage Change (+ or -)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={percentage}
                    onChange={(e) => setPercentage(parseFloat(e.target.value))}
                    className="input"
                    placeholder="e.g., 10 for 10% increase, -5 for 5% decrease"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                  <select
                    value={selectedLocation}
                    onChange={(e) => setSelectedLocation(e.target.value)}
                    className="input"
                  >
                    <option value="">All Locations</option>
                    {locations.map((location) => (
                      <option key={location.id} value={location.id}>
                        {location.name}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}

            {updateType === 'copy' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">From Location</label>
                  <select
                    value={fromLocation}
                    onChange={(e) => setFromLocation(e.target.value)}
                    className="input"
                  >
                    <option value="">Select source location</option>
                    {locations.map((location) => (
                      <option key={location.id} value={location.id}>
                        {location.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">To Location</label>
                  <select
                    value={toLocation}
                    onChange={(e) => setToLocation(e.target.value)}
                    className="input"
                  >
                    <option value="">Select target location</option>
                    {locations.map((location) => (
                      <option key={location.id} value={location.id}>
                        {location.name}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}
          </div>

          <div className="flex justify-end space-x-3 mt-6">
            <button onClick={onClose} className="btn btn-secondary">
              Cancel
            </button>
            <button
              onClick={() => {
                if (updateType === 'percentage') {
                  onUpdate(percentage, selectedLocation);
                } else {
                  onCopyPrices(fromLocation, toLocation);
                }
              }}
              className="btn btn-primary"
              disabled={
                updateType === 'percentage' 
                  ? !percentage 
                  : !fromLocation || !toLocation
              }
            >
              Apply Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MenuPricingManagement;