from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime, timedelta
from models import db, Reservation, Table, User
from sqlalchemy import and_, or_
import logging

reservations_bp = Blueprint('reservations', __name__)

@reservations_bp.route('/api/reservations', methods=['POST'])
@jwt_required()
def create_reservation():
    """Create a new table reservation"""
    try:
        data = request.get_json()
        current_user_id = get_jwt_identity()
        
        # Validate required fields
        required_fields = ['table_id', 'customer_name', 'reservation_date', 'party_size']
        for field in required_fields:
            if field not in data or not data[field]:
                return jsonify({'error': f'{field} is required'}), 400
        
        # Validate table exists and is active
        table = Table.query.filter_by(id=data['table_id'], is_active=True).first()
        if not table:
            return jsonify({'error': 'Table not found'}), 404
        
        # Validate party size doesn't exceed table capacity
        if data['party_size'] > table.capacity:
            return jsonify({'error': f'Party size ({data["party_size"]}) exceeds table capacity ({table.capacity})'}), 400
        
        # Parse reservation date
        try:
            reservation_date = datetime.fromisoformat(data['reservation_date'].replace('Z', '+00:00'))
        except ValueError:
            return jsonify({'error': 'Invalid reservation date format. Use ISO format (YYYY-MM-DDTHH:MM:SS)'}), 400
        
        # Check if reservation is in the future
        if reservation_date <= datetime.utcnow():
            return jsonify({'error': 'Reservation date must be in the future'}), 400
        
        # Check for conflicting reservations (within 2 hours of the requested time)
        time_buffer = timedelta(hours=2)
        start_time = reservation_date - time_buffer
        end_time = reservation_date + time_buffer
        
        existing_reservation = Reservation.query.filter(
            and_(
                Reservation.table_id == data['table_id'],
                Reservation.reservation_date.between(start_time, end_time),
                Reservation.status.in_(['confirmed', 'completed'])
            )
        ).first()
        
        if existing_reservation:
            return jsonify({
                'error': 'Table is already reserved during this time period',
                'conflicting_reservation': {
                    'id': existing_reservation.id,
                    'customer_name': existing_reservation.customer_name,
                    'reservation_date': existing_reservation.reservation_date.isoformat(),
                    'party_size': existing_reservation.party_size
                }
            }), 409
        
        # Create the reservation
        reservation = Reservation(
            table_id=data['table_id'],
            customer_name=data['customer_name'],
            customer_phone=data.get('customer_phone'),
            customer_email=data.get('customer_email'),
            party_size=data['party_size'],
            reservation_date=reservation_date,
            status=data.get('status', 'confirmed'),
            notes=data.get('notes'),
            created_by=current_user_id
        )
        
        db.session.add(reservation)
        db.session.commit()
        
        current_app.logger.info(f'Reservation created: ID {reservation.id} for table {table.table_number} by user {current_user_id}')
        
        return jsonify({
            'message': 'Reservation created successfully',
            'reservation': reservation.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f'Error creating reservation: {str(e)}')
        return jsonify({'error': 'Failed to create reservation'}), 500

@reservations_bp.route('/api/reservations', methods=['GET'])
@jwt_required()
def get_reservations():
    """Get reservations with optional filtering"""
    try:
        # Get query parameters
        table_id = request.args.get('table_id', type=int)
        status = request.args.get('status')
        date_from = request.args.get('date_from')
        date_to = request.args.get('date_to')
        customer_name = request.args.get('customer_name')
        page = request.args.get('page', 1, type=int)
        per_page = min(request.args.get('per_page', 50, type=int), 100)
        
        # Build query
        query = Reservation.query
        
        # Apply filters
        if table_id:
            query = query.filter(Reservation.table_id == table_id)
        
        if status:
            query = query.filter(Reservation.status == status)
        
        if date_from:
            try:
                date_from_parsed = datetime.fromisoformat(date_from.replace('Z', '+00:00'))
                query = query.filter(Reservation.reservation_date >= date_from_parsed)
            except ValueError:
                return jsonify({'error': 'Invalid date_from format'}), 400
        
        if date_to:
            try:
                date_to_parsed = datetime.fromisoformat(date_to.replace('Z', '+00:00'))
                query = query.filter(Reservation.reservation_date <= date_to_parsed)
            except ValueError:
                return jsonify({'error': 'Invalid date_to format'}), 400
        
        if customer_name:
            query = query.filter(Reservation.customer_name.ilike(f'%{customer_name}%'))
        
        # Order by reservation date
        query = query.order_by(Reservation.reservation_date.desc())
        
        # Paginate
        reservations_paginated = query.paginate(
            page=page, 
            per_page=per_page, 
            error_out=False
        )
        
        return jsonify({
            'reservations': [reservation.to_dict() for reservation in reservations_paginated.items],
            'pagination': {
                'page': page,
                'per_page': per_page,
                'total': reservations_paginated.total,
                'pages': reservations_paginated.pages,
                'has_next': reservations_paginated.has_next,
                'has_prev': reservations_paginated.has_prev
            }
        }), 200
        
    except Exception as e:
        current_app.logger.error(f'Error fetching reservations: {str(e)}')
        return jsonify({'error': 'Failed to fetch reservations'}), 500

@reservations_bp.route('/api/reservations/<int:reservation_id>', methods=['GET'])
@jwt_required()
def get_reservation(reservation_id):
    """Get a specific reservation by ID"""
    try:
        reservation = Reservation.query.get(reservation_id)
        if not reservation:
            return jsonify({'error': 'Reservation not found'}), 404
        
        return jsonify({'reservation': reservation.to_dict()}), 200
        
    except Exception as e:
        current_app.logger.error(f'Error fetching reservation {reservation_id}: {str(e)}')
        return jsonify({'error': 'Failed to fetch reservation'}), 500

@reservations_bp.route('/api/reservations/<int:reservation_id>', methods=['PUT'])
@jwt_required()
def update_reservation(reservation_id):
    """Update a reservation"""
    try:
        data = request.get_json()
        current_user_id = get_jwt_identity()
        
        reservation = Reservation.query.get(reservation_id)
        if not reservation:
            return jsonify({'error': 'Reservation not found'}), 404
        
        # Update fields if provided
        if 'customer_name' in data:
            reservation.customer_name = data['customer_name']
        
        if 'customer_phone' in data:
            reservation.customer_phone = data['customer_phone']
        
        if 'customer_email' in data:
            reservation.customer_email = data['customer_email']
        
        if 'party_size' in data:
            if data['party_size'] > reservation.table.capacity:
                return jsonify({'error': f'Party size ({data["party_size"]}) exceeds table capacity ({reservation.table.capacity})'}), 400
            reservation.party_size = data['party_size']
        
        if 'reservation_date' in data:
            try:
                new_date = datetime.fromisoformat(data['reservation_date'].replace('Z', '+00:00'))
                if new_date <= datetime.utcnow():
                    return jsonify({'error': 'Reservation date must be in the future'}), 400
                reservation.reservation_date = new_date
            except ValueError:
                return jsonify({'error': 'Invalid reservation date format'}), 400
        
        if 'status' in data:
            valid_statuses = ['confirmed', 'cancelled', 'completed', 'no_show']
            if data['status'] not in valid_statuses:
                return jsonify({'error': f'Invalid status. Must be one of: {", ".join(valid_statuses)}'}), 400
            reservation.status = data['status']
        
        if 'notes' in data:
            reservation.notes = data['notes']
        
        reservation.updated_at = datetime.utcnow()
        db.session.commit()
        
        current_app.logger.info(f'Reservation {reservation_id} updated by user {current_user_id}')
        
        return jsonify({
            'message': 'Reservation updated successfully',
            'reservation': reservation.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f'Error updating reservation {reservation_id}: {str(e)}')
        return jsonify({'error': 'Failed to update reservation'}), 500

@reservations_bp.route('/api/reservations/<int:reservation_id>', methods=['DELETE'])
@jwt_required()
def cancel_reservation(reservation_id):
    """Cancel a reservation (soft delete by setting status to cancelled)"""
    try:
        current_user_id = get_jwt_identity()
        
        reservation = Reservation.query.get(reservation_id)
        if not reservation:
            return jsonify({'error': 'Reservation not found'}), 404
        
        reservation.status = 'cancelled'
        reservation.updated_at = datetime.utcnow()
        db.session.commit()
        
        current_app.logger.info(f'Reservation {reservation_id} cancelled by user {current_user_id}')
        
        return jsonify({'message': 'Reservation cancelled successfully'}), 200
        
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f'Error cancelling reservation {reservation_id}: {str(e)}')
        return jsonify({'error': 'Failed to cancel reservation'}), 500

@reservations_bp.route('/api/reservations/availability', methods=['GET'])
@jwt_required()
def check_availability():
    """Check table availability for a specific date/time"""
    try:
        # Get query parameters
        table_id = request.args.get('table_id', type=int)
        reservation_date = request.args.get('reservation_date')
        party_size = request.args.get('party_size', type=int)
        
        if not reservation_date:
            return jsonify({'error': 'reservation_date is required'}), 400
        
        try:
            check_date = datetime.fromisoformat(reservation_date.replace('Z', '+00:00'))
        except ValueError:
            return jsonify({'error': 'Invalid reservation date format'}), 400
        
        # Check if date is in the future
        if check_date <= datetime.utcnow():
            return jsonify({'error': 'Reservation date must be in the future'}), 400
        
        # Build query for available tables
        query = Table.query.filter(Table.is_active == True)
        
        if table_id:
            query = query.filter(Table.id == table_id)
        
        if party_size:
            query = query.filter(Table.capacity >= party_size)
        
        tables = query.all()
        
        # Check availability for each table
        available_tables = []
        time_buffer = timedelta(hours=2)
        start_time = check_date - time_buffer
        end_time = check_date + time_buffer
        
        for table in tables:
            # Check for conflicting reservations
            conflicting_reservation = Reservation.query.filter(
                and_(
                    Reservation.table_id == table.id,
                    Reservation.reservation_date.between(start_time, end_time),
                    Reservation.status.in_(['confirmed', 'completed'])
                )
            ).first()
            
            if not conflicting_reservation:
                available_tables.append({
                    'table': table.to_dict(),
                    'available': True
                })
            else:
                available_tables.append({
                    'table': table.to_dict(),
                    'available': False,
                    'conflicting_reservation': {
                        'id': conflicting_reservation.id,
                        'customer_name': conflicting_reservation.customer_name,
                        'reservation_date': conflicting_reservation.reservation_date.isoformat(),
                        'party_size': conflicting_reservation.party_size
                    }
                })
        
        return jsonify({
            'availability': available_tables,
            'requested_date': check_date.isoformat(),
            'party_size': party_size
        }), 200
        
    except Exception as e:
        current_app.logger.error(f'Error checking availability: {str(e)}')
        return jsonify({'error': 'Failed to check availability'}), 500

@reservations_bp.route('/api/reservations/today', methods=['GET'])
@jwt_required()
def get_todays_reservations():
    """Get all reservations for today"""
    try:
        today = datetime.utcnow().date()
        start_of_day = datetime.combine(today, datetime.min.time())
        end_of_day = datetime.combine(today, datetime.max.time())
        
        reservations = Reservation.query.filter(
            and_(
                Reservation.reservation_date >= start_of_day,
                Reservation.reservation_date <= end_of_day,
                Reservation.status.in_(['confirmed', 'completed'])
            )
        ).order_by(Reservation.reservation_date.asc()).all()
        
        return jsonify({
            'reservations': [reservation.to_dict() for reservation in reservations],
            'date': today.isoformat(),
            'total_count': len(reservations)
        }), 200
        
    except Exception as e:
        current_app.logger.error(f'Error fetching today\'s reservations: {str(e)}')
        return jsonify({'error': 'Failed to fetch today\'s reservations'}), 500