import React, { useState, useEffect } from 'react';
import { 
  Grid3X3, 
  Plus, 
  Edit, 
  Trash2, 
  Save, 
  X, 
  MapPin,
  Users,
  Move,
  Eye,
  EyeOff
} from 'lucide-react';
import api from '../config/api';
import toast from 'react-hot-toast';
import LoadingSpinner from './LoadingSpinner';

const TablesManagement = () => {
  const [tables, setTables] = useState([]);
  const [locations, setLocations] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState('');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingTable, setEditingTable] = useState(null);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'floorplan'
  const [formData, setFormData] = useState({
    table_number: '',
    location_id: '',
    capacity: 2,
    x_position: 0,
    y_position: 0,
    is_active: true
  });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (selectedLocation) {
      loadTables();
    }
  }, [selectedLocation]);

  const loadData = async () => {
    try {
      const [tablesResponse, locationsResponse] = await Promise.all([
        api.get('/api/admin/tables'),
        api.get('/api/admin/locations')
      ]);
      setTables(tablesResponse.data.tables);
      setLocations(locationsResponse.data.locations);
      
      // Set first location as default
      if (locationsResponse.data.locations.length > 0) {
        setSelectedLocation(locationsResponse.data.locations[0].id.toString());
      }
    } catch (error) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const loadTables = async () => {
    try {
      const response = await api.get(`/api/admin/tables?location_id=${selectedLocation}`);
      setTables(response.data.tables);
    } catch (error) {
      toast.error('Failed to load tables');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingTable) {
        await api.put(`/api/admin/tables/${editingTable.id}`, formData);
        toast.success('Table updated successfully');
      } else {
        await api.post('/api/admin/tables', formData);
        toast.success('Table created successfully');
      }
      setShowForm(false);
      setEditingTable(null);
      resetForm();
      loadTables();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to save table');
    }
  };

  const handleEdit = (table) => {
    setEditingTable(table);
    setFormData({
      table_number: table.table_number,
      location_id: table.location_id,
      capacity: table.capacity,
      x_position: table.x_position,
      y_position: table.y_position,
      is_active: table.is_active
    });
    setShowForm(true);
  };

  const handleDelete = async (tableId) => {
    if (window.confirm('Are you sure you want to delete this table?')) {
      try {
        await api.delete(`/api/admin/tables/${tableId}`);
        toast.success('Table deleted successfully');
        loadTables();
      } catch (error) {
        toast.error('Failed to delete table');
      }
    }
  };

  const handlePositionUpdate = async (tableId, x, y) => {
    try {
      await api.put(`/api/admin/tables/${tableId}/position`, {
        x_position: x,
        y_position: y
      });
      loadTables();
    } catch (error) {
      toast.error('Failed to update table position');
    }
  };

  const resetForm = () => {
    setFormData({
      table_number: '',
      location_id: selectedLocation,
      capacity: 2,
      x_position: 0,
      y_position: 0,
      is_active: true
    });
  };

  const getStatusColor = (status) => {
    const colors = {
      available: 'bg-green-100 text-green-700 border-green-200',
      occupied: 'bg-red-100 text-red-700 border-red-200',
      reserved: 'bg-yellow-100 text-yellow-700 border-yellow-200',
      cleaning: 'bg-blue-100 text-blue-700 border-blue-200'
    };
    return colors[status] || 'bg-gray-100 text-gray-700 border-gray-200';
  };

  const generateTableNumber = () => {
    const location = locations.find(l => l.id.toString() === selectedLocation);
    if (!location) return '';
    
    const prefix = location.code === 'SHOP' ? 'S' : 'B';
    const existingNumbers = tables
      .filter(t => t.table_number.startsWith(prefix))
      .map(t => parseInt(t.table_number.substring(1)))
      .filter(n => !isNaN(n));
    
    const nextNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 1;
    return `${prefix}${nextNumber.toString().padStart(2, '0')}`;
  };

  if (loading) return <LoadingSpinner />;

  const filteredTables = tables.filter(table => 
    selectedLocation ? table.location_id.toString() === selectedLocation : true
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Tables Management</h2>
          <p className="text-sm text-gray-600">Manage tables, seating capacity, and floor plan layout</p>
        </div>
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-lg ${viewMode === 'grid' ? 'bg-primary-100 text-primary-600' : 'bg-gray-100 text-gray-600'}`}
            >
              <Grid3X3 className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode('floorplan')}
              className={`p-2 rounded-lg ${viewMode === 'floorplan' ? 'bg-primary-100 text-primary-600' : 'bg-gray-100 text-gray-600'}`}
            >
              <MapPin className="h-4 w-4" />
            </button>
          </div>
          <button
            onClick={() => {
              resetForm();
              setFormData(prev => ({ ...prev, table_number: generateTableNumber() }));
              setEditingTable(null);
              setShowForm(true);
            }}
            className="btn btn-primary"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Table
          </button>
        </div>
      </div>

      {/* Location Filter */}
      <div className="flex items-center space-x-4">
        <label className="text-sm font-medium text-gray-700">Location:</label>
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
        <div className="text-sm text-gray-500">
          {filteredTables.length} tables
        </div>
      </div>

      {/* Tables Display */}
      {viewMode === 'grid' ? (
        <GridView 
          tables={filteredTables} 
          onEdit={handleEdit} 
          onDelete={handleDelete}
          getStatusColor={getStatusColor}
        />
      ) : (
        <FloorPlanView 
          tables={filteredTables} 
          onEdit={handleEdit} 
          onPositionUpdate={handlePositionUpdate}
          getStatusColor={getStatusColor}
        />
      )}

      {/* Table Form Modal */}
      {showForm && (
        <TableFormModal
          formData={formData}
          setFormData={setFormData}
          locations={locations}
          editingTable={editingTable}
          onSubmit={handleSubmit}
          onClose={() => setShowForm(false)}
        />
      )}
    </div>
  );
};

// Grid View Component
const GridView = ({ tables, onEdit, onDelete, getStatusColor }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {tables.map((table) => (
        <div key={table.id} className="card p-4">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h3 className="font-semibold text-gray-900">{table.table_number}</h3>
              <p className="text-sm text-gray-500">{table.location?.name}</p>
            </div>
            <div className="flex space-x-1">
              <button
                onClick={() => onEdit(table)}
                className="p-1 text-gray-400 hover:text-gray-600"
              >
                <Edit className="h-4 w-4" />
              </button>
              <button
                onClick={() => onDelete(table.id)}
                className="p-1 text-gray-400 hover:text-red-600"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Capacity:</span>
              <div className="flex items-center space-x-1">
                <Users className="h-4 w-4 text-gray-400" />
                <span className="text-sm font-medium">{table.capacity}</span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Status:</span>
              <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getStatusColor(table.status)}`}>
                {table.status}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Position:</span>
              <span className="text-xs text-gray-500">
                ({table.x_position}, {table.y_position})
              </span>
            </div>

            {!table.is_active && (
              <div className="mt-2">
                <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs">
                  Inactive
                </span>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

// Floor Plan View Component
const FloorPlanView = ({ tables, onEdit, onPositionUpdate, getStatusColor }) => {
  const [draggedTable, setDraggedTable] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const handleMouseDown = (e, table) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setDraggedTable(table);
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    });
  };

  const handleMouseMove = (e) => {
    if (!draggedTable) return;
    
    const container = e.currentTarget;
    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left - dragOffset.x;
    const y = e.clientY - rect.top - dragOffset.y;
    
    // Update position visually
    const tableElement = container.querySelector(`[data-table-id="${draggedTable.id}"]`);
    if (tableElement) {
      tableElement.style.left = `${Math.max(0, Math.min(x, container.clientWidth - 80))}px`;
      tableElement.style.top = `${Math.max(0, Math.min(y, container.clientHeight - 80))}px`;
    }
  };

  const handleMouseUp = (e) => {
    if (!draggedTable) return;
    
    const container = e.currentTarget;
    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left - dragOffset.x;
    const y = e.clientY - rect.top - dragOffset.y;
    
    const boundedX = Math.max(0, Math.min(x, container.clientWidth - 80));
    const boundedY = Math.max(0, Math.min(y, container.clientHeight - 80));
    
    onPositionUpdate(draggedTable.id, boundedX, boundedY);
    setDraggedTable(null);
  };

  return (
    <div className="card p-6">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Floor Plan</h3>
        <p className="text-sm text-gray-600">Drag tables to reposition them</p>
      </div>
      
      <div 
        className="relative bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg"
        style={{ height: '600px', minHeight: '400px' }}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {tables.map((table) => (
          <div
            key={table.id}
            data-table-id={table.id}
            className={`absolute w-20 h-20 rounded-lg border-2 cursor-move flex flex-col items-center justify-center text-xs font-medium transition-all hover:shadow-lg ${getStatusColor(table.status)}`}
            style={{
              left: `${table.x_position}px`,
              top: `${table.y_position}px`
            }}
            onMouseDown={(e) => handleMouseDown(e, table)}
            onDoubleClick={() => onEdit(table)}
            title={`${table.table_number} - Capacity: ${table.capacity} - Double-click to edit`}
          >
            <div className="font-semibold">{table.table_number}</div>
            <div className="flex items-center space-x-1">
              <Users className="h-3 w-3" />
              <span>{table.capacity}</span>
            </div>
          </div>
        ))}
        
        {tables.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-gray-500">
            <div className="text-center">
              <Grid3X3 className="h-12 w-12 mx-auto mb-2 text-gray-300" />
              <p>No tables in this location</p>
              <p className="text-sm">Add tables to see them on the floor plan</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Table Form Modal Component
const TableFormModal = ({ formData, setFormData, locations, editingTable, onSubmit, onClose }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
        <form onSubmit={onSubmit} className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">
              {editingTable ? 'Edit Table' : 'Add New Table'}
            </h3>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Table Number
              </label>
              <input
                type="text"
                value={formData.table_number}
                onChange={(e) => setFormData({ ...formData, table_number: e.target.value })}
                className="input"
                placeholder="e.g., S01, B01"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Location
              </label>
              <select
                value={formData.location_id}
                onChange={(e) => setFormData({ ...formData, location_id: e.target.value })}
                className="input"
                required
              >
                <option value="">Select Location</option>
                {locations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Seating Capacity
              </label>
              <input
                type="number"
                min="1"
                max="20"
                value={formData.capacity}
                onChange={(e) => setFormData({ ...formData, capacity: parseInt(e.target.value) })}
                className="input"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  X Position
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.x_position}
                  onChange={(e) => setFormData({ ...formData, x_position: parseInt(e.target.value) })}
                  className="input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Y Position
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.y_position}
                  onChange={(e) => setFormData({ ...formData, y_position: parseInt(e.target.value) })}
                  className="input"
                />
              </div>
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
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary"
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              <Save className="h-4 w-4 mr-2" />
              {editingTable ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TablesManagement;