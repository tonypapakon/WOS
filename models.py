from flask_sqlalchemy import SQLAlchemy
from datetime import datetime, timedelta
from werkzeug.security import generate_password_hash, check_password_hash
from sqlalchemy import Index, event, func
from sqlalchemy.ext.hybrid import hybrid_property
import re
import secrets

db = SQLAlchemy()

class User(db.Model):
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False, index=True)
    email = db.Column(db.String(120), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    first_name = db.Column(db.String(50), nullable=False)
    last_name = db.Column(db.String(50), nullable=False)
    role = db.Column(db.String(20), nullable=False, default='waiter', index=True)
    location_id = db.Column(db.Integer, db.ForeignKey('locations.id'), index=True)
    is_active = db.Column(db.Boolean, default=True, index=True)
    failed_login_attempts = db.Column(db.Integer, default=0)
    locked_until = db.Column(db.DateTime)
    last_login = db.Column(db.DateTime)
    password_changed_at = db.Column(db.DateTime, default=datetime.utcnow)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, index=True)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationship to location
    user_location = db.relationship('Location', backref='users')
    
    # Database indexes for performance
    __table_args__ = (
        Index('idx_user_role_active', 'role', 'is_active'),
        Index('idx_user_location_role', 'location_id', 'role'),
    )
    
    @hybrid_property
    def full_name(self):
        return f"{self.first_name} {self.last_name}"
    
    @hybrid_property
    def is_locked(self):
        return self.locked_until and self.locked_until > datetime.utcnow()
    
    def set_password(self, password):
        """Set password with validation"""
        if not self.validate_password_strength(password):
            raise ValueError("Password does not meet security requirements")
        self.password_hash = generate_password_hash(password)
        self.password_changed_at = datetime.utcnow()
        self.failed_login_attempts = 0
        self.locked_until = None
    
    def check_password(self, password):
        """Check password and handle failed attempts"""
        if self.is_locked:
            return False
        
        if check_password_hash(self.password_hash, password):
            self.failed_login_attempts = 0
            self.locked_until = None
            self.last_login = datetime.utcnow()
            return True
        else:
            self.failed_login_attempts += 1
            if self.failed_login_attempts >= 5:
                self.locked_until = datetime.utcnow() + timedelta(minutes=30)
            return False
    
    @staticmethod
    def validate_password_strength(password):
        """Validate password strength"""
        if len(password) < 8:
            return False
        if not re.search(r'[A-Z]', password):
            return False
        if not re.search(r'[a-z]', password):
            return False
        if not re.search(r'\d', password):
            return False
        return True
    
    @staticmethod
    def validate_email(email):
        """Validate email format"""
        pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        return re.match(pattern, email) is not None
    
    def to_dict(self, include_sensitive=False):
        data = {
            'id': self.id,
            'username': self.username,
            'email': self.email,
            'first_name': self.first_name,
            'last_name': self.last_name,
            'full_name': self.full_name,
            'role': self.role,
            'location_id': self.location_id,
            'is_active': self.is_active,
            'last_login': self.last_login.isoformat() if self.last_login else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
        
        if include_sensitive:
            data.update({
                'failed_login_attempts': self.failed_login_attempts,
                'is_locked': self.is_locked,
                'locked_until': self.locked_until.isoformat() if self.locked_until else None,
                'password_changed_at': self.password_changed_at.isoformat() if self.password_changed_at else None
            })
        
        return data

class Location(db.Model):
    __tablename__ = 'locations'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), nullable=False, unique=True, index=True)
    display_name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text)
    address = db.Column(db.Text)
    is_active = db.Column(db.Boolean, default=True, index=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, index=True)
    
    tables = db.relationship('Table', backref='location', lazy=True)
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'display_name': self.display_name,
            'description': self.description,
            'address': self.address,
            'is_active': self.is_active,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

