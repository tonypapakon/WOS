import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { 
  Settings, 
  Users, 
  Printer, 
  User,
  Plus,
  Edit,
  Trash2,
  Save,
  X,
  Check,
  AlertCircle,
  Menu,
  MapPin
} from 'lucide-react';
import api from '../config/api';
import toast from 'react-hot-toast';
import LoadingSpinner from './LoadingSpinner';
import AdminMenuView from './AdminMenuView';

const SettingsView = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('menu');

  if (user?.role !== 'admin' && user?.role !== 'manager') {
    return (
      <div className="text-center py-12">
        <Settings className="h-16 w-16 mx-auto text-gray-300 mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Access Restricted</h2>
        <p className="text-gray-600">You don't have permission to access settings.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-600">Manage your restaurant system configuration</p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'menu', name: 'Menu Management', icon: Menu },
            { id: 'users', name: 'User Management', icon: Users },
            { id: 'locations', name: 'Location Management', icon: MapPin },
            { id: 'printers', name: 'Printer Settings', icon: Printer },
            { id: 'system', name: 'System Settings', icon: Settings }
          ].map((tab) => {
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
        {activeTab === 'menu' && <AdminMenuView />}
        {activeTab === 'users' && <UserManagement />}
        {activeTab === 'locations' && <LocationManagement />}
        {activeTab === 'printers' && <PrinterSettings />}
        {activeTab === 'system' && <SystemSettings />}
      </div>
    </div>
  );
};

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddUser, setShowAddUser] = useState(false);
  const [editingUser, setEditingUser] = useState(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/auth/users');
      setUsers(response.data.users);
    } catch (error) {
      console.error('Failed to fetch users:', error);
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const handleAddUser = async (userData) => {
    try {
      await api.post('/api/auth/register', userData);
      toast.success('User created successfully');
      setShowAddUser(false);
      fetchUsers();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to create user');
    }
  };

  const handleUpdateUser = async (userId, userData) => {
    try {
      await api.put(`/api/auth/users/${userId}`, userData);
      toast.success('User updated successfully');
      setEditingUser(null);
      fetchUsers();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to update user');
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
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold text-gray-900">User Management</h2>
        <button
          onClick={() => setShowAddUser(true)}
          className="btn btn-primary"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add User
        </button>
      </div>

      {/* Users Table */}
      <div className="card overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                User
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Role
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Created
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {users.map((user) => (
              <tr key={user.id}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="h-8 w-8 bg-gray-300 rounded-full flex items-center justify-center">
                      <User className="h-4 w-4 text-gray-600" />
                    </div>
                    <div className="ml-4">
                      <div className="text-sm font-medium text-gray-900">
                        {user.first_name} {user.last_name}
                      </div>
                      <div className="text-sm text-gray-500">@{user.username}</div>
                      <div className="text-xs text-gray-400">{user.email}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    user.role === 'admin' ? 'bg-purple-100 text-purple-800' :
                    user.role === 'manager' ? 'bg-blue-100 text-blue-800' :
                    'bg-green-100 text-green-800'
                  }`}>
                    {user.role}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    user.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {user.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(user.created_at).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button
                    onClick={() => setEditingUser(user)}
                    className="text-primary-600 hover:text-primary-900 mr-3"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add User Modal */}
      {showAddUser && (
        <UserModal
          onClose={() => setShowAddUser(false)}
          onSave={handleAddUser}
          title="Add New User"
        />
      )}

      {/* Edit User Modal */}
      {editingUser && (
        <UserModal
          user={editingUser}
          onClose={() => setEditingUser(null)}
          onSave={(userData) => handleUpdateUser(editingUser.id, userData)}
          title="Edit User"
        />
      )}
    </div>
  );
};

const UserModal = ({ user, onClose, onSave, title }) => {
  const { user: currentUser } = useAuth();
  const [locations, setLocations] = useState([]);
  const [formData, setFormData] = useState({
    username: user?.username || '',
    email: user?.email || '',
    first_name: user?.first_name || '',
    last_name: user?.last_name || '',
    role: user?.role || 'waiter',
    location_id: user?.location_id || '',
    is_active: user?.is_active !== undefined ? user.is_active : true,
    password: ''
  });

  useEffect(() => {
    fetchLocations();
  }, []);

  const fetchLocations = async () => {
    try {
      const response = await api.get('/api/locations');
      setLocations(response.data.locations);
    } catch (error) {
      console.error('Failed to fetch locations:', error);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const submitData = { ...formData };
    if (!submitData.password) {
      delete submitData.password;
    }
    onSave(submitData);
  };

  const canEditUsername = currentUser?.role === 'admin' && user; // Only admin can edit existing usernames

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="h-5 w-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  First Name
                </label>
                <input
                  type="text"
                  required
                  value={formData.first_name}
                  onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                  className="input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Last Name
                </label>
                <input
                  type="text"
                  required
                  value={formData.last_name}
                  onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                  className="input"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Username
                {canEditUsername && (
                  <span className="text-xs text-purple-600 ml-1">(Admin can edit)</span>
                )}
              </label>
              <input
                type="text"
                required
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                className={`input ${canEditUsername ? 'border-purple-300 focus:border-purple-500' : ''}`}
                disabled={user && !canEditUsername}
                placeholder={user && !canEditUsername ? "Only admins can change usernames" : "Enter username"}
              />
              {canEditUsername && (
                <p className="text-xs text-purple-600 mt-1">
                  ⚠️ Changing username will require user to login with new credentials
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="input"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Password {user && '(leave blank to keep current)'}
              </label>
              <input
                type="password"
                required={!user}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="input"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Role
              </label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                className="input"
              >
                <option value="waiter">Waiter</option>
                <option value="manager">Manager</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Location
              </label>
              <select
                value={formData.location_id}
                onChange={(e) => setFormData({ ...formData, location_id: e.target.value })}
                className="input"
              >
                <option value="">Select a location</option>
                {locations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.display_name} ({location.price_multiplier}x)
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Determines which prices the user sees and uses for orders
              </p>
            </div>

            {user && (
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                />
                <label htmlFor="is_active" className="ml-2 block text-sm text-gray-900">
                  Active
                </label>
              </div>
            )}

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
                Save
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

const PrinterSettings = () => {
  const [printers, setPrinters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddPrinter, setShowAddPrinter] = useState(false);
  const [editingPrinter, setEditingPrinter] = useState(null);

  useEffect(() => {
    fetchPrinters();
  }, []);

  const fetchPrinters = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/printers/configs');
      setPrinters(response.data.printers);
    } catch (error) {
      console.error('Failed to fetch printers:', error);
      toast.error('Failed to load printers');
    } finally {
      setLoading(false);
    }
  };

  const handleTestPrinter = async (printerId) => {
    try {
      const response = await api.post(`/api/printers/test/${printerId}`);
      if (response.data.success) {
        toast.success('Test print sent successfully');
      } else {
        toast.error(response.data.message);
      }
    } catch (error) {
      toast.error('Failed to test printer');
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
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold text-gray-900">Printer Configuration</h2>
        <button
          onClick={() => setShowAddPrinter(true)}
          className="btn btn-primary"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Printer
        </button>
      </div>

      {/* Printers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {printers.map((printer) => (
          <div key={printer.id} className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className={`p-2 rounded-lg ${
                  printer.printer_type === 'kitchen' ? 'bg-orange-100 text-orange-600' :
                  printer.printer_type === 'bar' ? 'bg-blue-100 text-blue-600' :
                  'bg-green-100 text-green-600'
                }`}>
                  <Printer className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{printer.name}</h3>
                  <p className="text-sm text-gray-600 capitalize">{printer.printer_type}</p>
                </div>
              </div>
              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                printer.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
              }`}>
                {printer.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>

            <div className="space-y-2 mb-4">
              <p className="text-sm text-gray-600">
                <span className="font-medium">IP:</span> {printer.ip_address}
              </p>
              <p className="text-sm text-gray-600">
                <span className="font-medium">Port:</span> {printer.port}
              </p>
            </div>

            <div className="flex space-x-2">
              <button
                onClick={() => handleTestPrinter(printer.id)}
                className="btn btn-secondary btn-sm flex-1"
              >
                <Check className="h-4 w-4 mr-1" />
                Test
              </button>
              <button
                onClick={() => setEditingPrinter(printer)}
                className="btn btn-primary btn-sm flex-1"
              >
                <Edit className="h-4 w-4 mr-1" />
                Edit
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Add/Edit Printer Modals */}
      {showAddPrinter && (
        <PrinterModal
          onClose={() => setShowAddPrinter(false)}
          onSave={async (printerData) => {
            try {
              await api.post('/api/printers/configs', printerData);
              toast.success('Printer added successfully');
              setShowAddPrinter(false);
              fetchPrinters();
            } catch (error) {
              toast.error('Failed to add printer');
            }
          }}
          title="Add Printer"
        />
      )}

      {editingPrinter && (
        <PrinterModal
          printer={editingPrinter}
          onClose={() => setEditingPrinter(null)}
          onSave={async (printerData) => {
            try {
              await api.put(`/api/printers/configs/${editingPrinter.id}`, printerData);
              toast.success('Printer updated successfully');
              setEditingPrinter(null);
              fetchPrinters();
            } catch (error) {
              toast.error('Failed to update printer');
            }
          }}
          title="Edit Printer"
        />
      )}
    </div>
  );
};

const PrinterModal = ({ printer, onClose, onSave, title }) => {
  const [formData, setFormData] = useState({
    name: printer?.name || '',
    printer_type: printer?.printer_type || 'kitchen',
    ip_address: printer?.ip_address || '',
    port: printer?.port || 9100,
    is_active: printer?.is_active !== undefined ? printer.is_active : true
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="h-5 w-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Printer Name
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="input"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Printer Type
              </label>
              <select
                value={formData.printer_type}
                onChange={(e) => setFormData({ ...formData, printer_type: e.target.value })}
                className="input"
              >
                <option value="kitchen">Kitchen</option>
                <option value="bar">Bar</option>
                <option value="receipt">Receipt</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                IP Address
              </label>
              <input
                type="text"
                required
                value={formData.ip_address}
                onChange={(e) => setFormData({ ...formData, ip_address: e.target.value })}
                className="input"
                placeholder="192.168.1.100"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Port
              </label>
              <input
                type="number"
                required
                value={formData.port}
                onChange={(e) => setFormData({ ...formData, port: parseInt(e.target.value) })}
                className="input"
              />
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="printer_active"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
              />
              <label htmlFor="printer_active" className="ml-2 block text-sm text-gray-900">
                Active
              </label>
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
                Save
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

const LocationManagement = () => {
  const { user } = useAuth();
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddLocation, setShowAddLocation] = useState(false);
  const [editingLocation, setEditingLocation] = useState(null);

  useEffect(() => {
    fetchLocations();
  }, []);

  const fetchLocations = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/locations');
      setLocations(response.data.locations);
    } catch (error) {
      console.error('Failed to fetch locations:', error);
      toast.error('Failed to load locations');
    } finally {
      setLoading(false);
    }
  };

  const handleAddLocation = async (locationData) => {
    try {
      await api.post('/api/locations', locationData);
      toast.success('Location created successfully');
      setShowAddLocation(false);
      fetchLocations();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to create location');
    }
  };

  const handleUpdateLocation = async (locationId, locationData) => {
    try {
      await api.put(`/api/locations/${locationId}`, locationData);
      toast.success('Location updated successfully');
      setEditingLocation(null);
      fetchLocations();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to update location');
    }
  };

  const handleDeleteLocation = async (locationId) => {
    if (!window.confirm('Are you sure you want to delete this location?')) {
      return;
    }

    try {
      await api.delete(`/api/locations/${locationId}`);
      toast.success('Location deleted successfully');
      fetchLocations();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to delete location');
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
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Location Management</h2>
          <p className="text-sm text-gray-600">Manage restaurant locations and their pricing multipliers</p>
        </div>
        {user?.role === 'admin' && (
          <button
            onClick={() => setShowAddLocation(true)}
            className="btn btn-primary"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Location
          </button>
        )}
      </div>

      {/* Locations Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {locations.map((location) => (
          <div key={location.id} className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className={`p-2 rounded-lg ${
                  location.name === 'shop' ? 'bg-blue-100 text-blue-600' :
                  location.name === 'beach_bar' ? 'bg-orange-100 text-orange-600' :
                  'bg-green-100 text-green-600'
                }`}>
                  <MapPin className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{location.display_name}</h3>
                  <p className="text-sm text-gray-600">{location.name}</p>
                </div>
              </div>
              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                location.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
              }`}>
                {location.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>

            <div className="space-y-2 mb-4">
              <p className="text-sm text-gray-600">
                <span className="font-medium">Price Multiplier:</span> {location.price_multiplier}x
              </p>
              <p className="text-sm text-gray-600">
                <span className="font-medium">Users:</span> {location.user_count}
              </p>
              {location.description && (
                <p className="text-sm text-gray-500">{location.description}</p>
              )}
            </div>

            <div className="flex space-x-2">
              {user?.role === 'admin' && (
                <>
                  <button
                    onClick={() => setEditingLocation(location)}
                    className="btn btn-secondary btn-sm flex-1"
                  >
                    <Edit className="h-4 w-4 mr-1" />
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeleteLocation(location.id)}
                    className="btn btn-danger btn-sm"
                    disabled={location.user_count > 0}
                    title={location.user_count > 0 ? "Cannot delete location with assigned users" : "Delete location"}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Add Location Modal */}
      {showAddLocation && (
        <LocationModal
          onClose={() => setShowAddLocation(false)}
          onSave={handleAddLocation}
          title="Add New Location"
        />
      )}

      {/* Edit Location Modal */}
      {editingLocation && (
        <LocationModal
          location={editingLocation}
          onClose={() => setEditingLocation(null)}
          onSave={(locationData) => handleUpdateLocation(editingLocation.id, locationData)}
          title="Edit Location"
        />
      )}
    </div>
  );
};

const LocationModal = ({ location, onClose, onSave, title }) => {
  const [formData, setFormData] = useState({
    name: location?.name || '',
    display_name: location?.display_name || '',
    description: location?.description || '',
    price_multiplier: location?.price_multiplier || 1.000,
    is_active: location?.is_active !== undefined ? location.is_active : true
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="h-5 w-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Location Name (Internal)
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="input"
                placeholder="e.g., poolside_bar"
                disabled={!!location} // Don't allow changing name for existing locations
              />
              {location && (
                <p className="text-xs text-gray-500 mt-1">Location name cannot be changed</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Display Name
              </label>
              <input
                type="text"
                required
                value={formData.display_name}
                onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                className="input"
                placeholder="e.g., Poolside Bar"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="input"
                rows="3"
                placeholder="Brief description of this location"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Price Multiplier
              </label>
              <input
                type="number"
                step="0.001"
                min="0.1"
                max="5.0"
                required
                value={formData.price_multiplier}
                onChange={(e) => setFormData({ ...formData, price_multiplier: parseFloat(e.target.value) })}
                className="input"
                placeholder="1.000"
              />
              <p className="text-xs text-gray-500 mt-1">
                1.000 = base price, 1.200 = +20%, 0.900 = -10%
              </p>
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="location_active"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
              />
              <label htmlFor="location_active" className="ml-2 block text-sm text-gray-900">
                Active
              </label>
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
                Save
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

const SystemSettings = () => {
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-gray-900">System Settings</h2>
      
      <div className="card p-6">
        <div className="flex items-center space-x-3 mb-4">
          <AlertCircle className="h-5 w-5 text-warning-500" />
          <h3 className="font-semibold text-gray-900">System Information</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-600">Version</p>
            <p className="font-medium">alpha 1.0.0</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Database</p>
            <p className="font-medium">SQLite</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Environment</p>
            <p className="font-medium">Development</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Last Updated</p>
            <p className="font-medium">{new Date().toLocaleDateString()}</p>
          </div>
        </div>
      </div>

      <div className="card p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Quick Actions</h3>
        <div className="space-y-3">
          <button className="btn btn-secondary w-full justify-start">
            <Settings className="h-4 w-4 mr-2" />
            Export Database Backup
          </button>
          <button className="btn btn-secondary w-full justify-start">
            <Settings className="h-4 w-4 mr-2" />
            Clear Cache
          </button>
          <button className="btn btn-secondary w-full justify-start">
            <Settings className="h-4 w-4 mr-2" />
            View System Logs
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsView;