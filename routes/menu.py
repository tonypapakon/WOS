from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import MenuItem, Category, User, db
from sqlalchemy import or_

menu_bp = Blueprint('menu', __name__)

@menu_bp.route('/categories', methods=['GET'])
@jwt_required()
def get_categories():
    try:
        categories = Category.query.filter_by(is_active=True).order_by(Category.sort_order).all()
        categories_data = []
        
        for category in categories:
            categories_data.append({
                'id': category.id,
                'name': category.name,
                'description': category.description,
                'image_url': category.image_url,
                'sort_order': category.sort_order,
                'printer_destination': category.printer_destination,
                'item_count': len([item for item in category.menu_items if item.is_available])
            })
        
        return jsonify({'categories': categories_data}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@menu_bp.route('/categories', methods=['POST'])
@jwt_required()
def create_category():
    try:
        current_user_id = int(get_jwt_identity())
        current_user = User.query.get(current_user_id)
        
        if current_user.role not in ['admin', 'manager']:
            return jsonify({'error': 'Insufficient permissions'}), 403
        
        data = request.get_json()
        
        if not data.get('name'):
            return jsonify({'error': 'Category name is required'}), 400
        
        new_category = Category(
            name=data['name'],
            description=data.get('description', ''),
            image_url=data.get('image_url', ''),
            sort_order=data.get('sort_order', 0),
            printer_destination=data.get('printer_destination', 'kitchen')
        )
        
        db.session.add(new_category)
        db.session.commit()
        
        return jsonify({
            'message': 'Category created successfully',
            'category': {
                'id': new_category.id,
                'name': new_category.name,
                'description': new_category.description,
                'image_url': new_category.image_url,
                'sort_order': new_category.sort_order,
                'printer_destination': new_category.printer_destination
            }
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@menu_bp.route('/categories/<int:category_id>', methods=['DELETE'])
@jwt_required()
def delete_category(category_id):
    try:
        current_user_id = int(get_jwt_identity())
        current_user = User.query.get(current_user_id)
        if current_user.role not in ['admin', 'manager']:
            return jsonify({'error': 'Insufficient permissions'}), 403

        category = Category.query.get(category_id)
        if not category or not category.is_active:
            return jsonify({'error': 'Category not found'}), 404

        # Soft delete: set is_active to False
        category.is_active = False
        db.session.commit()

        return jsonify({'message': 'Category deleted successfully'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@menu_bp.route('/items', methods=['GET'])
@jwt_required()
def get_menu_items():
    try:
        current_user_id = int(get_jwt_identity())
        current_user = User.query.get(current_user_id)
        
        category_id = request.args.get('category_id')
        search = request.args.get('search', '')
        order_type = request.args.get('order_type', 'dine_in')  # dine_in, takeaway, delivery
        
        # Base query - filter by order type
        if order_type == 'takeaway':
            # For takeaway: show items available for takeaway OR takeaway-only items
            query = MenuItem.query.filter(
                or_(
                    MenuItem.is_available_takeaway == True,
                    MenuItem.is_takeaway_only == True
                )
            )
        else:
            # For dine-in: show items available for dine-in (not takeaway-only)
            query = MenuItem.query.filter(
                MenuItem.is_available == True,
                MenuItem.is_takeaway_only == False
            )
        
        if category_id:
            query = query.filter_by(category_id=category_id)
        
        if search:
            query = query.filter(
                or_(
                    MenuItem.name.contains(search),
                    MenuItem.description.contains(search),
                    MenuItem.barcode.contains(search)
                )
            )
        
        menu_items = query.order_by(MenuItem.sort_order, MenuItem.name).all()
        items_data = []
        
        for item in menu_items:
            # Determine pricing based on user location and order type
            if order_type == 'takeaway':
                # Takeaway pricing for all users
                price = float(item.takeaway_price) if item.takeaway_price else float(item.price)
                description = item.takeaway_description if item.takeaway_description else item.description
                prep_time = item.takeaway_preparation_time if item.takeaway_preparation_time else item.preparation_time
            elif current_user.user_location and current_user.user_location.name == 'beach_bar':
                # Beach waiters see beach bar prices for dine-in
                price = float(item.beach_bar_price) if item.beach_bar_price else float(item.price)
                description = item.description
                prep_time = item.preparation_time
            else:
                # Shop users see shop prices for dine-in
                price = float(item.price)
                description = item.description
                prep_time = item.preparation_time
            
            # Build item data - only include prices that the user should see
            item_data = {
                'id': item.id,
                'name': item.name,
                'barcode': item.barcode,
                'description': description,
                'price': price,
                'category_id': item.category_id,
                'category_name': item.category.name,
                'image_url': item.image_url,
                'preparation_time': prep_time,
                'allergens': item.allergens,
                'nutritional_info': item.nutritional_info,
                'printer_destination': item.category.printer_destination,
                'is_takeaway_only': item.is_takeaway_only,
                'order_type': order_type,
                'user_location': current_user.user_location.name if current_user.user_location else None  # For debugging
            }
            
            # Add pricing information based on user location and role
            if current_user.role in ['admin', 'manager']:
                # Admins and managers see all prices
                item_data['original_price'] = float(item.price)
                item_data['takeaway_price'] = float(item.takeaway_price) if item.takeaway_price else None
                item_data['beach_bar_price'] = float(item.beach_bar_price) if item.beach_bar_price else None
            elif current_user.user_location and current_user.user_location.name == 'beach_bar':
                # Beach waiters only see beach bar and takeaway prices
                item_data['beach_bar_price'] = float(item.beach_bar_price) if item.beach_bar_price else None
                item_data['takeaway_price'] = float(item.takeaway_price) if item.takeaway_price else None
                # Don't include shop price
            else:
                # Shop waiters see shop and takeaway prices
                item_data['original_price'] = float(item.price)
                item_data['takeaway_price'] = float(item.takeaway_price) if item.takeaway_price else None
                # Don't include beach bar price
            
            items_data.append(item_data)
        
        return jsonify({'menu_items': items_data}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@menu_bp.route('/items/admin', methods=['GET'])
@jwt_required()
def get_all_menu_items_admin():
    """Get all menu items for admin management - includes all fields"""
    try:
        current_user_id = int(get_jwt_identity())
        current_user = User.query.get(current_user_id)
        
        if current_user.role not in ['admin', 'manager']:
            return jsonify({'error': 'Insufficient permissions'}), 403
        
        category_id = request.args.get('category_id')
        search = request.args.get('search', '')
        
        query = MenuItem.query
        
        if category_id:
            query = query.filter_by(category_id=category_id)
        
        if search:
            query = query.filter(
                or_(
                    MenuItem.name.contains(search),
                    MenuItem.description.contains(search),
                    MenuItem.barcode.contains(search)
                )
            )
        
        menu_items = query.order_by(MenuItem.sort_order, MenuItem.name).all()
        items_data = []
        
        for item in menu_items:
            items_data.append({
                'id': item.id,
                'name': item.name,
                'barcode': item.barcode,
                'description': item.description,
                'price': float(item.price),
                'takeaway_price': float(item.takeaway_price) if item.takeaway_price else None,
                'beach_bar_price': float(item.beach_bar_price) if item.beach_bar_price else None,
                'takeaway_description': item.takeaway_description,
                'category_id': item.category_id,
                'category_name': item.category.name,
                'image_url': item.image_url,
                'is_available': item.is_available,
                'is_available_takeaway': item.is_available_takeaway,
                'is_takeaway_only': item.is_takeaway_only,
                'preparation_time': item.preparation_time,
                'takeaway_preparation_time': item.takeaway_preparation_time,
                'allergens': item.allergens,
                'nutritional_info': item.nutritional_info,
                'sort_order': item.sort_order,
                'printer_destination': item.category.printer_destination,
                'created_at': item.created_at.isoformat()
            })
        
        return jsonify({'menu_items': items_data}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@menu_bp.route('/items/barcode/<barcode>', methods=['GET'])
@jwt_required()
def get_item_by_barcode(barcode):
    """Get menu item by barcode for quick identification"""
    try:
        item = MenuItem.query.filter_by(barcode=barcode).first()
        
        if not item:
            return jsonify({'error': 'Item not found'}), 404
        
        return jsonify({
            'menu_item': {
                'id': item.id,
                'name': item.name,
                'barcode': item.barcode,
                'description': item.description,
                'price': float(item.price),
                'takeaway_price': float(item.takeaway_price) if item.takeaway_price else None,
                'category_id': item.category_id,
                'category_name': item.category.name,
                'image_url': item.image_url,
                'is_available': item.is_available,
                'is_available_takeaway': item.is_available_takeaway,
                'is_takeaway_only': item.is_takeaway_only,
                'preparation_time': item.preparation_time,
                'printer_destination': item.category.printer_destination
            }
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@menu_bp.route('/items', methods=['POST'])
@jwt_required()
def create_menu_item():
    try:
        current_user_id = int(get_jwt_identity())
        current_user = User.query.get(current_user_id)
        
        if current_user.role not in ['admin', 'manager']:
            return jsonify({'error': 'Insufficient permissions'}), 403
        
        data = request.get_json()
        
        required_fields = ['name', 'price', 'category_id']
        for field in required_fields:
            if not data.get(field):
                return jsonify({'error': f'{field} is required'}), 400
        
        # Verify category exists
        category = Category.query.get(data['category_id'])
        if not category:
            return jsonify({'error': 'Category not found'}), 404
        
        # Check if barcode is unique (if provided)
        if data.get('barcode'):
            existing_item = MenuItem.query.filter_by(barcode=data['barcode']).first()
            if existing_item:
                return jsonify({'error': 'Barcode already exists'}), 400
        
        new_item = MenuItem(
            name=data['name'],
            barcode=data.get('barcode'),
            description=data.get('description', ''),
            price=data['price'],
            takeaway_price=data.get('takeaway_price'),
            takeaway_description=data.get('takeaway_description'),
            category_id=data['category_id'],
            image_url=data.get('image_url', ''),
            is_available=data.get('is_available', True),
            is_available_takeaway=data.get('is_available_takeaway', True),
            is_takeaway_only=data.get('is_takeaway_only', False),
            preparation_time=data.get('preparation_time', 15),
            takeaway_preparation_time=data.get('takeaway_preparation_time'),
            allergens=data.get('allergens', ''),
            nutritional_info=data.get('nutritional_info', ''),
            sort_order=data.get('sort_order', 0)
        )
        
        db.session.add(new_item)
        db.session.commit()
        
        return jsonify({
            'message': 'Menu item created successfully',
            'menu_item': {
                'id': new_item.id,
                'name': new_item.name,
                'barcode': new_item.barcode,
                'description': new_item.description,
                'price': float(new_item.price),
                'takeaway_price': float(new_item.takeaway_price) if new_item.takeaway_price else None,
                'takeaway_description': new_item.takeaway_description,
                'category_id': new_item.category_id,
                'image_url': new_item.image_url,
                'is_available': new_item.is_available,
                'is_available_takeaway': new_item.is_available_takeaway,
                'is_takeaway_only': new_item.is_takeaway_only,
                'preparation_time': new_item.preparation_time,
                'takeaway_preparation_time': new_item.takeaway_preparation_time
            }
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@menu_bp.route('/items/<int:item_id>', methods=['PUT'])
@jwt_required()
def update_menu_item(item_id):
    try:
        current_user_id = int(get_jwt_identity())
        current_user = User.query.get(current_user_id)
        
        if current_user.role not in ['admin', 'manager']:
            return jsonify({'error': 'Insufficient permissions'}), 403
        
        item = MenuItem.query.get(item_id)
        if not item:
            return jsonify({'error': 'Menu item not found'}), 404
        
        data = request.get_json()
        
        # Check if barcode is unique (if being updated)
        if 'barcode' in data and data['barcode'] != item.barcode:
            if data['barcode']:  # Only check if barcode is not empty
                existing_item = MenuItem.query.filter_by(barcode=data['barcode']).first()
                if existing_item:
                    return jsonify({'error': 'Barcode already exists'}), 400
        
        # Update fields
        if 'name' in data:
            item.name = data['name']
        if 'barcode' in data:
            item.barcode = data['barcode'] if data['barcode'] else None
        if 'description' in data:
            item.description = data['description']
        if 'price' in data:
            item.price = data['price']
        if 'takeaway_price' in data:
            item.takeaway_price = data['takeaway_price']
        if 'takeaway_description' in data:
            item.takeaway_description = data['takeaway_description']
        if 'category_id' in data:
            # Verify category exists
            category = Category.query.get(data['category_id'])
            if not category:
                return jsonify({'error': 'Category not found'}), 404
            item.category_id = data['category_id']
        if 'image_url' in data:
            item.image_url = data['image_url']
        if 'is_available' in data:
            item.is_available = data['is_available']
        if 'is_available_takeaway' in data:
            item.is_available_takeaway = data['is_available_takeaway']
        if 'is_takeaway_only' in data:
            item.is_takeaway_only = data['is_takeaway_only']
        if 'preparation_time' in data:
            item.preparation_time = data['preparation_time']
        if 'takeaway_preparation_time' in data:
            item.takeaway_preparation_time = data['takeaway_preparation_time']
        if 'allergens' in data:
            item.allergens = data['allergens']
        if 'nutritional_info' in data:
            item.nutritional_info = data['nutritional_info']
        if 'sort_order' in data:
            item.sort_order = data['sort_order']
        
        db.session.commit()
        
        return jsonify({
            'message': 'Menu item updated successfully',
            'menu_item': {
                'id': item.id,
                'name': item.name,
                'barcode': item.barcode,
                'description': item.description,
                'price': float(item.price),
                'category_id': item.category_id,
                'image_url': item.image_url,
                'is_available': item.is_available,
                'preparation_time': item.preparation_time
            }
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@menu_bp.route('/items/<int:item_id>', methods=['DELETE'])
@jwt_required()
def delete_menu_item(item_id):
    try:
        current_user_id = int(get_jwt_identity())
        current_user = User.query.get(current_user_id)
        
        if current_user.role not in ['admin', 'manager']:
            return jsonify({'error': 'Insufficient permissions'}), 403
        
        item = MenuItem.query.get(item_id)
        if not item:
            return jsonify({'error': 'Menu item not found'}), 404

        # Hard delete only if the item has no order history to preserve referential integrity
        if getattr(item, 'order_items', None) and len(item.order_items) > 0:
            return jsonify({'error': 'Cannot delete item with order history. Consider disabling it instead.'}), 400

        db.session.delete(item)
        db.session.commit()
        
        return jsonify({'message': 'Menu item permanently deleted'}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500