class Table(db.Model):
    __tablename__ = 'tables'
    
    id = db.Column(db.Integer, primary_key=True)
    table_number = db.Column(db.String(10), nullable=False, index=True)
    location_id = db.Column(db.Integer, db.ForeignKey('locations.id'), nullable=False, index=True)
    capacity = db.Column(db.Integer, default=4)
    status = db.Column(db.String(20), default='available', index=True)
    qr_code = db.Column(db.String(255))
    x_position = db.Column(db.Integer, default=0)
    y_position = db.Column(db.Integer, default=0)
    is_active = db.Column(db.Boolean, default=True, index=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    orders = db.relationship('Order', backref='table', lazy=True)
    
    # Database indexes for performance
    __table_args__ = (
        Index('idx_table_location_status', 'location_id', 'status'),
        Index('idx_table_number_location', 'table_number', 'location_id'),
    )
    
    def to_dict(self):
        return {
            'id': self.id,
            'table_number': self.table_number,
            'location_id': self.location_id,
            'location': self.location.to_dict() if self.location else None,
            'capacity': self.capacity,
            'status': self.status,
            'qr_code': self.qr_code,
            'x_position': self.x_position,
            'y_position': self.y_position,
            'is_active': self.is_active,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

class Category(db.Model):
    __tablename__ = 'menu_categories'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False, index=True)
    description = db.Column(db.Text)
    image_url = db.Column(db.String(255))
    sort_order = db.Column(db.Integer, default=0, index=True)
    printer_destination = db.Column(db.String(50), default='kitchen', index=True)
    is_active = db.Column(db.Boolean, default=True, index=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    menu_items = db.relationship('MenuItem', backref='category', lazy=True)
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'image_url': self.image_url,
            'sort_order': self.sort_order,
            'printer_destination': self.printer_destination,
            'is_active': self.is_active,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

class MenuItem(db.Model):
    __tablename__ = 'menu_items'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False, index=True)
    barcode = db.Column(db.String(50), unique=True, index=True)
    description = db.Column(db.Text)
    price = db.Column(db.Numeric(10, 2), nullable=False, index=True)
    takeaway_price = db.Column(db.Numeric(10, 2))
    beach_bar_price = db.Column(db.Numeric(10, 2))
    takeaway_description = db.Column(db.Text)
    category_id = db.Column(db.Integer, db.ForeignKey('menu_categories.id'), nullable=False, index=True)
    image_url = db.Column(db.String(255))
    is_available = db.Column(db.Boolean, default=True, index=True)
    is_available_takeaway = db.Column(db.Boolean, default=True, index=True)
    is_takeaway_only = db.Column(db.Boolean, default=False, index=True)
    is_active = db.Column(db.Boolean, default=True, index=True)
    preparation_time = db.Column(db.Integer, default=15)
    takeaway_preparation_time = db.Column(db.Integer)
    allergens = db.Column(db.Text)
    nutritional_info = db.Column(db.Text)
    sort_order = db.Column(db.Integer, default=0, index=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, index=True)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Database indexes for performance
    __table_args__ = (
        Index('idx_menu_category_active', 'category_id', 'is_active'),
        Index('idx_menu_available_takeaway', 'is_available', 'is_available_takeaway'),
        Index('idx_menu_price_range', 'price'),
    )
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'barcode': self.barcode,
            'description': self.description,
            'price': float(self.price),
            'takeaway_price': float(self.takeaway_price) if self.takeaway_price else None,
            'beach_bar_price': float(self.beach_bar_price) if self.beach_bar_price else None,
            'takeaway_description': self.takeaway_description,
            'category_id': self.category_id,
            'category': self.category.to_dict() if self.category else None,
            'image_url': self.image_url,
            'is_available': self.is_available,
            'is_available_takeaway': self.is_available_takeaway,
            'is_takeaway_only': self.is_takeaway_only,
            'is_active': self.is_active,
            'preparation_time': self.preparation_time,
            'takeaway_preparation_time': self.takeaway_preparation_time,
            'allergens': self.allergens,
            'nutritional_info': self.nutritional_info,
            'sort_order': self.sort_order,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

class Order(db.Model):
    __tablename__ = 'orders'
    
    id = db.Column(db.Integer, primary_key=True)
    order_number = db.Column(db.String(20), unique=True, nullable=False, index=True)
    table_id = db.Column(db.Integer, db.ForeignKey('tables.id'), nullable=True, index=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), index=True)
    status = db.Column(db.String(20), default='pending', index=True)
    order_type = db.Column(db.String(20), default='dine_in', index=True)
    subtotal = db.Column(db.Numeric(10, 2), default=0)
    tax_amount = db.Column(db.Numeric(10, 2), default=0)
    discount_amount = db.Column(db.Numeric(10, 2), default=0)
    total_amount = db.Column(db.Numeric(10, 2), default=0, index=True)
    notes = db.Column(db.Text)
    customer_name = db.Column(db.String(100))
    estimated_ready_time = db.Column(db.DateTime)
    location_id = db.Column(db.Integer, db.ForeignKey('locations.id'), index=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, index=True)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    items = db.relationship('OrderItem', backref='order', lazy=True, cascade='all, delete-orphan')
    waiter = db.relationship('User', backref='orders')
    
    # Database indexes for performance
    __table_args__ = (
        Index('idx_order_status_created', 'status', 'created_at'),
        Index('idx_order_user_date', 'user_id', 'created_at'),
        Index('idx_order_table_status', 'table_id', 'status'),
        Index('idx_order_type_date', 'order_type', 'created_at'),
    )
    
    @hybrid_property
    def final_total(self):
        return self.total_amount + self.tax_amount - self.discount_amount
    
    def to_dict(self):
        return {
            'id': self.id,
            'order_number': self.order_number,
            'table_id': self.table_id,
            'table': self.table.to_dict() if self.table else None,
            'user_id': self.user_id,
            'user': self.waiter.to_dict() if self.waiter else None,
            'status': self.status,
            'order_type': self.order_type,
            'subtotal': float(self.subtotal),
            'tax_amount': float(self.tax_amount),
            'discount_amount': float(self.discount_amount),
            'total_amount': float(self.total_amount),
            'final_total': float(self.final_total),
            'notes': self.notes,
            'customer_name': self.customer_name,
            'estimated_ready_time': self.estimated_ready_time.isoformat() if self.estimated_ready_time else None,
            'location_id': self.location_id,
            'items': [item.to_dict() for item in self.items],
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

class OrderItem(db.Model):
    __tablename__ = 'order_items'
    
    id = db.Column(db.Integer, primary_key=True)
    order_id = db.Column(db.Integer, db.ForeignKey('orders.id'), nullable=False, index=True)
    menu_item_id = db.Column(db.Integer, db.ForeignKey('menu_items.id'), nullable=False, index=True)
    quantity = db.Column(db.Integer, nullable=False, default=1)
    unit_price = db.Column(db.Numeric(10, 2), nullable=False)
    total_price = db.Column(db.Numeric(10, 2), nullable=False)
    special_instructions = db.Column(db.Text)
    status = db.Column(db.String(20), default='pending', index=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, index=True)
    
    menu_item = db.relationship('MenuItem', backref='order_items')
    
    # Database indexes for performance
    __table_args__ = (
        Index('idx_order_item_status', 'order_id', 'status'),
        Index('idx_order_item_menu', 'menu_item_id', 'created_at'),
    )
    
    def to_dict(self):
        return {
            'id': self.id,
            'order_id': self.order_id,
            'menu_item_id': self.menu_item_id,
            'menu_item': self.menu_item.to_dict() if self.menu_item else None,
            'quantity': self.quantity,
            'unit_price': float(self.unit_price),
            'total_price': float(self.total_price),
            'special_instructions': self.special_instructions,
            'status': self.status,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

class Printer(db.Model):
    __tablename__ = 'printers'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    printer_type = db.Column(db.String(20), nullable=False, index=True)
    ip_address = db.Column(db.String(15))
    port = db.Column(db.Integer, default=9100)
    is_active = db.Column(db.Boolean, default=True, index=True)
    location_id = db.Column(db.Integer, db.ForeignKey('locations.id'), index=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'printer_type': self.printer_type,
            'ip_address': self.ip_address,
            'port': self.port,
            'is_active': self.is_active,
            'location_id': self.location_id,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

# Alias for backward compatibility
MenuCategory = Category

class TableAssignment(db.Model):
    __tablename__ = 'table_assignments'
    
    id = db.Column(db.Integer, primary_key=True)
    table_id = db.Column(db.Integer, db.ForeignKey('tables.id'), nullable=False, index=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    assigned_at = db.Column(db.DateTime, default=datetime.utcnow, index=True)
    is_active = db.Column(db.Boolean, default=True, index=True)
    
    table = db.relationship('Table', backref='assignments')
    user = db.relationship('User', backref='table_assignments')
    
    # Database indexes for performance
    __table_args__ = (
        Index('idx_assignment_user_active', 'user_id', 'is_active'),
        Index('idx_assignment_table_active', 'table_id', 'is_active'),
    )
    
    def to_dict(self):
        return {
            'id': self.id,
            'table_id': self.table_id,
            'user_id': self.user_id,
            'table': self.table.to_dict() if self.table else None,
            'user': self.user.to_dict() if self.user else None,
            'assigned_at': self.assigned_at.isoformat() if self.assigned_at else None,
            'is_active': self.is_active
        }

class SalesReport(db.Model):
    __tablename__ = 'sales_reports'
    
    id = db.Column(db.Integer, primary_key=True)
    date = db.Column(db.Date, nullable=False, index=True)
    location_id = db.Column(db.Integer, db.ForeignKey('locations.id'), index=True)
    total_sales = db.Column(db.Numeric(10, 2), default=0)
    total_orders = db.Column(db.Integer, default=0)
    average_order_value = db.Column(db.Numeric(10, 2), default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Database indexes for performance
    __table_args__ = (
        Index('idx_sales_date_location', 'date', 'location_id'),
    )
    
    def to_dict(self):
        return {
            'id': self.id,
            'date': self.date.isoformat() if self.date else None,
            'location_id': self.location_id,
            'total_sales': float(self.total_sales),
            'total_orders': self.total_orders,
            'average_order_value': float(self.average_order_value),
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

class PrinterConfig(db.Model):
    __tablename__ = 'printer_configs'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    printer_type = db.Column(db.String(20), nullable=False, index=True)
    ip_address = db.Column(db.String(15))
    port = db.Column(db.Integer, default=9100)
    is_active = db.Column(db.Boolean, default=True, index=True)
    location_id = db.Column(db.Integer, db.ForeignKey('locations.id'), index=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'printer_type': self.printer_type,
            'ip_address': self.ip_address,
            'port': self.port,
            'is_active': self.is_active,
            'location_id': self.location_id,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

# New models for enhanced functionality

class AuditLog(db.Model):
    __tablename__ = 'audit_logs'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), index=True)
    action = db.Column(db.String(100), nullable=False, index=True)
    resource_type = db.Column(db.String(50), nullable=False, index=True)
    resource_id = db.Column(db.Integer, index=True)
    old_values = db.Column(db.Text)  # JSON string
    new_values = db.Column(db.Text)  # JSON string
    ip_address = db.Column(db.String(45))
    user_agent = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, index=True)
    
    user = db.relationship('User', backref='audit_logs')
    
    # Database indexes for performance
    __table_args__ = (
        Index('idx_audit_user_action', 'user_id', 'action'),
        Index('idx_audit_resource', 'resource_type', 'resource_id'),
        Index('idx_audit_date_action', 'created_at', 'action'),
    )
    
    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'user': self.user.to_dict() if self.user else None,
            'action': self.action,
            'resource_type': self.resource_type,
            'resource_id': self.resource_id,
            'old_values': self.old_values,
            'new_values': self.new_values,
            'ip_address': self.ip_address,
            'user_agent': self.user_agent,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

class RefreshToken(db.Model):
    __tablename__ = 'refresh_tokens'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    token = db.Column(db.String(255), unique=True, nullable=False, index=True)
    expires_at = db.Column(db.DateTime, nullable=False, index=True)
    is_revoked = db.Column(db.Boolean, default=False, index=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    user = db.relationship('User', backref='refresh_tokens')
    
    # Database indexes for performance
    __table_args__ = (
        Index('idx_refresh_token_user', 'user_id', 'is_revoked'),
        Index('idx_refresh_token_expires', 'expires_at', 'is_revoked'),
    )
    
    @staticmethod
    def generate_token():
        return secrets.token_urlsafe(32)
    
    def is_expired(self):
        return datetime.utcnow() > self.expires_at
    
    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'expires_at': self.expires_at.isoformat() if self.expires_at else None,
            'is_revoked': self.is_revoked,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

class SystemConfig(db.Model):
    __tablename__ = 'system_configs'
    
    id = db.Column(db.Integer, primary_key=True)
    key = db.Column(db.String(100), unique=True, nullable=False, index=True)
    value = db.Column(db.Text)
    description = db.Column(db.Text)
    data_type = db.Column(db.String(20), default='string')  # string, integer, float, boolean, json
    is_public = db.Column(db.Boolean, default=False)  # Can be accessed by non-admin users
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def get_typed_value(self):
        """Return the value converted to the appropriate type"""
        if self.data_type == 'integer':
            return int(self.value) if self.value else 0
        elif self.data_type == 'float':
            return float(self.value) if self.value else 0.0
        elif self.data_type == 'boolean':
            return self.value.lower() in ('true', '1', 'yes') if self.value else False
        elif self.data_type == 'json':
            import json
            return json.loads(self.value) if self.value else {}
        else:
            return self.value
    
    def to_dict(self):
        return {
            'id': self.id,
            'key': self.key,
            'value': self.get_typed_value(),
            'description': self.description,
            'data_type': self.data_type,
            'is_public': self.is_public,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }