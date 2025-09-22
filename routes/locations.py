from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import Location, User, db
from decimal import Decimal

locations_bp = Blueprint('locations', __name__)

@locations_bp.route('', methods=['GET'])
@locations_bp.route('/', methods=['GET'])
@jwt_required()
def get_locations():
    """Get all locations"""
    try:
        locations = Location.query.filter_by(is_active=True).order_by(Location.name).all()
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

@locations_bp.route('', methods=['POST'])
@locations_bp.route('/', methods=['POST'])
@jwt_required()
def create_location():
    """Create a new location (admin only)"""
    try:
        current_user_id = int(get_jwt_identity())
        current_user = User.query.get(current_user_id)
        
        if current_user.role != 'admin':
            return jsonify({'error': 'Only admins can create locations'}), 403
        
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['name', 'display_name']
        for field in required_fields:
            if not data.get(field):
                return jsonify({'error': f'{field} is required'}), 400
        
        # Check if location name already exists
        if Location.query.filter_by(name=data['name']).first():
            return jsonify({'error': 'Location name already exists'}), 400
        
        # Create new location
        new_location = Location(
            name=data['name'],
            display_name=data['display_name'],
            description=data.get('description', '')
        )
        
        db.session.add(new_location)
        db.session.commit()
        
        return jsonify({
            'message': 'Location created successfully',
            'location': {
                'id': new_location.id,
                'name': new_location.name,
                'display_name': new_location.display_name,
                'description': new_location.description,
                'is_active': new_location.is_active
            }
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@locations_bp.route('/<int:location_id>', methods=['PUT'])
@jwt_required()
def update_location(location_id):
    """Update a location (admin only)"""
    try:
        current_user_id = int(get_jwt_identity())
        current_user = User.query.get(current_user_id)
        
        if current_user.role != 'admin':
            return jsonify({'error': 'Only admins can update locations'}), 403
        
        location = Location.query.get(location_id)
        if not location:
            return jsonify({'error': 'Location not found'}), 404
        
        data = request.get_json()
        
        # Check if name is being changed and if it's unique
        if 'name' in data and data['name'] != location.name:
            if Location.query.filter_by(name=data['name']).first():
                return jsonify({'error': 'Location name already exists'}), 400
            location.name = data['name']
        
        # Update fields
        if 'display_name' in data:
            location.display_name = data['display_name']
        if 'description' in data:
            location.description = data['description']
        if 'is_active' in data:
            location.is_active = data['is_active']
        
        db.session.commit()
        
        return jsonify({
            'message': 'Location updated successfully',
            'location': {
                'id': location.id,
                'name': location.name,
                'display_name': location.display_name,
                'description': location.description,
                'is_active': location.is_active
            }
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@locations_bp.route('/<int:location_id>', methods=['DELETE'])
@jwt_required()
def delete_location(location_id):
    """Delete a location (admin only)"""
    try:
        current_user_id = int(get_jwt_identity())
        current_user = User.query.get(current_user_id)
        
        if current_user.role != 'admin':
            return jsonify({'error': 'Only admins can delete locations'}), 403
        
        location = Location.query.get(location_id)
        if not location:
            return jsonify({'error': 'Location not found'}), 404
        
        # Check if location has users assigned
        if location.users:
            return jsonify({'error': 'Cannot delete location with assigned users. Please reassign users first.'}), 400
        
        # Soft delete - mark as inactive
        location.is_active = False
        db.session.commit()
        
        return jsonify({'message': 'Location deleted successfully'}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500