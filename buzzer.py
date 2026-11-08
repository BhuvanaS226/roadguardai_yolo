import os
import threading
import time

import serial
import serial.tools.list_ports

BAUD = 115200
COOLDOWN_S = 6.0  # a little longer than the 5 s alarm on the board

_port = None
_last_beep = 0.0
_lock = threading.Lock()


def _find_port():
    env = os.environ.get("ROADGUARD_BUZZER_PORT")
    if env:
        return env
    for p in serial.tools.list_ports.comports():
        if any(tag in (p.description or "") for tag in ("CP210", "CH340", "CH910", "USB-SERIAL")):
            return p.device
    return None


def _open():
    global _port
    if _port is not None and _port.is_open:
        return _port
    name = _find_port()
    if not name:
        return None
    _port = serial.Serial(name, BAUD, timeout=1, write_timeout=1)
    time.sleep(2)  # NodeMCU resets when the port opens
    print("[Buzzer] connected on", name)
    return _port


def beep():
    """Send one beep command to the NodeMCU. Never raises, never blocks the caller for long."""
    global _port, _last_beep
    now = time.time()
    if now - _last_beep < COOLDOWN_S:
        return
    _last_beep = now

    def _send():
        global _port
        with _lock:
            try:
                port = _open()
                if port:
                    port.write(b"B\n")
            except Exception as e:
                print("[Buzzer] error:", e)
                try:
                    if _port:
                        _port.close()
                except Exception:
                    pass
                _port = None

    threading.Thread(target=_send, daemon=True).start()
