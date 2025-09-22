from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import (
    create_access_token, 
    create_refresh_token,
    jwt_required, 
    get_jwt_identity,
    get_jwt,
    verify_jwt_in_request
)
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from werkzeug.security import check_password_hash, generate_password_hash
from models import User, RefreshToken, AuditLog, db
from datetime import timedelta, datetime
import re
from email_validator import validate_email, EmailNotValidError

auth_bp = Blueprint('auth', __name__)

# Rate limiter for auth routes
limiter = Limiter(key_func=get_remote_address)

def validate_password_strength(password):
    """Enhanced password validation"""
    errors = []
    
    if len(password) < 8:
        errors.append("Password must be at least 8 characters long")
    
    if not re.search(r'[A-Z]', password):
        errors.append("Password must contain at least one uppercase letter")
    
    if not re.search(r'[a-z]', password):
        errors.append("Password must contain at least one lowercase letter")
    
    if not re.search(r'\d', password):
        errors.append("Password must contain at least one number")
    
    if not re.search(r'[!@#$%^&*(),.?":{}|<>]', password):
        errors.append("Password must contain at least one special character")
    
    # Check for common weak patterns
    weak_patterns = [
        r'123456',
        r'password',
        r'qwerty',
        r'admin',
        r'letmein'
    ]
    
    for pattern in weak_patterns:
        if re.search(pattern, password.lower()):
            errors.append("Password contains common weak patterns")
            break
    
    return errors

def log_auth_event(user_id, action, success, ip_address, user_agent, details=None):
    """Log authentication events for audit purposes"""
    try:
        log_entry = AuditLog(
            user_id=user_id,
            action=action,
            resource_type='authentication',
            ip_address=ip_address,
            user_agent=user_agent,
            new_values=f"Success: {success}, Details: {details or 'None'}"
        )
        db.session.add(log_entry)
        db.session.commit()
    except Exception as e:
        current_app.logger.error(f"Failed to log auth event: {str(e)}")

@auth_bp.route('/login', methods=['POST'])
@limiter.limit("10 per minute")
def login():
    """
    User Login
    ---
    tags:
      - Authentication
    parameters:
      - in: body
        name: credentials
        required: true
        schema:
          type: object
          required:
            - username
            - password
          properties:
            username:
              type: string
              description: Username or email
            password:
              type: string
              description: User password
    responses:
      200:
        description: Login successful
        schema:
          type: object
          properties:
            access_token:
              type: string
            refresh_token:
              type: string
            user:
              type: object
      400:
        description: Invalid input
      401:
        description: Invalid credentials or account locked
      429:
        description: Too many login attempts
    """
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'Request body must be JSON'}), 400
        
        username = data.get('username', '').strip()
        password = data.get('password', '')
        
        if not username or not password:
            return jsonify({'error': 'Username and password are required'}), 400
        
        # Find user by username or email
        user = User.query.filter(
            (User.username == username) | (User.email == username)
        ).first()
        
        ip_address = get_remote_address()
        user_agent = request.headers.get('User-Agent', '')
        
        if not user:
            # Log failed login attempt
            log_auth_event(None, 'login_failed', False, ip_address, user_agent, 'User not found')
            return jsonify({'error': 'Invalid credentials'}), 401
        
        # Check if account is locked
        if user.is_locked:
            log_auth_event(user.id, 'login_blocked', False, ip_address, user_agent, 'Account locked')
            return jsonify({
                'error': 'Account is temporarily locked due to too many failed login attempts',
                'locked_until': user.locked_until.isoformat() if user.locked_until else None
            }), 401
        
        # Check if account is active
        if not user.is_active:
            log_auth_event(user.id, 'login_blocked', False, ip_address, user_agent, 'Account deactivated')
            return jsonify({'error': 'Account is deactivated'}), 401
        
        # Verify password
        if not user.check_password(password):
            # The check_password method handles failed attempt counting
            db.session.commit()
            log_auth_event(user.id, 'login_failed', False, ip_address, user_agent, 'Invalid password')
            
            remaining_attempts = 5 - user.failed_login_attempts
            if remaining_attempts <= 0:
                return jsonify({
                    'error': 'Account has been locked due to too many failed login attempts',
                    'locked_until': user.locked_until.isoformat() if user.locked_until else None
                }), 401
            else:
                return jsonify({
                    'error': 'Invalid credentials',
                    'remaining_attempts': remaining_attempts
                }), 401
        
        # Successful login - update user and create tokens
        user.last_login = datetime.utcnow()
        db.session.commit()
        
        # Create tokens
        access_token = create_access_token(
            identity=str(user.id),
            expires_delta=timedelta(hours=1)
        )
        
        refresh_token_str = create_refresh_token(
            identity=str(user.id),
            expires_delta=timedelta(days=30)
        )
        
        # Store refresh token in database
        refresh_token = RefreshToken(
            user_id=user.id,
            token=RefreshToken.generate_token(),
            expires_at=datetime.utcnow() + timedelta(days=30)
        )
        db.session.add(refresh_token)
        db.session.commit()
        
        # Log successful login
        log_auth_event(user.id, 'login_success', True, ip_address, user_agent)
        
        return jsonify({
            'access_token': access_token,
            'refresh_token': refresh_token_str,
            'user': {
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'first_name': user.first_name,
                'last_name': user.last_name,
                'full_name': user.full_name,
                'role': user.role,
                'location_id': user.location_id,
                'location': user.user_location.name if user.user_location else None,
                'last_login': user.last_login.isoformat() if user.last_login else None
            }
        }), 200
        
    except Exception as e:
        current_app.logger.error(f"Login error: {str(e)}")
        return jsonify({'error': 'An unexpected error occurred'}), 500

