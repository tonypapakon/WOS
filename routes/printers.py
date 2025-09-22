from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import PrinterConfig, Order, OrderItem, User, db
import socket
from datetime import datetime

printers_bp = Blueprint('printers', __name__)

def send_to_thermal_printer(printer_ip, printer_port, content):
    """Send content to thermal printer via network"""
    try:
        # Create socket connection
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(5)  # 5 second timeout
        sock.connect((printer_ip, printer_port))
        
        # Send content
        sock.send(content.encode('utf-8'))
        sock.close()
        
        return True, "Print job sent successfully"
    except Exception as e:
        return False, str(e)

def format_kitchen_order(order):
    """Format order for kitchen printer"""
    content = "\n" + "="*32 + "\n"
    content += f"KITCHEN ORDER\n"
    content += f"Order: {order.order_number}\n"
    content += f"Table: {order.table.table_number}\n"
    content += f"Waiter: {order.waiter.first_name} {order.waiter.last_name}\n"
    content += f"Time: {order.created_at.strftime('%H:%M:%S')}\n"
    content += "="*32 + "\n\n"
    
    # Filter kitchen items
    kitchen_items = [item for item in order.items 
                    if item.menu_item.category.printer_destination == 'kitchen']
    
    for item in kitchen_items:
        content += f"{item.quantity}x {item.menu_item.name}\n"
        if item.special_instructions:
            content += f"   Note: {item.special_instructions}\n"
        content += "\n"
    
    content += "="*32 + "\n"
    content += f"Total Kitchen Items: {len(kitchen_items)}\n"
    content += "="*32 + "\n\n\n"
    
    return content

def format_bar_order(order):
    """Format order for bar printer"""
    content = "\n" + "="*32 + "\n"
    content += f"BAR ORDER\n"
    content += f"Order: {order.order_number}\n"
    content += f"Table: {order.table.table_number}\n"
    content += f"Waiter: {order.waiter.first_name} {order.waiter.last_name}\n"
    content += f"Time: {order.created_at.strftime('%H:%M:%S')}\n"
    content += "="*32 + "\n\n"
    
    # Filter bar items
    bar_items = [item for item in order.items 
                if item.menu_item.category.printer_destination == 'bar']
    
    for item in bar_items:
        content += f"{item.quantity}x {item.menu_item.name}\n"
        if item.special_instructions:
            content += f"   Note: {item.special_instructions}\n"
        content += "\n"
    
    content += "="*32 + "\n"
    content += f"Total Bar Items: {len(bar_items)}\n"
    content += "="*32 + "\n\n\n"
    
    return content

def format_receipt(order):
    """Format order for receipt printer"""
    content = "\n" + "="*32 + "\n"
    content += f"RESTAURANT NAME\n"
    content += f"123 Main Street\n"
    content += f"City, State 12345\n"
    content += f"Tel: (555) 123-4567\n"
    content += "="*32 + "\n"
    content += f"Order: {order.order_number}\n"
    content += f"Table: {order.table.table_number}\n"
    content += f"Waiter: {order.waiter.first_name} {order.waiter.last_name}\n"
    content += f"Date: {order.created_at.strftime('%Y-%m-%d %H:%M:%S')}\n"
    content += "="*32 + "\n\n"
    
    for item in order.items:
        content += f"{item.quantity}x {item.menu_item.name}\n"
        content += f"   ${float(item.unit_price):.2f} each\n"
        content += f"   Subtotal: ${float(item.total_price):.2f}\n"
        if item.special_instructions:
            content += f"   Note: {item.special_instructions}\n"
        content += "\n"
    
    content += "-"*32 + "\n"
    content += f"Subtotal: ${float(order.total_amount):.2f}\n"
    content += f"Tax: ${float(order.tax_amount):.2f}\n"
    if order.discount_amount > 0:
        content += f"Discount: -${float(order.discount_amount):.2f}\n"
    
    final_total = float(order.total_amount) + float(order.tax_amount) - float(order.discount_amount)
    content += f"TOTAL: ${final_total:.2f}\n"
    content += "="*32 + "\n"
    content += "Thank you for dining with us!\n"
    content += "="*32 + "\n\n\n"
    
    return content

