from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_jwt_extended import (
    JWTManager,
    jwt_required,
    create_access_token,
    get_jwt_identity,
)
from flask_socketio import SocketIO, emit, join_room, leave_room
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime, timedelta
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

app = Flask(__name__)
app.url_map.strict_slashes = False  # Prevent 308 redirects for trailing slashes
app.config["SECRET_KEY"] = os.getenv("SECRET_KEY", "your-secret-key-here")

# Database configuration with fallback
database_url = os.getenv("DATABASE_URL")
if not database_url or "mysql" in database_url:
    # Fallback to SQLite for development if MySQL is not available
    database_url = "sqlite:///wireless_ordering.db"
    print("⚠️  Using SQLite fallback database")

app.config["SQLALCHEMY_DATABASE_URI"] = database_url
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
app.config["JWT_SECRET_KEY"] = os.getenv("JWT_SECRET_KEY", "jwt-secret-string")
app.config["JWT_ACCESS_TOKEN_EXPIRES"] = timedelta(hours=8)
print("DATABASE_URI:", app.config["SQLALCHEMY_DATABASE_URI"])
print("SECRET_KEY:", app.config["SECRET_KEY"])
print("JWT_SECRET_KEY:", app.config["JWT_SECRET_KEY"])

# A more robust CORS configuration for development
cors = CORS(
    app,
    resources={r"/api/*": {"origins": "*"}},
    allow_headers=["Content-Type", "Authorization"],
    expose_headers=["Content-Type", "Authorization"],
    methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    supports_credentials=False,
)
jwt = JWTManager(app)

# Token blacklist for logout functionality
blacklisted_tokens = set()

@jwt.token_in_blocklist_loader
def check_if_token_revoked(jwt_header, jwt_payload):
    jti = jwt_payload['jti']
    return jti in blacklisted_tokens

# Socket.IO configuration with better compatibility
socketio = SocketIO(
    app,
    cors_allowed_origins="*",
    async_mode="eventlet",
    logger=False,
    engineio_logger=False,
    ping_timeout=60,
    ping_interval=25
)

# Import models and initialize db
from models import db  # noqa: E402

db.init_app(app)

# Import other models and routes (after db is initialized)
from models import *  # noqa: E402,F401,F403
from routes.auth import auth_bp  # noqa: E402
from routes.menu import menu_bp  # noqa: E402
from routes.orders import orders_bp  # noqa: E402
from routes.locations import locations_bp  # noqa: E402
from routes.tables import tables_bp  # noqa: E402
from routes.reports import reports_bp  # noqa: E402
from routes.printers import printers_bp  # noqa: E402
from routes.admin import admin_bp  # noqa: E402
from routes.reservations import reservations_bp  # noqa: E402

# Register blueprints
app.register_blueprint(auth_bp, url_prefix="/api/auth")
app.register_blueprint(menu_bp, url_prefix="/api/menu")
app.register_blueprint(orders_bp, url_prefix="/api/orders")
app.register_blueprint(tables_bp, url_prefix="/api/tables")
app.register_blueprint(reports_bp, url_prefix="/api/reports")
app.register_blueprint(printers_bp, url_prefix="/api/printers")
app.register_blueprint(locations_bp, url_prefix="/api/locations")
app.register_blueprint(admin_bp, url_prefix="/api/admin")
app.register_blueprint(reservations_bp)

# -------------------- Socket.IO events --------------------


@socketio.on("connect")
def handle_connect():
    print("Client connected")


@socketio.on("disconnect")
def handle_disconnect():
    print("Client disconnected")


@socketio.on("join_restaurant")
def handle_join_restaurant(_data=None):
    join_room("restaurant")
    emit("status", {"msg": "Joined restaurant room"})


@socketio.on("new_order")
def handle_new_order(data):
    # Broadcast new order to all connected clients
    socketio.emit("order_update", data, room="restaurant")


@socketio.on("order_status_update")
def handle_order_status_update(data):
    # Broadcast order status update
    socketio.emit("order_status_changed", data, room="restaurant")


# -------------------- Utility Routes --------------------


@app.route("/")
def index():
    return jsonify({
        "message": "Wireless Ordering System API",
        "version": "1.0.0",
        "status": "running",
    })


@app.route("/api/health")
def health_check():
    return jsonify({
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
    })


# -------------------- App Initialisation --------------------


with app.app_context():
    db.create_all()

    # Create default admin user if not exists
    from models import User  # noqa: E402

    admin = User.query.filter_by(username="admin").first()
    if not admin:
        admin_user = User(
            username="admin",
            email="admin@restaurant.com",
            password_hash=generate_password_hash("admin123"),
            role="admin",
            first_name="Admin",
            last_name="User",
        )
        db.session.add(admin_user)
        db.session.commit()
        print("Default admin user created: admin/admin123")


if __name__ == "__main__":
    # Optimized for faster startup
    socketio.run(
        app,
        debug=False,        # Disable debug for faster startup
        host="0.0.0.0",
        port=5005,
        use_reloader=False,  # Disable auto-reload for faster startup
        allow_unsafe_werkzeug=True,
    )