@auth_bp.route('/refresh', methods=['POST'])
@jwt_required(refresh=True)
@limiter.limit("20 per minute")
def refresh():
    """
    Refresh Access Token
    ---
    tags:
      - Authentication
    security:
      - Bearer: []
    responses:
      200:
        description: Token refreshed successfully
        schema:
          type: object
          properties:
            access_token:
              type: string
      401:
        description: Invalid or expired refresh token
    """
    try:
        current_user_id = get_jwt_identity()
        user = User.query.get(current_user_id)
        
        if not user or not user.is_active:
            return jsonify({'error': 'User not found or inactive'}), 401
        
        # Create new access token
        access_token = create_access_token(
            identity=str(user.id),
            expires_delta=timedelta(hours=1)
        )
        
        # Log token refresh
        log_auth_event(
            user.id, 
            'token_refresh', 
            True, 
            get_remote_address(), 
            request.headers.get('User-Agent', '')
        )
        
        return jsonify({'access_token': access_token}), 200
        
    except Exception as e:
        current_app.logger.error(f"Token refresh error: {str(e)}")
        return jsonify({'error': 'Token refresh failed'}), 401

@auth_bp.route('/logout', methods=['POST'])
@jwt_required()
@limiter.limit("30 per minute")
def logout():
    """
    User Logout
    ---
    tags:
      - Authentication
    security:
      - Bearer: []
    responses:
      200:
        description: Logout successful
      401:
        description: Invalid token
    """
    try:
        current_user_id = get_jwt_identity()
        jti = get_jwt()['jti']
        
        # Add token to blacklist (in production, use Redis)
        from app import blacklisted_tokens
        blacklisted_tokens.add(jti)
        
        # Revoke all refresh tokens for this user
        RefreshToken.query.filter_by(user_id=current_user_id, is_revoked=False).update({
            'is_revoked': True
        })
        db.session.commit()
        
        # Log logout
        log_auth_event(
            current_user_id, 
            'logout', 
            True, 
            get_remote_address(), 
            request.headers.get('User-Agent', '')
        )
        
        return jsonify({'message': 'Successfully logged out'}), 200
        
    except Exception as e:
        current_app.logger.error(f"Logout error: {str(e)}")
        return jsonify({'error': 'Logout failed'}), 500

