from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from flask_socketio import emit
from models import Order, OrderItem, MenuItem, Table, User, Location, db
from datetime import datetime, timedelta
from sqlalchemy import and_, or_, func
from decimal import Decimal
import json
import uuid
import traceback

orders_bp = Blueprint('orders', __name__)

# Optional imports with graceful fallbacks
try:
    from flask_limiter import Limiter
    from flask_limiter.util import get_remote_address
    LIMITER_AVAILABLE = True
except ImportError:
    LIMITER_AVAILABLE = False

try:
    from flask_caching import Cache
    CACHE_AVAILABLE = True
except ImportError:
    CACHE_AVAILABLE = False

try:
    from utils import generate_order_number
    UTILS_AVAILABLE = True
except ImportError:
    UTILS_AVAILABLE = False
    # Fallback function for order number generation
    def generate_order_number():
        """Generate a unique order number"""
        timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
        random_suffix = str(uuid.uuid4())[:4].upper()
        return f"ORD-{timestamp}-{random_suffix}"

# Initialize extensions if available
if LIMITER_AVAILABLE:
    limiter = Limiter(key_func=get_remote_address)
else:
    class DummyLimiter:
        def limit(self, limit_string):
            def decorator(f):
                return f
            return decorator
    limiter = DummyLimiter()

if CACHE_AVAILABLE:
    cache = Cache()
else:
    class DummyCache:
        def cached(self, timeout=None):
            def decorator(f):
                return f
            return decorator
    cache = DummyCache()

def emit_socketio_event(event_name, data, room=None):
    """Helper function to safely emit socketio events"""
    try:
        from app import socketio
        socketio.emit(event_name, data, room=room)
    except ImportError:
        current_app.logger.warning(f"SocketIO not available for event: {event_name}")
    except Exception as e:
        current_app.logger.error(f"SocketIO emit failed for {event_name}: {e}")

