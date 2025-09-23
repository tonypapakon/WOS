"""
Simple virtual printer that listens to Socket.IO events from the backend
and prints order details to the terminal. Useful for testing without real
physical printers.

Usage:
  python scripts/virtual_printer.py --url http://localhost:5005

It listens for 'new_order' and 'order_update' events and prints payloads.
"""

import argparse
import socketio
import sys
import time
import re
import shutil
from decimal import Decimal

sio = socketio.Client(logger=False, engineio_logger=False)


@sio.event
def connect():
    print("[virtual-printer] Connected to server")
    # Join restaurant room if server supports it
    try:
        sio.emit('join_restaurant')
    except Exception:
        pass


@sio.event
def disconnect():
    print("[virtual-printer] Disconnected from server")


@sio.on('new_order')
def on_new_order(data):
    print('\n' + '=' * 40)
    print('[virtual-printer] NEW ORDER RECEIVED')
    print('=' * 40)
    for k, v in data.items():
        print(f"{k}: {v}")
    print('=' * 40 + '\n')


@sio.on('order_update')
def on_order_update(data):
    print('\n' + '-' * 40)
    print('[virtual-printer] ORDER UPDATE')
    for k, v in data.items():
        print(f"{k}: {v}")
    print('-' * 40 + '\n')


@sio.on('print_output')
def on_print_output(data):
    printer_name = data.get('printer_name')
    printer_type = data.get('printer_type')
    content = data.get('content', '')

    print('\n' + '*' * 40)
    print('[virtual-printer] PRINT OUTPUT')
    print('*' * 40)
    print(f"Printer: {printer_name} ({printer_type})")
    print('-' * 40)

    # If this is a receipt, try to pretty-format it into neat columns
    if printer_type and printer_type.lower() == 'receipt':
        try:
            pretty = pretty_print_receipt(content)
            print(pretty)
        except Exception as e:
            print("[virtual-printer] Failed to pretty-print receipt, falling back to raw content:", e)
            print(content)
    else:
        print(content)

    print('*' * 40 + '\n')


def _parse_amount(s: str) -> Decimal:
    """Parse a currency amount like '€2.75' or '$3.03' or '3.03' into Decimal."""
    if s is None:
        return Decimal('0.00')
    # keep digits, dot and comma
    m = re.search(r"([\d\.,]+)", s)
    if not m:
        return Decimal('0.00')
    num = m.group(1).replace(',', '')
    try:
        return Decimal(num)
    except Exception:
        return Decimal('0.00')


def pretty_print_receipt(raw: str, width: int = None) -> str:
    """Produce a nicely aligned receipt from the server's raw receipt content.

    This is forgiving: it will attempt to extract header lines, item blocks and
    totals, and render a compact, monospaced receipt that's easier to read in
    a terminal.
    """
    if width is None:
        try:
            width = shutil.get_terminal_size().columns
        except Exception:
            width = 48
    width = max(40, min(80, width))

    lines = [ln.rstrip() for ln in raw.splitlines()]

    header_lines = []
    items = []  # each item: (qty, name, unit_price, subtotal)
    totals = []  # (label, amount)

    # Heuristic parse: find item lines like '1x Blueberry Muffin' and then
    # following indented lines for unit price and subtotal.
    i = 0
    while i < len(lines):
        ln = lines[i].strip()
        # Header detection: common restaurant header lines before first 'Order:'
        if ln and (ln.upper().startswith('RESTAURANT') or ln.upper().startswith('ORDER') or 'Main Street' in ln or 'Tel:' in ln) and not header_lines:
            # collect a small header block (up to 6 lines before items)
            # backtrack a few lines
            start = max(0, i - 6)
            header_lines = [l for l in lines[start:i+1] if l.strip()]
            i += 1
            continue

        # Item line
        m = re.match(r"^(\d+)x\s+(.+)$", ln)
        if m:
            qty = int(m.group(1))
            name = m.group(2).strip()
            unit_price = Decimal('0.00')
            subtotal = Decimal('0.00')

            # look ahead for unit price and subtotal lines
            j = i + 1
            while j < len(lines) and lines[j].strip() == '':
                j += 1
            if j < len(lines) and re.search(r"each", lines[j], re.IGNORECASE):
                unit_price = _parse_amount(lines[j])
                j += 1
            # find subtotal line
            while j < len(lines):
                if 'subtotal' in lines[j].lower():
                    subtotal = _parse_amount(lines[j])
                    j += 1
                    break
                if lines[j].strip() == '':
                    j += 1
                    continue
                j += 1

            items.append((qty, name, unit_price, subtotal))
            i = j
            continue

        # Totals lines
        tot_m = re.match(r"^(Subtotal|Tax|Discount|TOTAL)\s*[:\s]*[€$]?\s*([\d\.,]+)$", ln, re.IGNORECASE)
        if tot_m:
            label = tot_m.group(1).strip().capitalize()
            amount = _parse_amount(tot_m.group(2))
            totals.append((label, amount))
            i += 1
            continue

        # Fallback: collect common totals like 'Subtotal: €2.75'
        if 'subtotal' in ln.lower() or 'tax' in ln.lower() or 'total' in ln.lower() or 'discount' in ln.lower():
            parts = ln.split(':', 1)
            if len(parts) == 2:
                label = parts[0].strip().capitalize()
                amount = _parse_amount(parts[1])
                totals.append((label, amount))
        i += 1

    # Build pretty receipt
    out = []
    out.append('=' * width)
    # Header
    if header_lines:
        for h in header_lines:
            out.append(h.center(width))
        out.append('-' * width)

    # Items: columns [qty] [name left] [unit right] [subtotal right]
    if items:
        # compute name column width
        qty_w = 3
        money_w = 8
        name_w = width - qty_w - money_w - money_w - 4
        for qty, name, unit_price, subtotal in items:
            qty_s = str(qty).rjust(qty_w)
            unit_s = f"{unit_price:.2f}".rjust(money_w)
            sub_s = f"{subtotal:.2f}".rjust(money_w)
            # name may wrap; keep single line when possible
            name_s = name[:name_w].ljust(name_w)
            out.append(f"{qty_s}  {name_s}  {unit_s}  {sub_s}")
        out.append('-' * width)

    # Totals
    if totals:
        # ensure order: Subtotal, Tax, Discount, Total
        order_labels = ['Subtotal', 'Tax', 'Discount', 'Total']
        for label in order_labels:
            for lab, amt in totals:
                if lab.lower() == label.lower():
                    out.append(f"{lab.rjust(width-12)}  {amt:8.2f}")
        out.append('=' * width)

    out.append('Thank you for dining with us!'.center(width))
    out.append('=' * width)

    return "\n".join(out)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--url', default='http://localhost:5005', help='Backend Socket.IO URL')
    args = parser.parse_args()

    try:
        print(f"[virtual-printer] Connecting to {args.url} ...")

        # Retry loop: keep attempting to connect until server is available
        backoff = 1
        while True:
            try:
                sio.connect(args.url, wait=True)
                break
            except Exception as e:
                print(f"[virtual-printer] Connect failed: {e}. Retrying in {backoff}s...")
                time.sleep(backoff)
                backoff = min(backoff * 2, 30)

        print('[virtual-printer] Connected. Listening for events. Press Ctrl+C to quit.')
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print('\n[virtual-printer] Interrupted, disconnecting...')
    except Exception as e:
        print(f"[virtual-printer] Error: {e}")
    finally:
        try:
            sio.disconnect()
        except Exception:
            pass


if __name__ == '__main__':
    main()