@auth_bp.route('/register', methods=['POST'])
@jwt_required()
@limiter.limit("5 per minute")
def register():
    """
    Register New User
    ---
    tags:
      - Authentication
    security:
      - Bearer: []
    parameters:
      - in: body
        name: user_data
        required: true
        schema:
          type: object
          required:
            - username
            - email
            - password
            - first_name
            - last_name
          properties:
            username:
              type: string
            email:
              type: string
            password:
              type: string
            first_name:
              type: string
            last_name:
              type: string
            role:
              type: string
              enum: [admin, manager, waiter]
            location_id:
              type: integer
    responses:
      201:
        description: User created successfully
      400:
        description: Invalid input or validation errors
      403:
        description: Insufficient permissions
    """
    try:
        current_user_id = int(get_jwt_identity())
        current_user = User.query.get(current_user_id)
        
        # Only admin and manager can create new users
        if current_user.role not in ['admin', 'manager']:
            return jsonify({'error': 'Insufficient permissions'}), 403
        
        data = request.get_json()
        if not data:
            return jsonify({'error': 'Request body must be JSON'}), 400
        
        # Validate required fields
        required_fields = ['username', 'email', 'password', 'first_name', 'last_name']
        missing_fields = [field for field in required_fields if not data.get(field)]
        if missing_fields:
            return jsonify({
                'error': 'Missing required fields',
                'missing_fields': missing_fields
            }), 400
        
        # Validate email format
        try:
            validate_email(data['email'])
        except EmailNotValidError as e:
            return jsonify({'error': f'Invalid email format: {str(e)}'}), 400
        
        # Validate password strength
        password_errors = validate_password_strength(data['password'])
        if password_errors:
            return jsonify({
                'error': 'Password does not meet security requirements',
                'password_errors': password_errors
            }), 400
        
        # Validate username format
        username = data['username'].strip()
        if not re.match(r'^[a-zA-Z0-9_]{3,30}$', username):
            return jsonify({
                'error': 'Username must be 3-30 characters long and contain only letters, numbers, and underscores'
            }), 400
        
        # Check if username or email already exists
        existing_user = User.query.filter(
            (User.username == username) | (User.email == data['email'])
        ).first()
        
        if existing_user:
            if existing_user.username == username:
                return jsonify({'error': 'Username already exists'}), 400
            else:
                return jsonify({'error': 'Email already exists'}), 400
        
        # Validate role
        role = data.get('role', 'waiter')
        valid_roles = ['admin', 'manager', 'waiter']
        if role not in valid_roles:
            return jsonify({
                'error': 'Invalid role',
                'valid_roles': valid_roles
            }), 400
        
        # Only admin can create admin users
        if role == 'admin' and current_user.role != 'admin':
            return jsonify({'error': 'Only admin users can create admin accounts'}), 403
        
        # Create new user
        new_user = User(
            username=username,
            email=data['email'].strip().lower(),
            first_name=data['first_name'].strip(),
            last_name=data['last_name'].strip(),
            role=role,
            location_id=data.get('location_id')
        )
        
        # Set password (this will validate strength again)
        try:
            new_user.set_password(data['password'])
        except ValueError as e:
            return jsonify({'error': str(e)}), 400
        
        db.session.add(new_user)
        db.session.commit()
        
        # Log user creation
        log_auth_event(
            current_user.id, 
            'user_created', 
            True, 
            get_remote_address(), 
            request.headers.get('User-Agent', ''),
            f"Created user: {new_user.username} ({new_user.role})"
        )
        
        return jsonify({
            'message': 'User created successfully',
            'user': {
                'id': new_user.id,
                'username': new_user.username,
                'email': new_user.email,
                'first_name': new_user.first_name,
                'last_name': new_user.last_name,
                'full_name': new_user.full_name,
                'role': new_user.role,
                'location_id': new_user.location_id,
                'is_active': new_user.is_active,
                'created_at': new_user.created_at.isoformat()
            }
        }), 201
        
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"User registration error: {str(e)}")
        return jsonify({'error': 'User registration failed'}), 500

@auth_bp.route('/profile', methods=['GET'])
@jwt_required()
@limiter.limit("100 per minute")
def get_profile():
    """
    Get User Profile
    ---
    tags:
      - Authentication
    security:
      - Bearer: []
    responses:
      200:
        description: User profile
        schema:
          type: object
          properties:
            user:
              type: object
      401:
        description: Invalid token
      404:
        description: User not found
    """
    try:
        current_user_id = int(get_jwt_identity())
        user = User.query.get(current_user_id)
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        return jsonify({
            'user': user.to_dict(include_sensitive=False)
        }), 200
        
    except Exception as e:
        current_app.logger.error(f"Get profile error: {str(e)}")
        return jsonify({'error': 'Failed to get profile'}), 500

