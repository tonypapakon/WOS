"""
Database migration utilities for the Wireless Ordering System
"""

from flask import current_app
from models import db, User, Order, OrderItem, SystemConfig, AuditLog, RefreshToken
from sqlalchemy import text, and_
from datetime import datetime, timedelta
import json

def run_migrations():
    """
    Run database migrations to update schema
    """
    try:
        print("🔄 Running database migrations...")
        
        # Create all tables (this will create new tables and skip existing ones)
        db.create_all()
        
        # Add new columns to existing tables if they don't exist
        add_user_security_columns()
        add_order_enhancements()
        add_system_configs()
        add_reservations_table()
        
        print("✅ Database migrations completed successfully!")
        
    except Exception as e:
        print(f"❌ Migration failed: {str(e)}")
        db.session.rollback()
        raise

def add_user_security_columns():
    """
    Add security-related columns to users table
    """
    try:
        # Check if columns exist before adding them
        inspector = db.inspect(db.engine)
        user_columns = [col['name'] for col in inspector.get_columns('users')]
        
        columns_to_add = [
            ('failed_login_attempts', 'INTEGER DEFAULT 0'),
            ('locked_until', 'DATETIME'),
            ('last_login', 'DATETIME'),
            ('password_changed_at', 'DATETIME DEFAULT CURRENT_TIMESTAMP')
        ]
        
        for column_name, column_def in columns_to_add:
            if column_name not in user_columns:
                try:
                    with db.engine.connect() as conn:
                        conn.execute(text(f'ALTER TABLE users ADD COLUMN {column_name} {column_def}'))
                        conn.commit()
                    print(f"✅ Added column {column_name} to users table")
                except Exception as e:
                    print(f"⚠️  Could not add column {column_name}: {str(e)}")
        
    except Exception as e:
        print(f"⚠️  Error adding user security columns: {str(e)}")

def add_order_enhancements():
    """
    Add enhanced columns to orders table
    """
    try:
        inspector = db.inspect(db.engine)
        order_columns = [col['name'] for col in inspector.get_columns('orders')]
        
        columns_to_add = [
            ('customer_name', 'VARCHAR(100)'),
            ('customer_phone', 'VARCHAR(20)'),
            ('customer_email', 'VARCHAR(120)'),
            ('customer_address', 'TEXT'),
            ('estimated_ready_time', 'DATETIME'),
            ('location_id', 'INTEGER')
        ]
        
        for column_name, column_def in columns_to_add:
            if column_name not in order_columns:
                try:
                    with db.engine.connect() as conn:
                        conn.execute(text(f'ALTER TABLE orders ADD COLUMN {column_name} {column_def}'))
                        conn.commit()
                    print(f"✅ Added column {column_name} to orders table")
                except Exception as e:
                    print(f"⚠️  Could not add column {column_name}: {str(e)}")
        
        # Make table_id nullable for takeaway orders
        try:
            with db.engine.connect() as conn:
                conn.execute(text('ALTER TABLE orders ALTER COLUMN table_id DROP NOT NULL'))
                conn.commit()
            print("✅ Made table_id nullable in orders table")
        except Exception as e:
            print(f"⚠️  Could not modify table_id column: {str(e)}")
        
    except Exception as e:
        print(f"⚠️  Error adding order enhancements: {str(e)}")

def add_system_configs():
    """
    Add default system configurations
    """
    try:
        default_configs = [
            {
                'key': 'tax_rate',
                'value': '0.10',
                'description': 'Default tax rate for orders',
                'data_type': 'float',
                'is_public': True
            },
            {
                'key': 'currency',
                'value': 'EUR',
                'description': 'Default currency symbol',
                'data_type': 'string',
                'is_public': True
            },
            {
                'key': 'order_timeout_minutes',
                'value': '30',
                'description': 'Minutes before pending orders are auto-cancelled',
                'data_type': 'integer',
                'is_public': False
            },
            {
                'key': 'max_login_attempts',
                'value': '5',
                'description': 'Maximum failed login attempts before account lockout',
                'data_type': 'integer',
                'is_public': False
            },
            {
                'key': 'lockout_duration_minutes',
                'value': '30',
                'description': 'Account lockout duration in minutes',
                'data_type': 'integer',
                'is_public': False
            },
            {
                'key': 'enable_audit_logging',
                'value': 'true',
                'description': 'Enable audit logging for user actions',
                'data_type': 'boolean',
                'is_public': False
            },
            {
                'key': 'business_hours',
                'value': json.dumps({
                    'monday': {'open': '08:00', 'close': '22:00'},
                    'tuesday': {'open': '08:00', 'close': '22:00'},
                    'wednesday': {'open': '08:00', 'close': '22:00'},
                    'thursday': {'open': '08:00', 'close': '22:00'},
                    'friday': {'open': '08:00', 'close': '23:00'},
                    'saturday': {'open': '09:00', 'close': '23:00'},
                    'sunday': {'open': '09:00', 'close': '21:00'}
                }),
                'description': 'Business operating hours',
                'data_type': 'json',
                'is_public': True
            }
        ]
        
        for config_data in default_configs:
            existing = SystemConfig.query.filter_by(key=config_data['key']).first()
            if not existing:
                config = SystemConfig(**config_data)
                db.session.add(config)
                print(f"✅ Added system config: {config_data['key']}")
        
        db.session.commit()
        
    except Exception as e:
        print(f"⚠️  Error adding system configs: {str(e)}")
        db.session.rollback()

