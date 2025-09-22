from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from werkzeug.security import generate_password_hash
from models import User, Location, db

admin_bp = Blueprint('admin', __name__)

@admin_bp.route('/users', methods=['GET'])
@jwt_required()
def get_all_users():
    """Get all users with location information (admin only)"""
    try:
        current_user_id = get_jwt_identity()
        current_user = User.query.get(current_user_id)
        
        if current_user.role != 'admin':
            return jsonify({'error': 'Only admins can view all users'}), 403
        
        users = User.query.all()
        users_data = []
        
        for user in users:
            user_data = {
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'first_name': user.first_name,
                'last_name': user.last_name,
                'role': user.role,
                'location_id': user.location_id,
                'is_active': user.is_active,
                'created_at': user.created_at.isoformat()
            }
            
            # Add location information
            if user.user_location:
                user_data['location'] = {
                    'id': user.user_location.id,
                    'name': user.user_location.name,
                    'display_name': user.user_location.display_name
                }
            else:
                user_data['location'] = None
            
            users_data.append(user_data)
        
        return jsonify({'users': users_data}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@admin_bp.route('/users', methods=['POST'])
@jwt_required()
def create_user():
    """Create a new user (admin only)"""
    try:
        current_user_id = get_jwt_identity()
        current_user = User.query.get(current_user_id)
        
        if current_user.role != 'admin':
            return jsonify({'error': 'Only admins can create users'}), 403
        
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['username', 'email', 'password', 'first_name', 'last_name']
        for field in required_fields:
            if not data.get(field):
                return jsonify({'error': f'{field} is required'}), 400
        
        # Check if username or email already exists
        if User.query.filter_by(username=data['username']).first():
            return jsonify({'error': 'Username already exists'}), 400
        
        if User.query.filter_by(email=data['email']).first():
            return jsonify({'error': 'Email already exists'}), 400
        
        # Validate location if provided
        location_id = data.get('location_id')
        if location_id:
            location = Location.query.get(location_id)
            if not location:
                return jsonify({'error': 'Invalid location'}), 400
        
        # Create new user
        new_user = User(
            username=data['username'],
            email=data['email'],
            password_hash=generate_password_hash(data['password']),
            first_name=data['first_name'],
            last_name=data['last_name'],
            role=data.get('role', 'waiter'),
            location_id=location_id,
            is_active=data.get('is_active', True)
        )
        
        db.session.add(new_user)
        db.session.commit()
        
        # Return user data with location info
        user_data = {
            'id': new_user.id,
            'username': new_user.username,
            'email': new_user.email,
            'first_name': new_user.first_name,
            'last_name': new_user.last_name,
            'role': new_user.role,
            'location_id': new_user.location_id,
            'is_active': new_user.is_active
        }
        
        if new_user.user_location:
            user_data['location'] = {
                'id': new_user.user_location.id,
                'name': new_user.user_location.name,
                'display_name': new_user.user_location.display_name
            }
        else:
            user_data['location'] = None
        
        return jsonify({
            'message': 'User created successfully',
            'user': user_data
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@admin_bp.route('/users/<int:user_id>', methods=['PUT'])
@jwt_required()
def update_user(user_id):
    """Update a user (admin only)"""
    try:
        current_user_id = get_jwt_identity()
        current_user = User.query.get(current_user_id)
        
        if current_user.role != 'admin':
            return jsonify({'error': 'Only admins can update users'}), 403
        
        user = User.query.get(user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        data = request.get_json()
        
        # Update allowed fields
        if 'first_name' in data:
            user.first_name = data['first_name']
        if 'last_name' in data:
            user.last_name = data['last_name']
        if 'email' in data:
            # Check if email is unique
            if data['email'] != user.email:
                existing_email = User.query.filter_by(email=data['email']).first()
                if existing_email:
                    return jsonify({'error': 'Email already exists'}), 400
            user.email = data['email']
        if 'username' in data:
            # Check if username is unique
            if data['username'] != user.username:
                existing_username = User.query.filter_by(username=data['username']).first()
                if existing_username:
                    return jsonify({'error': 'Username already exists'}), 400
            user.username = data['username']
        if 'role' in data:
            user.role = data['role']
        if 'is_active' in data:
            user.is_active = data['is_active']
        
        # Handle location assignment
        if 'location_id' in data:
            location_id = data['location_id']
            if location_id:
                location = Location.query.get(location_id)
                if not location:
                    return jsonify({'error': 'Invalid location'}), 400
                user.location_id = location_id
            else:
                user.location_id = None
        
        # Password update
        if 'password' in data and data['password']:
            user.password_hash = generate_password_hash(data['password'])
        
        db.session.commit()
        
        # Return updated user data with location info
        user_data = {
            'id': user.id,
            'username': user.username,
            'email': user.email,
            'first_name': user.first_name,
            'last_name': user.last_name,
            'role': user.role,
            'location_id': user.location_id,
            'is_active': user.is_active
        }
        
        if user.user_location:
            user_data['location'] = {
                'id': user.user_location.id,
                'name': user.user_location.name,
                'display_name': user.user_location.display_name
            }
        else:
            user_data['location'] = None
        
        return jsonify({
            'message': 'User updated successfully',
            'user': user_data
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@admin_bp.route('/users/<int:user_id>', methods=['DELETE'])
@jwt_required()
def delete_user(user_id):
    """Delete a user (admin only)"""
    try:
        current_user_id = get_jwt_identity()
        current_user = User.query.get(current_user_id)
        
        if current_user.role != 'admin':
            return jsonify({'error': 'Only admins can delete users'}), 403
        
        user = User.query.get(user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        # Prevent admin from deleting themselves
        if user.id == current_user_id:
            return jsonify({'error': 'Cannot delete your own account'}), 400
        
        # Soft delete - mark as inactive
        user.is_active = False
        db.session.commit()
        
        return jsonify({'message': 'User deleted successfully'}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@admin_bp.route('/locations', methods=['GET'])
@jwt_required()
def get_all_locations():
    """Get all locations (admin only)"""
    try:
        current_user_id = get_jwt_identity()
        current_user = User.query.get(current_user_id)
        
        if current_user.role != 'admin':
            return jsonify({'error': 'Only admins can view all locations'}), 403
        
        locations = Location.query.all()
        locations_data = []
        
        for location in locations:
            locations_data.append({
                'id': location.id,
                'name': location.name,
                'display_name': location.display_name,
                'description': location.description,
                'is_active': location.is_active,
                'created_at': location.created_at.isoformat(),
                'user_count': len([u for u in location.users if u.is_active])
            })
        
        return jsonify({'locations': locations_data}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500