@auth_bp.route('/change-password', methods=['POST'])
@jwt_required()
@limiter.limit("5 per minute")
def change_password():
    """
    Change User Password
    ---
    tags:
      - Authentication
    security:
      - Bearer: []
    parameters:
      - in: body
        name: password_data
        required: true
        schema:
          type: object
          required:
            - current_password
            - new_password
          properties:
            current_password:
              type: string
            new_password:
              type: string
    responses:
      200:
        description: Password changed successfully
      400:
        description: Invalid input or validation errors
      401:
        description: Invalid current password
    """
    try:
        current_user_id = int(get_jwt_identity())
        user = User.query.get(current_user_id)
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        data = request.get_json()
        if not data:
            return jsonify({'error': 'Request body must be JSON'}), 400
        
        current_password = data.get('current_password')
        new_password = data.get('new_password')
        
        if not current_password or not new_password:
            return jsonify({'error': 'Current password and new password are required'}), 400
        
        # Verify current password
        if not check_password_hash(user.password_hash, current_password):
            log_auth_event(
                user.id, 
                'password_change_failed', 
                False, 
                get_remote_address(), 
                request.headers.get('User-Agent', ''),
                'Invalid current password'
            )
            return jsonify({'error': 'Current password is incorrect'}), 401
        
        # Validate new password strength
        password_errors = validate_password_strength(new_password)
        if password_errors:
            return jsonify({
                'error': 'New password does not meet security requirements',
                'password_errors': password_errors
            }), 400
        
        # Check if new password is different from current
        if check_password_hash(user.password_hash, new_password):
            return jsonify({'error': 'New password must be different from current password'}), 400
        
        # Update password
        user.set_password(new_password)
        db.session.commit()
        
        # Revoke all refresh tokens to force re-login on other devices
        RefreshToken.query.filter_by(user_id=user.id, is_revoked=False).update({
            'is_revoked': True
        })
        db.session.commit()
        
        # Log password change
        log_auth_event(
            user.id, 
            'password_changed', 
            True, 
            get_remote_address(), 
            request.headers.get('User-Agent', '')
        )
        
        return jsonify({'message': 'Password changed successfully'}), 200
        
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Change password error: {str(e)}")
        return jsonify({'error': 'Failed to change password'}), 500

@auth_bp.route('/users', methods=['GET'])
@jwt_required()
@limiter.limit("50 per minute")
def get_users():
    """
    Get All Users
    ---
    tags:
      - Authentication
    security:
      - Bearer: []
    parameters:
      - in: query
        name: role
        type: string
        description: Filter by role
      - in: query
        name: location_id
        type: integer
        description: Filter by location
      - in: query
        name: is_active
        type: boolean
        description: Filter by active status
    responses:
      200:
        description: List of users
      403:
        description: Insufficient permissions
    """
    try:
        current_user_id = int(get_jwt_identity())
        current_user = User.query.get(current_user_id)
        
        # Only admin and manager can view all users
        if current_user.role not in ['admin', 'manager']:
            return jsonify({'error': 'Insufficient permissions'}), 403
        
        # Build query with filters
        query = User.query
        
        # Apply filters
        role = request.args.get('role')
        if role:
            query = query.filter_by(role=role)
        
        location_id = request.args.get('location_id')
        if location_id:
            query = query.filter_by(location_id=int(location_id))
        
        is_active = request.args.get('is_active')
        if is_active is not None:
            query = query.filter_by(is_active=is_active.lower() == 'true')
        
        users = query.order_by(User.created_at.desc()).all()
        
        # Include sensitive info only for admins
        include_sensitive = current_user.role == 'admin'
        users_data = [user.to_dict(include_sensitive=include_sensitive) for user in users]
        
        return jsonify({
            'users': users_data,
            'total': len(users_data)
        }), 200
        
    except Exception as e:
        current_app.logger.error(f"Get users error: {str(e)}")
        return jsonify({'error': 'Failed to get users'}), 500