def add_reservations_table():
    """
    Create reservations table if it doesn't exist
    """
    try:
        inspector = db.inspect(db.engine)
        tables = inspector.get_table_names()
        
        if 'reservations' not in tables:
            # Create reservations table manually
            create_table_sql = """
            CREATE TABLE reservations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                table_id INTEGER NOT NULL,
                customer_name VARCHAR(100) NOT NULL,
                customer_phone VARCHAR(20),
                customer_email VARCHAR(120),
                party_size INTEGER NOT NULL,
                reservation_date DATETIME NOT NULL,
                status VARCHAR(20) DEFAULT 'confirmed',
                notes TEXT,
                created_by INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (table_id) REFERENCES tables(id),
                FOREIGN KEY (created_by) REFERENCES users(id)
            )
            """
            
            with db.engine.connect() as conn:
                conn.execute(text(create_table_sql))
                conn.commit()
            
            # Create indexes for reservations table
            reservation_indexes = [
                'CREATE INDEX idx_reservations_table_date ON reservations(table_id, reservation_date)',
                'CREATE INDEX idx_reservations_status_date ON reservations(status, reservation_date)',
                'CREATE INDEX idx_reservations_customer ON reservations(customer_name, customer_phone)',
                'CREATE INDEX idx_reservations_created ON reservations(created_at)'
            ]
            
            for index_sql in reservation_indexes:
                try:
                    with db.engine.connect() as conn:
                        conn.execute(text(index_sql))
                        conn.commit()
                except Exception as e:
                    print(f"⚠️  Could not create reservation index: {str(e)}")
            
            print("✅ Created reservations table with indexes")
        else:
            print("✅ Reservations table already exists")
        
    except Exception as e:
        print(f"⚠️  Error creating reservations table: {str(e)}")

def create_indexes():
    """
    Create database indexes for better performance
    """
    try:
        print("🔄 Creating database indexes...")
        
        indexes = [
            # User indexes
            'CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)',
            'CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)',
            'CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)',
            'CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active)',
            'CREATE INDEX IF NOT EXISTS idx_users_location ON users(location_id)',
            'CREATE INDEX IF NOT EXISTS idx_users_created ON users(created_at)',
            
            # Order indexes
            'CREATE INDEX IF NOT EXISTS idx_orders_number ON orders(order_number)',
            'CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status)',
            'CREATE INDEX IF NOT EXISTS idx_orders_type ON orders(order_type)',
            'CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id)',
            'CREATE INDEX IF NOT EXISTS idx_orders_table ON orders(table_id)',
            'CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at)',
            'CREATE INDEX IF NOT EXISTS idx_orders_total ON orders(total_amount)',
            
            # Order items indexes
            'CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id)',
            'CREATE INDEX IF NOT EXISTS idx_order_items_menu ON order_items(menu_item_id)',
            'CREATE INDEX IF NOT EXISTS idx_order_items_status ON order_items(status)',
            'CREATE INDEX IF NOT EXISTS idx_order_items_created ON order_items(created_at)',
            
            # Menu item indexes
            'CREATE INDEX IF NOT EXISTS idx_menu_items_name ON menu_items(name)',
            'CREATE INDEX IF NOT EXISTS idx_menu_items_category ON menu_items(category_id)',
            'CREATE INDEX IF NOT EXISTS idx_menu_items_available ON menu_items(is_available)',
            'CREATE INDEX IF NOT EXISTS idx_menu_items_takeaway ON menu_items(is_available_takeaway)',
            'CREATE INDEX IF NOT EXISTS idx_menu_items_price ON menu_items(price)',
            'CREATE INDEX IF NOT EXISTS idx_menu_items_created ON menu_items(created_at)',
            
            # Table indexes
            'CREATE INDEX IF NOT EXISTS idx_tables_number ON tables(table_number)',
            'CREATE INDEX IF NOT EXISTS idx_tables_location ON tables(location_id)',
            'CREATE INDEX IF NOT EXISTS idx_tables_status ON tables(status)',
            'CREATE INDEX IF NOT EXISTS idx_tables_active ON tables(is_active)',
            
            # Category indexes
            'CREATE INDEX IF NOT EXISTS idx_categories_name ON menu_categories(name)',
            'CREATE INDEX IF NOT EXISTS idx_categories_active ON menu_categories(is_active)',
            'CREATE INDEX IF NOT EXISTS idx_categories_sort ON menu_categories(sort_order)',
            'CREATE INDEX IF NOT EXISTS idx_categories_printer ON menu_categories(printer_destination)',
            
            # Location indexes
            'CREATE INDEX IF NOT EXISTS idx_locations_name ON locations(name)',
            'CREATE INDEX IF NOT EXISTS idx_locations_active ON locations(is_active)',
            
            # Audit log indexes
            'CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id)',
            'CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action)',
            'CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource_type)',
            'CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at)',
            
            # Refresh token indexes
            'CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id)',
            'CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token ON refresh_tokens(token)',
            'CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires ON refresh_tokens(expires_at)',
            'CREATE INDEX IF NOT EXISTS idx_refresh_tokens_revoked ON refresh_tokens(is_revoked)',
            
            # System config indexes
            'CREATE INDEX IF NOT EXISTS idx_system_configs_key ON system_configs(key)',
            'CREATE INDEX IF NOT EXISTS idx_system_configs_public ON system_configs(is_public)',
        ]
        
        for index_sql in indexes:
            try:
                with db.engine.connect() as conn:
                    conn.execute(text(index_sql))
                    conn.commit()
            except Exception as e:
                # Index might already exist, which is fine
                pass
        
        print("✅ Database indexes created successfully!")
        
    except Exception as e:
        print(f"⚠️  Error creating indexes: {str(e)}")

