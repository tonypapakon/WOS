from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import Order, OrderItem, MenuItem, User, Table, SalesReport, db
from sqlalchemy import func, and_, extract
from datetime import datetime, timedelta
import calendar

reports_bp = Blueprint('reports', __name__)

@reports_bp.route('/daily-sales', methods=['GET'])
@jwt_required()
def get_daily_sales():
    try:
        current_user_id = get_jwt_identity()
        current_user = User.query.get(current_user_id)
        
        if current_user.role not in ['admin', 'manager']:
            return jsonify({'error': 'Insufficient permissions'}), 403
        
        # Get date parameter or use today
        date_str = request.args.get('date')
        if date_str:
            target_date = datetime.strptime(date_str, '%Y-%m-%d').date()
        else:
            target_date = datetime.now().date()
        
        # Query orders for the specific date
        orders = Order.query.filter(
            func.date(Order.created_at) == target_date,
            Order.status.in_(['served', 'ready'])  # Only completed orders
        ).all()
        
        # Calculate totals
        total_orders = len(orders)
        total_revenue = sum(float(order.total_amount) for order in orders)
        total_tax = sum(float(order.tax_amount) for order in orders)
        total_discounts = sum(float(order.discount_amount) for order in orders)
        average_order_value = total_revenue / total_orders if total_orders > 0 else 0
        
        # Get hourly breakdown
        hourly_sales = {}
        for hour in range(24):
            hourly_sales[f"{hour:02d}:00"] = {
                'orders': 0,
                'revenue': 0
            }
        
        for order in orders:
            hour = order.created_at.hour
            hour_key = f"{hour:02d}:00"
            hourly_sales[hour_key]['orders'] += 1
            hourly_sales[hour_key]['revenue'] += float(order.total_amount)
        
        # Get top selling items
        item_sales = db.session.query(
            MenuItem.name,
            func.sum(OrderItem.quantity).label('total_quantity'),
            func.sum(OrderItem.total_price).label('total_revenue')
        ).join(OrderItem).join(Order).filter(
            func.date(Order.created_at) == target_date,
            Order.status.in_(['served', 'ready'])
        ).group_by(MenuItem.id, MenuItem.name).order_by(
            func.sum(OrderItem.quantity).desc()
        ).limit(10).all()
        
        top_items = []
        for item in item_sales:
            top_items.append({
                'name': item.name,
                'quantity_sold': int(item.total_quantity),
                'revenue': float(item.total_revenue)
            })
        
        # Get waiter performance
        waiter_performance = db.session.query(
            User.first_name,
            User.last_name,
            func.count(Order.id).label('orders_count'),
            func.sum(Order.total_amount).label('total_sales')
        ).join(Order).filter(
            func.date(Order.created_at) == target_date,
            Order.status.in_(['served', 'ready'])
        ).group_by(User.id, User.first_name, User.last_name).order_by(
            func.sum(Order.total_amount).desc()
        ).all()
        
        waiters = []
        for waiter in waiter_performance:
            waiters.append({
                'name': f"{waiter.first_name} {waiter.last_name}",
                'orders_count': int(waiter.orders_count),
                'total_sales': float(waiter.total_sales)
            })
        
        return jsonify({
            'date': target_date.isoformat(),
            'summary': {
                'total_orders': total_orders,
                'total_revenue': round(total_revenue, 2),
                'total_tax': round(total_tax, 2),
                'total_discounts': round(total_discounts, 2),
                'average_order_value': round(average_order_value, 2),
                'net_revenue': round(total_revenue + total_tax - total_discounts, 2)
            },
            'hourly_breakdown': hourly_sales,
            'top_selling_items': top_items,
            'waiter_performance': waiters
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@reports_bp.route('/weekly-sales', methods=['GET'])
@jwt_required()
def get_weekly_sales():
    try:
        current_user_id = get_jwt_identity()
        current_user = User.query.get(current_user_id)
        
        if current_user.role not in ['admin', 'manager']:
            return jsonify({'error': 'Insufficient permissions'}), 403
        
        # Get week start date or use current week
        week_start_str = request.args.get('week_start')
        if week_start_str:
            week_start = datetime.strptime(week_start_str, '%Y-%m-%d').date()
        else:
            today = datetime.now().date()
            week_start = today - timedelta(days=today.weekday())
        
        week_end = week_start + timedelta(days=6)
        
        # Query orders for the week
        orders = Order.query.filter(
            and_(
                func.date(Order.created_at) >= week_start,
                func.date(Order.created_at) <= week_end
            ),
            Order.status.in_(['served', 'ready'])
        ).all()
        
        # Calculate weekly totals
        total_orders = len(orders)
        total_revenue = sum(float(order.total_amount) for order in orders)
        total_tax = sum(float(order.tax_amount) for order in orders)
        total_discounts = sum(float(order.discount_amount) for order in orders)
        
        # Daily breakdown
        daily_sales = {}
        for i in range(7):
            day = week_start + timedelta(days=i)
            daily_sales[day.isoformat()] = {
                'day_name': calendar.day_name[day.weekday()],
                'orders': 0,
                'revenue': 0
            }
        
        for order in orders:
            order_date = order.created_at.date()
            if order_date.isoformat() in daily_sales:
                daily_sales[order_date.isoformat()]['orders'] += 1
                daily_sales[order_date.isoformat()]['revenue'] += float(order.total_amount)
        
        return jsonify({
            'week_start': week_start.isoformat(),
            'week_end': week_end.isoformat(),
            'summary': {
                'total_orders': total_orders,
                'total_revenue': round(total_revenue, 2),
                'total_tax': round(total_tax, 2),
                'total_discounts': round(total_discounts, 2),
                'net_revenue': round(total_revenue + total_tax - total_discounts, 2),
                'average_daily_revenue': round(total_revenue / 7, 2)
            },
            'daily_breakdown': daily_sales
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@reports_bp.route('/monthly-sales', methods=['GET'])
@jwt_required()
def get_monthly_sales():
    try:
        current_user_id = get_jwt_identity()
        current_user = User.query.get(current_user_id)
        
        if current_user.role not in ['admin', 'manager']:
            return jsonify({'error': 'Insufficient permissions'}), 403
        
        # Get month and year parameters
        year = int(request.args.get('year', datetime.now().year))
        month = int(request.args.get('month', datetime.now().month))
        
        # Query orders for the month
        orders = Order.query.filter(
            and_(
                extract('year', Order.created_at) == year,
                extract('month', Order.created_at) == month
            ),
            Order.status.in_(['served', 'ready'])
        ).all()
        
        # Calculate monthly totals
        total_orders = len(orders)
        total_revenue = sum(float(order.total_amount) for order in orders)
        total_tax = sum(float(order.tax_amount) for order in orders)
        total_discounts = sum(float(order.discount_amount) for order in orders)
        
        # Get number of days in month
        days_in_month = calendar.monthrange(year, month)[1]
        
        # Daily breakdown
        daily_sales = {}
        for day in range(1, days_in_month + 1):
            date_key = f"{year}-{month:02d}-{day:02d}"
            daily_sales[date_key] = {
                'orders': 0,
                'revenue': 0
            }
        
        for order in orders:
            order_date = order.created_at.date()
            date_key = order_date.isoformat()
            if date_key in daily_sales:
                daily_sales[date_key]['orders'] += 1
                daily_sales[date_key]['revenue'] += float(order.total_amount)
        
        return jsonify({
            'year': year,
            'month': month,
            'month_name': calendar.month_name[month],
            'summary': {
                'total_orders': total_orders,
                'total_revenue': round(total_revenue, 2),
                'total_tax': round(total_tax, 2),
                'total_discounts': round(total_discounts, 2),
                'net_revenue': round(total_revenue + total_tax - total_discounts, 2),
                'average_daily_revenue': round(total_revenue / days_in_month, 2)
            },
            'daily_breakdown': daily_sales
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@reports_bp.route('/order-history', methods=['GET'])
@jwt_required()
def get_order_history():
    try:
        current_user_id = get_jwt_identity()
        current_user = User.query.get(current_user_id)
        
        # Get query parameters
        waiter_id = request.args.get('waiter_id')
        table_id = request.args.get('table_id')
        date_from = request.args.get('date_from')
        date_to = request.args.get('date_to')
        status = request.args.get('status')
        page = int(request.args.get('page', 1))
        per_page = int(request.args.get('per_page', 50))
        
        # Build query
        query = Order.query
        
        # Permission check
        if current_user.role == 'waiter':
            query = query.filter_by(user_id=current_user_id)
        elif waiter_id and current_user.role in ['admin', 'manager']:
            query = query.filter_by(user_id=waiter_id)
        
        if table_id:
            query = query.filter_by(table_id=table_id)
        
        if date_from:
            query = query.filter(Order.created_at >= datetime.fromisoformat(date_from))
        
        if date_to:
            query = query.filter(Order.created_at <= datetime.fromisoformat(date_to))
        
        if status:
            query = query.filter_by(status=status)
        
        # Execute paginated query
        orders_pagination = query.order_by(Order.created_at.desc()).paginate(
            page=page, per_page=per_page, error_out=False
        )
        
        orders_data = []
        for order in orders_pagination.items:
            orders_data.append({
                'id': order.id,
                'order_number': order.order_number,
                'table_number': order.table.table_number,
                'waiter_name': f"{order.waiter.first_name} {order.waiter.last_name}",
                'status': order.status,
                'total_amount': float(order.total_amount),
                'items_count': len(order.items),
                'created_at': order.created_at.isoformat(),
                'updated_at': order.updated_at.isoformat()
            })
        
        return jsonify({
            'orders': orders_data,
            'pagination': {
                'page': page,
                'per_page': per_page,
                'total': orders_pagination.total,
                'pages': orders_pagination.pages,
                'has_next': orders_pagination.has_next,
                'has_prev': orders_pagination.has_prev
            }
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@reports_bp.route('/menu-performance', methods=['GET'])
@jwt_required()
def get_menu_performance():
    try:
        current_user_id = get_jwt_identity()
        current_user = User.query.get(current_user_id)
        
        if current_user.role not in ['admin', 'manager']:
            return jsonify({'error': 'Insufficient permissions'}), 403
        
        # Get date range parameters
        date_from = request.args.get('date_from')
        date_to = request.args.get('date_to')
        
        # Default to last 30 days if no dates provided
        if not date_from:
            date_from = (datetime.now() - timedelta(days=30)).isoformat()
        if not date_to:
            date_to = datetime.now().isoformat()
        
        # Query menu item performance
        item_performance = db.session.query(
            MenuItem.id,
            MenuItem.name,
            MenuItem.price,
            func.sum(OrderItem.quantity).label('total_quantity'),
            func.sum(OrderItem.total_price).label('total_revenue'),
            func.count(func.distinct(Order.id)).label('orders_count')
        ).join(OrderItem).join(Order).filter(
            and_(
                Order.created_at >= datetime.fromisoformat(date_from),
                Order.created_at <= datetime.fromisoformat(date_to)
            ),
            Order.status.in_(['served', 'ready'])
        ).group_by(MenuItem.id, MenuItem.name, MenuItem.price).order_by(
            func.sum(OrderItem.quantity).desc()
        ).all()
        
        performance_data = []
        for item in item_performance:
            performance_data.append({
                'menu_item_id': item.id,
                'name': item.name,
                'unit_price': float(item.price),
                'quantity_sold': int(item.total_quantity),
                'total_revenue': float(item.total_revenue),
                'orders_count': int(item.orders_count),
                'average_quantity_per_order': round(float(item.total_quantity) / int(item.orders_count), 2)
            })
        
        return jsonify({
            'date_from': date_from,
            'date_to': date_to,
            'menu_performance': performance_data
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500