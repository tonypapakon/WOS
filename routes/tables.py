from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import Table, TableAssignment, User, Order, db
from datetime import datetime

tables_bp = Blueprint('tables', __name__)

@tables_bp.route('/', methods=['GET'])
@jwt_required()
def get_tables():
    try:
        tables = Table.query.filter_by(is_active=True).order_by(Table.table_number).all()
        tables_data = []
        
        for table in tables:
            # Get current assignment
            current_assignment = TableAssignment.query.filter_by(
                table_id=table.id,
                is_active=True
            ).first()
            
            # Get active orders for this table
            active_orders = Order.query.filter_by(
                table_id=table.id
            ).filter(Order.status.in_(['pending', 'confirmed', 'preparing', 'ready'])).all()
            
            tables_data.append({
                'id': table.id,
                'table_number': table.table_number,
                'capacity': table.capacity,
                'x_position': table.x_position,
                'y_position': table.y_position,
                'status': table.status,
                'assigned_waiter': {
                    'id': current_assignment.user.id,
                    'name': f"{current_assignment.user.first_name} {current_assignment.user.last_name}"
                } if current_assignment else None,
                'active_orders_count': len(active_orders),
                'has_active_orders': len(active_orders) > 0
            })
        
        return jsonify({'tables': tables_data}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@tables_bp.route('/', methods=['POST'])
@jwt_required()
def create_table():
    try:
        current_user_id = get_jwt_identity()
        current_user = User.query.get(current_user_id)
        
        if current_user.role not in ['admin', 'manager']:
            return jsonify({'error': 'Insufficient permissions'}), 403
        
        data = request.get_json()
        
        if not data.get('table_number'):
            return jsonify({'error': 'Table number is required'}), 400
        
        if not data.get('capacity'):
            return jsonify({'error': 'Table capacity is required'}), 400
        
        # Check if table number already exists
        existing_table = Table.query.filter_by(table_number=data['table_number']).first()
        if existing_table:
            return jsonify({'error': 'Table number already exists'}), 400
        
        new_table = Table(
            table_number=data['table_number'],
            capacity=data['capacity'],
            x_position=data.get('x_position', 0),
            y_position=data.get('y_position', 0),
            status=data.get('status', 'available')
        )
        
        db.session.add(new_table)
        db.session.commit()
        
        return jsonify({
            'message': 'Table created successfully',
            'table': {
                'id': new_table.id,
                'table_number': new_table.table_number,
                'capacity': new_table.capacity,
                'x_position': new_table.x_position,
                'y_position': new_table.y_position,
                'status': new_table.status
            }
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@tables_bp.route('/<int:table_id>', methods=['PUT'])
@jwt_required()
def update_table(table_id):
    try:
        current_user_id = get_jwt_identity()
        current_user = User.query.get(current_user_id)
        
        if current_user.role not in ['admin', 'manager']:
            return jsonify({'error': 'Insufficient permissions'}), 403
        
        table = Table.query.get(table_id)
        if not table:
            return jsonify({'error': 'Table not found'}), 404
        
        data = request.get_json()
        
        # Update fields
        if 'table_number' in data:
            # Check if new table number already exists
            existing_table = Table.query.filter_by(table_number=data['table_number']).filter(Table.id != table_id).first()
            if existing_table:
                return jsonify({'error': 'Table number already exists'}), 400
            table.table_number = data['table_number']
        
        if 'capacity' in data:
            table.capacity = data['capacity']
        if 'x_position' in data:
            table.x_position = data['x_position']
        if 'y_position' in data:
            table.y_position = data['y_position']
        if 'status' in data:
            table.status = data['status']
        if 'is_active' in data:
            table.is_active = data['is_active']
        
        db.session.commit()
        
        return jsonify({
            'message': 'Table updated successfully',
            'table': {
                'id': table.id,
                'table_number': table.table_number,
                'capacity': table.capacity,
                'x_position': table.x_position,
                'y_position': table.y_position,
                'status': table.status,
                'is_active': table.is_active
            }
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@tables_bp.route('/assignments', methods=['GET'])
@jwt_required()
def get_table_assignments():
    try:
        current_user_id = get_jwt_identity()
        current_user = User.query.get(current_user_id)
        
        if current_user.role == 'waiter':
            # Waiters can only see their own assignments
            assignments = TableAssignment.query.filter_by(
                user_id=current_user_id,
                is_active=True
            ).all()
        else:
            # Managers and admins can see all assignments
            assignments = TableAssignment.query.filter_by(is_active=True).all()
        
        assignments_data = []
        for assignment in assignments:
            assignments_data.append({
                'id': assignment.id,
                'table': {
                    'id': assignment.table.id,
                    'table_number': assignment.table.table_number,
                    'capacity': assignment.table.capacity,
                    'status': assignment.table.status
                },
                'waiter': {
                    'id': assignment.user.id,
                    'name': f"{assignment.user.first_name} {assignment.user.last_name}",
                    'username': assignment.user.username
                },
                'assigned_at': assignment.assigned_at.isoformat()
            })
        
        return jsonify({'assignments': assignments_data}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@tables_bp.route('/assignments', methods=['POST'])
@jwt_required()
def assign_table():
    try:
        current_user_id = get_jwt_identity()
        current_user = User.query.get(current_user_id)
        
        if current_user.role not in ['admin', 'manager']:
            return jsonify({'error': 'Insufficient permissions'}), 403
        
        data = request.get_json()
        
        if not data.get('table_id') or not data.get('user_id'):
            return jsonify({'error': 'Table ID and User ID are required'}), 400
        
        # Verify table and user exist
        table = Table.query.get(data['table_id'])
        if not table:
            return jsonify({'error': 'Table not found'}), 404
        
        user = User.query.get(data['user_id'])
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        # Check if table is already assigned
        existing_assignment = TableAssignment.query.filter_by(
            table_id=data['table_id'],
            is_active=True
        ).first()
        
        if existing_assignment:
            # Deactivate existing assignment
            existing_assignment.is_active = False
        
        # Create new assignment
        new_assignment = TableAssignment(
            table_id=data['table_id'],
            user_id=data['user_id']
        )
        
        db.session.add(new_assignment)
        db.session.commit()
        
        return jsonify({
            'message': 'Table assigned successfully',
            'assignment': {
                'id': new_assignment.id,
                'table_number': table.table_number,
                'waiter_name': f"{user.first_name} {user.last_name}",
                'assigned_at': new_assignment.assigned_at.isoformat()
            }
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@tables_bp.route('/assignments/<int:assignment_id>', methods=['DELETE'])
@jwt_required()
def unassign_table(assignment_id):
    try:
        current_user_id = get_jwt_identity()
        current_user = User.query.get(current_user_id)
        
        if current_user.role not in ['admin', 'manager']:
            return jsonify({'error': 'Insufficient permissions'}), 403
        
        assignment = TableAssignment.query.get(assignment_id)
        if not assignment:
            return jsonify({'error': 'Assignment not found'}), 404
        
        assignment.is_active = False
        db.session.commit()
        
        return jsonify({'message': 'Table unassigned successfully'}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@tables_bp.route('/<int:table_id>/status', methods=['PUT'])
@jwt_required()
def update_table_status(table_id):
    try:
        table = Table.query.get(table_id)
        if not table:
            return jsonify({'error': 'Table not found'}), 404
        
        data = request.get_json()
        if not data.get('status'):
            return jsonify({'error': 'Status is required'}), 400
        
        valid_statuses = ['available', 'occupied', 'reserved', 'cleaning']
        if data['status'] not in valid_statuses:
            return jsonify({'error': 'Invalid status'}), 400
        
        table.status = data['status']
        db.session.commit()
        
        return jsonify({
            'message': 'Table status updated successfully',
            'table': {
                'id': table.id,
                'table_number': table.table_number,
                'status': table.status
            }
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500