def cleanup_old_data():
    """
    Clean up old data to maintain performance
    """
    try:
        print("🔄 Cleaning up old data...")
        
        # Clean up old audit logs (keep last 6 months)
        six_months_ago = datetime.utcnow() - timedelta(days=180)
        old_logs = AuditLog.query.filter(AuditLog.created_at < six_months_ago).count()
        
        if old_logs > 0:
            AuditLog.query.filter(AuditLog.created_at < six_months_ago).delete()
            print(f"✅ Cleaned up {old_logs} old audit log entries")
        
        # Clean up expired refresh tokens
        expired_tokens = RefreshToken.query.filter(
            RefreshToken.expires_at < datetime.utcnow()
        ).count()
        
        if expired_tokens > 0:
            RefreshToken.query.filter(
                RefreshToken.expires_at < datetime.utcnow()
            ).delete()
            print(f"✅ Cleaned up {expired_tokens} expired refresh tokens")
        
        # Clean up old completed orders (keep last year)
        one_year_ago = datetime.utcnow() - timedelta(days=365)
        old_orders = Order.query.filter(
            and_(
                Order.created_at < one_year_ago,
                Order.status.in_(['served', 'cancelled'])
            )
        ).count()
        
        if old_orders > 0:
            print(f"⚠️  Found {old_orders} old completed orders (keeping for historical data)")
        
        db.session.commit()
        print("✅ Data cleanup completed!")
        
    except Exception as e:
        print(f"⚠️  Error during data cleanup: {str(e)}")
        db.session.rollback()

def verify_data_integrity():
    """
    Verify data integrity and fix common issues
    """
    try:
        print("🔄 Verifying data integrity...")
        
        # Check for orders without valid users
        orphaned_orders = Order.query.filter(
            ~Order.user_id.in_(db.session.query(User.id))
        ).count()
        
        if orphaned_orders > 0:
            print(f"⚠️  Found {orphaned_orders} orders with invalid user references")
        
        # Check for order items without valid orders
        orphaned_items = OrderItem.query.filter(
            ~OrderItem.order_id.in_(db.session.query(Order.id))
        ).count()
        
        if orphaned_items > 0:
            print(f"⚠️  Found {orphaned_items} order items with invalid order references")
        
        # Check for inconsistent order totals
        inconsistent_orders = []
        orders = Order.query.all()
        
        for order in orders:
            calculated_total = sum(item.total_price for item in order.items)
            if abs(float(order.total_amount) - float(calculated_total)) > 0.01:
                inconsistent_orders.append(order.id)
        
        if inconsistent_orders:
            print(f"⚠️  Found {len(inconsistent_orders)} orders with inconsistent totals")
        
        print("✅ Data integrity check completed!")
        
    except Exception as e:
        print(f"⚠️  Error during data integrity check: {str(e)}")

if __name__ == '__main__':
    from app import app
    
    with app.app_context():
        run_migrations()
        create_indexes()
        cleanup_old_data()
        verify_data_integrity()