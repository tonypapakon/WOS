"""
Utility functions for the Wireless Ordering System
"""

import secrets
from datetime import datetime

def generate_order_number():
    """
    Generate a unique order number
    """
    timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
    random_suffix = secrets.token_hex(2).upper()
    return f"ORD-{timestamp}-{random_suffix}"