@printers_bp.route('/configs', methods=['GET'])
@jwt_required()
def get_printer_configs():
    try:
        current_user_id = get_jwt_identity()
        current_user = User.query.get(current_user_id)
        
        if current_user.role not in ['admin', 'manager']:
            return jsonify({'error': 'Insufficient permissions'}), 403
        
        printers = PrinterConfig.query.filter_by(is_active=True).all()
        printers_data = []
        
        for printer in printers:
            printers_data.append({
                'id': printer.id,
                'name': printer.name,
                'printer_type': printer.printer_type,
                'ip_address': printer.ip_address,
                'port': printer.port,
                'is_active': printer.is_active,
                'created_at': printer.created_at.isoformat()
            })
        
        return jsonify({'printers': printers_data}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@printers_bp.route('/configs', methods=['POST'])
@jwt_required()
def create_printer_config():
    try:
        current_user_id = get_jwt_identity()
        current_user = User.query.get(current_user_id)
        
        if current_user.role not in ['admin', 'manager']:
            return jsonify({'error': 'Insufficient permissions'}), 403
        
        data = request.get_json()
        
        required_fields = ['name', 'printer_type', 'ip_address']
        for field in required_fields:
            if not data.get(field):
                return jsonify({'error': f'{field} is required'}), 400
        
        valid_types = ['kitchen', 'bar', 'receipt']
        if data['printer_type'] not in valid_types:
            return jsonify({'error': 'Invalid printer type'}), 400
        
        new_printer = PrinterConfig(
            name=data['name'],
            printer_type=data['printer_type'],
            ip_address=data['ip_address'],
            port=data.get('port', 9100)
        )
        
        db.session.add(new_printer)
        db.session.commit()
        
        return jsonify({
            'message': 'Printer configuration created successfully',
            'printer': {
                'id': new_printer.id,
                'name': new_printer.name,
                'printer_type': new_printer.printer_type,
                'ip_address': new_printer.ip_address,
                'port': new_printer.port
            }
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@printers_bp.route('/print-order/<int:order_id>', methods=['POST'])
@jwt_required()
def print_order(order_id):
    try:
        order = Order.query.get(order_id)
        if not order:
            return jsonify({'error': 'Order not found'}), 404
        
        data = request.get_json()
        printer_type = data.get('printer_type', 'all')  # 'kitchen', 'bar', 'receipt', or 'all'
        
        results = []
        
        # Get active printers
        if printer_type == 'all':
            printers = PrinterConfig.query.filter_by(is_active=True).all()
        else:
            printers = PrinterConfig.query.filter_by(
                printer_type=printer_type,
                is_active=True
            ).all()
        
        for printer in printers:
            try:
                # Format content based on printer type
                if printer.printer_type == 'kitchen':
                    content = format_kitchen_order(order)
                elif printer.printer_type == 'bar':
                    content = format_bar_order(order)
                elif printer.printer_type == 'receipt':
                    content = format_receipt(order)
                else:
                    continue
                
                # Send to printer
                success, message = send_to_thermal_printer(
                    printer.ip_address,
                    printer.port,
                    content
                )
                
                results.append({
                    'printer_name': printer.name,
                    'printer_type': printer.printer_type,
                    'success': success,
                    'message': message
                })
                
            except Exception as e:
                results.append({
                    'printer_name': printer.name,
                    'printer_type': printer.printer_type,
                    'success': False,
                    'message': str(e)
                })
        
        # Check if any prints were successful
        successful_prints = [r for r in results if r['success']]
        
        return jsonify({
            'message': f'Print job completed. {len(successful_prints)}/{len(results)} printers successful.',
            'results': results
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@printers_bp.route('/test/<int:printer_id>', methods=['POST'])
@jwt_required()
def test_printer(printer_id):
    try:
        current_user_id = get_jwt_identity()
        current_user = User.query.get(current_user_id)
        
        if current_user.role not in ['admin', 'manager']:
            return jsonify({'error': 'Insufficient permissions'}), 403
        
        printer = PrinterConfig.query.get(printer_id)
        if not printer:
            return jsonify({'error': 'Printer not found'}), 404
        
        # Create test content
        test_content = "\n" + "="*32 + "\n"
        test_content += f"PRINTER TEST\n"
        test_content += f"Printer: {printer.name}\n"
        test_content += f"Type: {printer.printer_type}\n"
        test_content += f"IP: {printer.ip_address}:{printer.port}\n"
        test_content += f"Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n"
        test_content += "="*32 + "\n"
        test_content += "This is a test print.\n"
        test_content += "If you can read this,\n"
        test_content += "the printer is working correctly.\n"
        test_content += "="*32 + "\n\n\n"
        
        success, message = send_to_thermal_printer(
            printer.ip_address,
            printer.port,
            test_content
        )
        
        return jsonify({
            'success': success,
            'message': message,
            'printer_name': printer.name
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@printers_bp.route('/configs/<int:printer_id>', methods=['PUT'])
@jwt_required()
def update_printer_config(printer_id):
    try:
        current_user_id = get_jwt_identity()
        current_user = User.query.get(current_user_id)
        
        if current_user.role not in ['admin', 'manager']:
            return jsonify({'error': 'Insufficient permissions'}), 403
        
        printer = PrinterConfig.query.get(printer_id)
        if not printer:
            return jsonify({'error': 'Printer not found'}), 404
        
        data = request.get_json()
        
        # Update fields
        if 'name' in data:
            printer.name = data['name']
        if 'printer_type' in data:
            valid_types = ['kitchen', 'bar', 'receipt']
            if data['printer_type'] not in valid_types:
                return jsonify({'error': 'Invalid printer type'}), 400
            printer.printer_type = data['printer_type']
        if 'ip_address' in data:
            printer.ip_address = data['ip_address']
        if 'port' in data:
            printer.port = data['port']
        if 'is_active' in data:
            printer.is_active = data['is_active']
        
        db.session.commit()
        
        return jsonify({
            'message': 'Printer configuration updated successfully',
            'printer': {
                'id': printer.id,
                'name': printer.name,
                'printer_type': printer.printer_type,
                'ip_address': printer.ip_address,
                'port': printer.port,
                'is_active': printer.is_active
            }
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@printers_bp.route('/configs/<int:printer_id>', methods=['DELETE'])
@jwt_required()
def delete_printer_config(printer_id):
    try:
        current_user_id = get_jwt_identity()
        current_user = User.query.get(current_user_id)
        
        if current_user.role not in ['admin', 'manager']:
            return jsonify({'error': 'Insufficient permissions'}), 403
        
        printer = PrinterConfig.query.get(printer_id)
        if not printer:
            return jsonify({'error': 'Printer not found'}), 404
        
        # Soft delete - just mark as inactive
        printer.is_active = False
        db.session.commit()
        
        return jsonify({'message': 'Printer configuration deleted successfully'}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500