@auth_bp.route('/users/<int:user_id>', methods=['PUT'])
@jwt_required()
@limiter.limit("10 per minute")
def update_user(user_id):
    """
    Update User
    ---
    tags:
      - Authentication
    security:
      - Bearer: []
    parameters:
      - in: path
        name: user_id
        type: integer
        required: true
      - in: body
        name: user_data
        schema:
          type: object
          properties:
            first_name:
              type: string
            last_name:
              type: string
            email:
              type: string
            role:
              type: string
            is_active:
              type: boolean
            location_id:
              type: integer
    responses:
      200:
        description: User updated successfully
      400:
        description: Invalid input
      403:
        description: Insufficient permissions
      404:
        description: User not found
    """
    try:
        current_user_id = int(get_jwt_identity())
        current_user = User.query.get(current_user_id)
        
        user = User.query.get(user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        # Check permissions
        can_edit = (
            current_user.role == 'admin' or
            (current_user.role == 'manager' and user.role != 'admin') or
            current_user_id == user_id
        )
        
        if not can_edit:
            return jsonify({'error': 'Insufficient permissions'}), 403
        
        data = request.get_json()
        if not data:
            return jsonify({'error': 'Request body must be JSON'}), 400
        
        # Track changes for audit log
        changes = {}
        
        # Update allowed fields
        if 'first_name' in data and data['first_name'].strip():
            old_value = user.first_name
            user.first_name = data['first_name'].strip()
            changes['first_name'] = {'old': old_value, 'new': user.first_name}
        
        if 'last_name' in data and data['last_name'].strip():
            old_value = user.last_name
            user.last_name = data['last_name'].strip()
            changes['last_name'] = {'old': old_value, 'new': user.last_name}
        
        if 'email' in data:
            # Validate email format
            try:
                validate_email(data['email'])
            except EmailNotValidError as e:
                return jsonify({'error': f'Invalid email format: {str(e)}'}), 400
            
            # Check if email is unique
            if data['email'] != user.email:
                existing_email = User.query.filter_by(email=data['email']).first()
                if existing_email:
                    return jsonify({'error': 'Email already exists'}), 400
                
                old_value = user.email
                user.email = data['email'].strip().lower()
                changes['email'] = {'old': old_value, 'new': user.email}
        
        # Admin/Manager only fields
        if current_user.role in ['admin', 'manager']:
            if 'role' in data:
                # Only admin can change roles to/from admin
                if (data['role'] == 'admin' or user.role == 'admin') and current_user.role != 'admin':
                    return jsonify({'error': 'Only admin users can modify admin roles'}), 403
                
                if data['role'] in ['admin', 'manager', 'waiter']:
                    old_value = user.role
                    user.role = data['role']
                    changes['role'] = {'old': old_value, 'new': user.role}
            
            if 'is_active' in data:
                old_value = user.is_active
                user.is_active = bool(data['is_active'])
                changes['is_active'] = {'old': old_value, 'new': user.is_active}
            
            if 'location_id' in data:
                old_value = user.location_id
                user.location_id = data['location_id']
                changes['location_id'] = {'old': old_value, 'new': user.location_id}
        
        user.updated_at = datetime.utcnow()
        db.session.commit()
        
        # Log the changes
        if changes:
            log_auth_event(
                current_user.id, 
                'user_updated', 
                True, 
                get_remote_address(), 
                request.headers.get('User-Agent', ''),
                f"Updated user {user.username}: {changes}"
            )
        
        return jsonify({
            'message': 'User updated successfully',
            'user': user.to_dict(include_sensitive=current_user.role == 'admin'),
            'changes': changes
        }), 200
        
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Update user error: {str(e)}")
        return jsonify({'error': 'Failed to update user'}), 500

@auth_bp.route('/users/<int:user_id>/unlock', methods=['POST'])
@jwt_required()
@limiter.limit("10 per minute")
def unlock_user(user_id):
    """
    Unlock User Account
    ---
    tags:
      - Authentication
    security:
      - Bearer: []
    parameters:
      - in: path
        name: user_id
        type: integer
        required: true
    responses:
      200:
        description: User unlocked successfully
      403:
        description: Insufficient permissions
      404:
        description: User not found
    """
    try:
        current_user_id = int(get_jwt_identity())
        current_user = User.query.get(current_user_id)
        
        # Only admin and manager can unlock accounts
        if current_user.role not in ['admin', 'manager']:
            return jsonify({'error': 'Insufficient permissions'}), 403
        
        user = User.query.get(user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        # Reset failed login attempts and unlock
        user.failed_login_attempts = 0
        user.locked_until = None
        db.session.commit()
        
        # Log the unlock
        log_auth_event(
            current_user.id, 
            'user_unlocked', 
            True, 
            get_remote_address(), 
            request.headers.get('User-Agent', ''),
            f"Unlocked user: {user.username}"
        )
        
        return jsonify({'message': f'User {user.username} has been unlocked'}), 200
        
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Unlock user error: {str(e)}")
        return jsonify({'error': 'Failed to unlock user'}), 500