import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../config/api';
import toast from 'react-hot-toast';
import { socket } from '../utils/socket';

const OrderContext = createContext();

export const useOrder = () => {
  const context = useContext(OrderContext);
  if (!context) {
    throw new Error('useOrder must be used within an OrderProvider');
  }
  return context;
};

export const OrderProvider = ({ children }) => {
  const [currentOrder, setCurrentOrder] = useState(null);
  const [orderItems, setOrderItems] = useState([]);
  const [selectedTable, setSelectedTable] = useState(null);
    const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);

  // Socket event listeners
  useEffect(() => {
    const handleNewOrder = (data) => {
      toast.success(`New order received: ${data.order_number}`);
      fetchOrders();
    };

    const handleOrderStatusChanged = (data) => {
      toast.success(`Order ${data.order_number} status changed to ${data.new_status}`);
      fetchOrders();
    };

    socket.on('new_order', handleNewOrder);
    socket.on('order_status_changed', handleOrderStatusChanged);

    return () => {
      socket.off('new_order', handleNewOrder);
      socket.off('order_status_changed', handleOrderStatusChanged);
    };
  }, []);

  const fetchOrders = async (filters = {}) => {
    try {
      setLoading(true);
      const params = new URLSearchParams(filters);
      const response = await api.get(`/api/orders/?${params}`);
      setOrders(response.data.orders);
    } catch (error) {
      console.error('Failed to fetch orders:', error);
      toast.error('Failed to fetch orders');
    } finally {
      setLoading(false);
    }
  };

  const startNewOrder = (table) => {
    setSelectedTable(table);
    setCurrentOrder(null);
    setOrderItems([]);
  };

  const addItemToOrder = (menuItem, quantity = 1, specialInstructions = '') => {
    const existingItemIndex = orderItems.findIndex(
      item => item.menu_item_id === menuItem.id && item.special_instructions === specialInstructions
    );

    if (existingItemIndex >= 0) {
      // Update existing item quantity
      const updatedItems = [...orderItems];
      updatedItems[existingItemIndex].quantity += quantity;
      setOrderItems(updatedItems);
    } else {
      // Add new item
      const newItem = {
        menu_item_id: menuItem.id,
        menu_item: menuItem,
        quantity,
        special_instructions: specialInstructions,
        unit_price: menuItem.price,
        total_price: menuItem.price * quantity
      };
      setOrderItems([...orderItems, newItem]);
    }

    toast.success(`Added ${menuItem.name} to order`);
  };

  const removeItemFromOrder = (index) => {
    const item = orderItems[index];
    const updatedItems = orderItems.filter((_, i) => i !== index);
    setOrderItems(updatedItems);
    toast.success(`Removed ${item.menu_item.name} from order`);
  };

  const updateItemQuantity = (index, newQuantity) => {
    if (newQuantity <= 0) {
      removeItemFromOrder(index);
      return;
    }

    const updatedItems = [...orderItems];
    updatedItems[index].quantity = newQuantity;
    updatedItems[index].total_price = updatedItems[index].unit_price * newQuantity;
    setOrderItems(updatedItems);
  };

  const updateItemInstructions = (index, instructions) => {
    const updatedItems = [...orderItems];
    updatedItems[index].special_instructions = instructions;
    setOrderItems(updatedItems);
  };

  const calculateOrderTotal = () => {
    return orderItems.reduce((total, item) => total + item.total_price, 0);
  };

  const submitOrder = async (notes = '', discountAmount = 0) => {
    if (!selectedTable) {
      toast.error('Please select a table');
      return { success: false };
    }

    if (orderItems.length === 0) {
      toast.error('Please add items to the order');
      return { success: false };
    }

    try {
      setLoading(true);
      const orderData = {
        table_id: selectedTable.id,
        items: orderItems.map(item => ({
          menu_item_id: item.menu_item_id,
          quantity: item.quantity,
          special_instructions: item.special_instructions
        })),
        notes,
        discount_amount: discountAmount
      };

      const response = await api.post('/api/orders/', orderData);
      
      // Emit real-time update
      if (socket) {
        socket.emit('new_order', response.data.order);
      }

      // Print order automatically
      await printOrder(response.data.order.id);

      // Clear current order
      setCurrentOrder(null);
      setOrderItems([]);
      setSelectedTable(null);

      toast.success(`Order ${response.data.order.order_number} submitted successfully!`);
      return { success: true, order: response.data.order };
    } catch (error) {
      const message = error.response?.data?.error || 'Failed to submit order';
      toast.error(message);
      return { success: false, error: message };
    } finally {
      setLoading(false);
    }
  };

  const updateOrderStatus = async (orderId, newStatus) => {
    try {
      await api.put(`/api/orders/${orderId}/status`, {
        status: newStatus
      });

      // Emit real-time update
      if (socket) {
        socket.emit('order_status_update', {
          order_id: orderId,
          status: newStatus
        });
      }

      toast.success(`Order status updated to ${newStatus}`);
      fetchOrders(); // Refresh orders list
      return { success: true };
    } catch (error) {
      const message = error.response?.data?.error || 'Failed to update order status';
      toast.error(message);
      return { success: false, error: message };
    }
  };

  const printOrder = async (orderId, printerType = 'all') => {
    try {
      const response = await api.post(`/api/printers/print-order/${orderId}`, {
        printer_type: printerType
      });

      const successfulPrints = response.data.results.filter(r => r.success);
      if (successfulPrints.length > 0) {
        toast.success(`Order sent to ${successfulPrints.length} printer(s)`);
      } else {
        toast.error('Failed to send order to printers');
      }

      return { success: successfulPrints.length > 0 };
    } catch (error) {
      const message = error.response?.data?.error || 'Failed to print order';
      toast.error(message);
      return { success: false, error: message };
    }
  };

  const loadExistingOrder = async (orderId) => {
    try {
      setLoading(true);
      const response = await api.get(`/api/orders/${orderId}`);
      const order = response.data.order;
      
      setCurrentOrder(order);
      setSelectedTable(order.table);
      setOrderItems(order.items.map(item => ({
        menu_item_id: item.menu_item.id,
        menu_item: item.menu_item,
        quantity: item.quantity,
        special_instructions: item.special_instructions,
        unit_price: item.unit_price,
        total_price: item.total_price
      })));

      return { success: true, order };
    } catch (error) {
      const message = error.response?.data?.error || 'Failed to load order';
      toast.error(message);
      return { success: false, error: message };
    } finally {
      setLoading(false);
    }
  };

  const clearOrder = () => {
    setCurrentOrder(null);
    setOrderItems([]);
    setSelectedTable(null);
  };

  const value = {
    currentOrder,
    orderItems,
    selectedTable,
    orders,
    loading,
    socket,
    
    // Actions
    fetchOrders,
    startNewOrder,
    addItemToOrder,
    removeItemFromOrder,
    updateItemQuantity,
    updateItemInstructions,
    calculateOrderTotal,
    submitOrder,
    updateOrderStatus,
    printOrder,
    loadExistingOrder,
    clearOrder,
    
    // Computed values
    orderTotal: calculateOrderTotal(),
    hasItems: orderItems.length > 0,
    itemCount: orderItems.reduce((count, item) => count + item.quantity, 0)
  };

  return (
    <OrderContext.Provider value={value}>
      {children}
    </OrderContext.Provider>
  );
};