@orders_bp.route('', methods=['GET'])
@orders_bp.route('/', methods=['GET'])
@jwt_required()
def get_orders():
    try:
        current_user_id = get_jwt_identity()
        current_user = User.query.get(current_user_id)
        
        # Get query parameters
        table_id = request.args.get('table_id')
        status = request.args.get('status')
        date_from = request.args.get('date_from')
        date_to = request.args.get('date_to')
        takeaway = request.args.get('takeaway')  # Filter for takeaway orders
        order_type = request.args.get('order_type')
        
        # Build query
        query = Order.query
        
        # Filter by waiter for non-admin/manager users
        if current_user.role == 'waiter':
            query = query.filter_by(user_id=current_user_id)
        
        if table_id:
            query = query.filter_by(table_id=table_id)
        
        if status:
            query = query.filter_by(status=status)
        
        if takeaway == 'true':
            query = query.filter(Order.table_id.is_(None))  # Takeaway orders have no table
        elif takeaway == 'false':
            query = query.filter(Order.table_id.isnot(None))  # Dine-in orders have a table
        
        if order_type:
            query = query.filter_by(order_type=order_type)
        
        if date_from:
            query = query.filter(Order.created_at >= datetime.fromisoformat(date_from))
        
        if date_to:
            query = query.filter(Order.created_at <= datetime.fromisoformat(date_to))
        
        orders = query.order_by(Order.created_at.desc()).all()
        orders_data = []
        
        for order in orders:
            order_items = []
            for item in order.items:
                order_items.append({
                    'id': item.id,
                    'menu_item': {
                        'id': item.menu_item.id,
                        'name': item.menu_item.name,
                        'category': item.menu_item.category.name,
                        'printer_destination': item.menu_item.category.printer_destination
                    },
                    'quantity': item.quantity,
                    'unit_price': float(item.unit_price),
                    'total_price': float(item.total_price),
                    'special_instructions': item.special_instructions,
                    'status': item.status
                })
            
            order_data = {
                'id': order.id,
                'order_number': order.order_number,
                'waiter': {
                    'id': order.waiter.id,
                    'name': f"{order.waiter.first_name} {order.waiter.last_name}"
                },
                'status': order.status,
                'order_type': order.order_type or 'dine_in',
                'total_amount': float(order.total_amount),
                'tax_amount': float(order.tax_amount),
                'discount_amount': float(order.discount_amount),
                'notes': order.notes,
                'items': order_items,
                'created_at': order.created_at.isoformat(),
                'updated_at': order.updated_at.isoformat()
            }
            
            # Add table info for dine-in orders
            if order.table:
                order_data['table'] = {
                    'id': order.table.id if order.table else None,
                    'table_number': order.table.table_number if order.table else None
                }
            else:
                order_data['table'] = None
            
            # Add customer info for takeaway orders
            if order.order_type in ['takeaway', 'delivery']:
                order_data['customer_name'] = order.customer_name
                order_data['estimated_ready_time'] = order.estimated_ready_time.isoformat() if order.estimated_ready_time else None
            
            orders_data.append(order_data)
        
        return jsonify({'orders': orders_data}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@orders_bp.route('', methods=['POST'])
@orders_bp.route('/', methods=['POST'])
@jwt_required()
def create_order():
    try:
        ident = get_jwt_identity()
        try:
            # JWT identity may be a stringified int; coerce when possible
            current_user_id = int(ident)
        except Exception:
            current_user_id = ident
        data = request.get_json()
        
        # Debug: Print incoming request data
        print(f"\n🔍 DEBUG: Creating order for user {current_user_id}")
        print(f"📝 Request data: {data}")
        
        # Validate required fields
        if not data.get('items') or len(data['items']) == 0:
            print("❌ ERROR: No items provided")
            return jsonify({'error': 'Order items are required'}), 400
        
        # Determine order type
        order_type = data.get('order_type', 'dine_in')
        
        # Fetch current user
        current_user = User.query.get(current_user_id)
        if not current_user:
            current_app.logger.warning(f"create_order: JWT identity {current_user_id} did not match any user")
            return jsonify({'error': 'User not found'}), 401
        
        # Validate and determine location
        location_id = data.get('location_id')
        if location_id:
            location = Location.query.get(location_id)
            if not location:
                return jsonify({'error': 'Invalid location ID'}), 400
            location_name = location.name
            actual_location_id = location_id
        else:
            # For dine-in, use user's location. For takeaway/delivery, use default shop location
            if current_user and current_user.user_location and order_type == 'dine_in':
                location_name = current_user.user_location.name
                actual_location_id = current_user.location_id
            else:
                location_name = 'shop'
                actual_location_id = 1  # Default to main location
        
        table_id = data.get('table_id')
        
        # For dine-in orders, table_id is required
        if order_type == 'dine_in' and not table_id:
            return jsonify({'error': 'Table ID is required for dine-in orders'}), 400
        
        # For takeaway/delivery orders, customer info is optional now
        if order_type in ['takeaway', 'delivery']:
            table_id = None  # Takeaway orders don't have a table
            print(f"🥡 Takeaway order - Customer: {data.get('customer_name', 'Anonymous')}")
        
        # Verify table exists for dine-in orders
        table = None
        if table_id:
            table = Table.query.get(table_id)
            if not table:
                return jsonify({'error': 'Table not found'}), 404
        
        # Calculate estimated ready time for takeaway orders
        estimated_ready_time = None
        if order_type in ['takeaway', 'delivery']:
            # Add 30 minutes to current time as default
            from datetime import timedelta
            estimated_ready_time = datetime.utcnow() + timedelta(minutes=30)
            
            # Set default customer name if empty
            customer_name = data.get('customer_name') or 'Guest'
            customer_address = data.get('customer_address', '')
        else:
            customer_name = None
            customer_address = None
        
        # Create new order
        new_order = Order(
            order_number=generate_order_number(),
            table_id=table_id,
            user_id=current_user_id,
            order_type=order_type,
            status='pending',
            location_id=actual_location_id,  # Using validated location_id
            notes=data.get('notes', ''),
            customer_name=customer_name,
            estimated_ready_time=estimated_ready_time
        )
        
        db.session.add(new_order)
        db.session.flush()  # Get the order ID
        
        total_amount = 0
        
        # Add order items
        print(f"📦 Processing {len(data['items'])} items...")
        for i, item_data in enumerate(data['items']):
            print(f"  Item {i+1}: {item_data}")
            
            if not item_data.get('menu_item_id') or not item_data.get('quantity'):
                print(f"❌ ERROR: Missing menu_item_id or quantity in item {i+1}")
                return jsonify({'error': 'Menu item ID and quantity are required for all items'}), 400
            
            menu_item = MenuItem.query.get(item_data['menu_item_id'])
            if not menu_item:
                print(f"❌ ERROR: Menu item {item_data['menu_item_id']} not found")
                return jsonify({'error': f'Menu item {item_data["menu_item_id"]} not found'}), 404
            
            print(f"  ✅ Found menu item: {menu_item.name} (€{menu_item.price})")
            
            # Check availability based on order type
            if order_type == 'takeaway':
                # For takeaway: item must be available for takeaway OR be takeaway-only
                if not (menu_item.is_available_takeaway or menu_item.is_takeaway_only):
                    print(f"❌ ERROR: Menu item {menu_item.name} is not available for takeaway")
                    return jsonify({'error': f'Menu item {menu_item.name} is not available for takeaway'}), 400
            else:
                # For dine-in: item must be available and NOT takeaway-only
                if not menu_item.is_available or menu_item.is_takeaway_only:
                    print(f"❌ ERROR: Menu item {menu_item.name} is not available for dine-in")
                    return jsonify({'error': f'Menu item {menu_item.name} is not available for dine-in'}), 400
            
            quantity = int(item_data['quantity'])
            
            # Determine the correct price based on order type and location
            if order_type == 'takeaway':
                # Use takeaway price if available, otherwise regular price
                unit_price = float(menu_item.takeaway_price or menu_item.price)
                print(f"  🥡 Using takeaway price: €{unit_price}")
            elif location_name == 'beach_bar':
                # Use beach bar price if available, otherwise regular price
                unit_price = float(menu_item.beach_bar_price or menu_item.price)
                print(f"  🏖️  Using beach bar price: €{unit_price}")
            else:
                # Use regular shop price
                unit_price = float(menu_item.price)
                print(f"  🏪 Using shop price: €{unit_price}")
            
            # Allow manual price override if provided
            if item_data.get('unit_price'):
                unit_price = float(item_data['unit_price'])
                print(f"  💰 Manual price override: €{unit_price}")
            
            total_price = unit_price * quantity
            
            print(f"  💰 Price calculation: {quantity} x €{unit_price} = €{total_price}")
            
            order_item = OrderItem(
                order_id=new_order.id,
                menu_item_id=menu_item.id,
                quantity=quantity,
                unit_price=unit_price,
                total_price=total_price,
                special_instructions=item_data.get('special_instructions', '')
            )
            
            db.session.add(order_item)
            total_amount += total_price
            print(f"  ✅ Added item to order. Running total: €{total_amount}")
        
        # Calculate tax (assuming 10% tax rate)
        tax_rate = 0.10
        tax_amount = total_amount * tax_rate
        
        # Apply discount if provided
        discount_amount = float(data.get('discount_amount', 0))
        
        # Update order totals
        new_order.subtotal = total_amount  # Set the subtotal first
        new_order.total_amount = total_amount
        new_order.tax_amount = tax_amount
        new_order.discount_amount = discount_amount

        # If the Order model has a customer_address column, set it (backwards-compatible)
        try:
            if hasattr(new_order, 'customer_address'):
                new_order.customer_address = customer_address
        except Exception:
            # Defensive: ignore if attribute cannot be set
            current_app.logger.debug('Could not set customer_address on Order (attribute missing or read-only)')
        
        # Double check we don't use client-provided total_amount
        if 'total_amount' in data:
            del data['total_amount']
            
        db.session.commit()
        
        # Virtual Environment: Simulate printer output
        print("\n" + "="*50)
        print("🖨️  VIRTUAL PRINTER SIMULATION")
        print("="*50)
        
        # Simulate Kitchen Printer
        kitchen_items = [item for item in new_order.items 
                        if hasattr(item.menu_item, 'category') and 
                        hasattr(item.menu_item.category, 'printer_destination') and
                        item.menu_item.category.printer_destination == 'kitchen']
        
        if kitchen_items:
            print("\n🍳 KITCHEN PRINTER OUTPUT:")
            print("-" * 32)
            print(f"KITCHEN ORDER")
            print(f"Order: {new_order.order_number}")
            if table:
                print(f"Table: {table.table_number}")
            else:
                print(f"TAKEAWAY ORDER")
                if new_order.customer_name:
                    print(f"Customer: {new_order.customer_name}")
            print(f"Waiter: {new_order.waiter.first_name} {new_order.waiter.last_name}")
            print(f"Time: {new_order.created_at.strftime('%H:%M:%S')}")
            print("-" * 32)
            
            for item in kitchen_items:
                print(f"{item.quantity}x {item.menu_item.name}")
                if item.special_instructions:
                    print(f"   Note: {item.special_instructions}")
            
            print("-" * 32)
            print(f"Total Kitchen Items: {len(kitchen_items)}")
            print("-" * 32)
        
        # Simulate Bar Printer
        bar_items = [item for item in new_order.items 
                    if hasattr(item.menu_item, 'category') and 
                    hasattr(item.menu_item.category, 'printer_destination') and
                    item.menu_item.category.printer_destination == 'bar']
        
        if bar_items:
            print("\n🍺 BAR PRINTER OUTPUT:")
            print("-" * 32)
            print(f"BAR ORDER")
            print(f"Order: {new_order.order_number}")
            if table:
                print(f"Table: {table.table_number}")
            else:
                print(f"TAKEAWAY ORDER")
                if new_order.customer_name:
                    print(f"Customer: {new_order.customer_name}")
            print(f"Waiter: {new_order.waiter.first_name} {new_order.waiter.last_name}")
            print(f"Time: {new_order.created_at.strftime('%H:%M:%S')}")
            print("-" * 32)
            
            for item in bar_items:
                print(f"{item.quantity}x {item.menu_item.name}")
                if item.special_instructions:
                    print(f"   Note: {item.special_instructions}")
            
            print("-" * 32)
            print(f"Total Bar Items: {len(bar_items)}")
            print("-" * 32)
        
        # Simulate Receipt Printer
        print("\n🧾 RECEIPT PRINTER OUTPUT:")
        print("-" * 32)
        print(f"RESTAURANT RECEIPT")
        print(f"Order: {new_order.order_number}")
        if table:
            print(f"Table: {table.table_number}")
        else:
            print(f"TAKEAWAY ORDER")
            if new_order.customer_name:
                print(f"Customer: {new_order.customer_name}")
        print(f"Waiter: {new_order.waiter.first_name} {new_order.waiter.last_name}")
        print(f"Date: {new_order.created_at.strftime('%Y-%m-%d %H:%M:%S')}")
        print("-" * 32)
        
        for item in new_order.items:
            print(f"{item.quantity}x {item.menu_item.name}")
            print(f"   €{float(item.unit_price):.2f} each")
            print(f"   Subtotal: €{float(item.total_price):.2f}")
            if item.special_instructions:
                print(f"   Note: {item.special_instructions}")
        
        print("-" * 32)
        print(f"Subtotal: €{float(new_order.total_amount):.2f}")
        print(f"Tax: €{float(new_order.tax_amount):.2f}")
        if new_order.discount_amount > 0:
            print(f"Discount: -€{float(new_order.discount_amount):.2f}")
        
        final_total = float(new_order.total_amount) + float(new_order.tax_amount) - float(new_order.discount_amount)
        print(f"TOTAL: €{final_total:.2f}")
        print("-" * 32)
        print("Thank you for dining with us!")
        print("-" * 32)
        
        print("\n✅ Order created and printed successfully!")
        print("="*50)
        
        # Emit real-time update
        emit_socketio_event('new_order', {
            'order_id': new_order.id,
            'order_number': new_order.order_number,
            'table_number': table.table_number if table else None,
            'waiter_name': f"{new_order.waiter.first_name} {new_order.waiter.last_name}",
            'total_amount': float(new_order.total_amount)
        }, room='restaurant')
        
        return jsonify({
            'message': 'Order created successfully',
            'order': {
                'id': new_order.id,
                'order_number': new_order.order_number,
                'table_number': table.table_number if table else None,
                'total_amount': float(new_order.total_amount),
                'tax_amount': float(new_order.tax_amount),
                'status': new_order.status
            }
        }), 201
        
    except Exception as e:
        # Log full traceback for easier debugging without exposing internals to clients
        current_app.logger.exception("Order creation failed")
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@orders_bp.route('/<int:order_id>', methods=['GET'])
@jwt_required()
def get_order(order_id):
    try:
        current_user_id = get_jwt_identity()
        current_user = User.query.get(current_user_id)
        
        order = Order.query.get(order_id)
        if not order:
            return jsonify({'error': 'Order not found'}), 404
        
        # Check permissions
        if current_user.role == 'waiter' and order.user_id != current_user_id:
            return jsonify({'error': 'Insufficient permissions'}), 403
        
        order_items = []
        for item in order.items:
            order_items.append({
                'id': item.id,
                'menu_item': {
                    'id': item.menu_item.id,
                    'name': item.menu_item.name,
                    'category': item.menu_item.category.name,
                    'printer_destination': item.menu_item.category.printer_destination
                },
                'quantity': item.quantity,
                'unit_price': float(item.unit_price),
                'total_price': float(item.total_price),
                'special_instructions': item.special_instructions,
                'status': item.status
            })
        
        order_data = {
            'id': order.id,
            'order_number': order.order_number,
            'table': {
                'id': order.table.id if order.table else None,
                'table_number': order.table.table_number if order.table else None
            },
            'waiter': {
                'id': order.waiter.id,
                'name': f"{order.waiter.first_name} {order.waiter.last_name}"
            },
            'status': order.status,
            'total_amount': float(order.total_amount),
            'tax_amount': float(order.tax_amount),
            'discount_amount': float(order.discount_amount),
            'notes': order.notes,
            'items': order_items,
            'created_at': order.created_at.isoformat(),
            'updated_at': order.updated_at.isoformat()
        }
        
        return jsonify({'order': order_data}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@orders_bp.route('/<int:order_id>/status', methods=['PUT'])
@jwt_required()
def update_order_status(order_id):
    try:
        current_user_id = get_jwt_identity()
        current_user = User.query.get(current_user_id)
        
        order = Order.query.get(order_id)
        if not order:
            return jsonify({'error': 'Order not found'}), 404
        
        # Check permissions
        if current_user.role == 'waiter' and order.user_id != current_user_id:
            return jsonify({'error': 'Insufficient permissions'}), 403
        
        data = request.get_json()
        if not data.get('status'):
            return jsonify({'error': 'Status is required'}), 400
        
        valid_statuses = ['pending', 'confirmed', 'preparing', 'ready', 'served', 'cancelled']
        if data['status'] not in valid_statuses:
            return jsonify({'error': 'Invalid status'}), 400
        
        old_status = order.status
        order.status = data['status']
        order.updated_at = datetime.utcnow()
        
        db.session.commit()
        
        # Emit real-time update
        emit_socketio_event('order_status_changed', {
            'order_id': order.id,
            'order_number': order.order_number,
            'old_status': old_status,
            'new_status': order.status,
            'table_number': order.table.table_number if order.table else None
        }, room='restaurant')
        
        return jsonify({
            'message': 'Order status updated successfully',
            'order': {
                'id': order.id,
                'order_number': order.order_number,
                'status': order.status,
                'updated_at': order.updated_at.isoformat()
            }
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@orders_bp.route('/<int:order_id>/items', methods=['POST'])
@jwt_required()
def add_order_item(order_id):
    try:
        current_user_id = get_jwt_identity()
        current_user = User.query.get(current_user_id)
        
        order = Order.query.get(order_id)
        if not order:
            return jsonify({'error': 'Order not found'}), 404
        
        # Check permissions
        if current_user.role == 'waiter' and order.user_id != current_user_id:
            return jsonify({'error': 'Insufficient permissions'}), 403
        
        # Can only add items to pending or confirmed orders
        if order.status not in ['pending', 'confirmed']:
            return jsonify({'error': 'Cannot add items to this order'}), 400
        
        data = request.get_json()
        
        if not data.get('menu_item_id') or not data.get('quantity'):
            return jsonify({'error': 'Menu item ID and quantity are required'}), 400
        
        menu_item = MenuItem.query.get(data['menu_item_id'])
        if not menu_item:
            return jsonify({'error': 'Menu item not found'}), 404
        
        if not menu_item.is_available:
            return jsonify({'error': 'Menu item is not available'}), 400
        
        quantity = int(data['quantity'])
        unit_price = menu_item.price
        total_price = unit_price * quantity
        
        order_item = OrderItem(
            order_id=order.id,
            menu_item_id=menu_item.id,
            quantity=quantity,
            unit_price=unit_price,
            total_price=total_price,
            special_instructions=data.get('special_instructions', '')
        )
        
        db.session.add(order_item)
        
        # Update order total
        order.total_amount += total_price
        order.tax_amount = order.total_amount * 0.10  # Recalculate tax
        order.updated_at = datetime.utcnow()
        
        db.session.commit()
        
        return jsonify({
            'message': 'Item added to order successfully',
            'order_item': {
                'id': order_item.id,
                'menu_item_name': menu_item.name,
                'quantity': order_item.quantity,
                'total_price': float(order_item.total_price)
            },
            'order_total': float(order.total_amount)
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@orders_bp.route('/<int:order_id>/items/<int:item_id>', methods=['DELETE'])
@jwt_required()
def remove_order_item(order_id, item_id):
    try:
        current_user_id = get_jwt_identity()
        current_user = User.query.get(current_user_id)
        
        order = Order.query.get(order_id)
        if not order:
            return jsonify({'error': 'Order not found'}), 404
        
        # Check permissions
        if current_user.role == 'waiter' and order.user_id != current_user_id:
            return jsonify({'error': 'Insufficient permissions'}), 403
        
        # Can only remove items from pending or confirmed orders
        if order.status not in ['pending', 'confirmed']:
            return jsonify({'error': 'Cannot remove items from this order'}), 400
        
        order_item = OrderItem.query.filter_by(id=item_id, order_id=order_id).first()
        if not order_item:
            return jsonify({'error': 'Order item not found'}), 404
        
        # Update order total
        order.total_amount -= order_item.total_price
        order.tax_amount = order.total_amount * 0.10  # Recalculate tax
        order.updated_at = datetime.utcnow()
        
        db.session.delete(order_item)
        db.session.commit()
        
        return jsonify({
            'message': 'Item removed from order successfully',
            'order_total': float(order.total_amount)
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500