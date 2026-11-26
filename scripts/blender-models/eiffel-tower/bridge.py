"""In-process Blender command bridge.

Load with:
  blender.exe --python bridge.py

Listens on 127.0.0.1:9876. Received Python source is executed on Blender's
main thread via bpy.app.timers (required: bpy API is main-thread only).
The caller gets "OK" or a full traceback back over the same socket.
"""
import bpy
import socket
import threading
import queue
import traceback
import time

HOST = "127.0.0.1"
PORT = 9876

cmd_queue = queue.Queue()
res_queue = queue.Queue()


def _pump():
    """timers callback - runs on Blender main thread."""
    n = 0
    while n < 64:
        try:
            code = cmd_queue.get_nowait()
        except queue.Empty:
            break
        try:
            exec(compile(code, "<bridge>", "exec"), {"bpy": bpy, "__name__": "__bridge__"})
            res_queue.put("OK")
        except Exception:
            res_queue.put("ERROR\n" + traceback.format_exc())
        n += 1
    return 0.05


bpy.app.timers.register(_pump, persistent=True)


def _serve():
    srv = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    srv.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    srv.bind((HOST, PORT))
    srv.listen(8)
    print("[bridge] listening on %s:%d" % (HOST, PORT), flush=True)
    while True:
        try:
            conn, _ = srv.accept()
        except OSError:
            break
        buf = []
        while True:
            chunk = conn.recv(65536)
            if not chunk:
                break
            buf.append(chunk)
        cmd_queue.put(b"".join(buf).decode("utf-8", "replace"))

        deadline = time.time() + 180
        result = "TIMEOUT"
        while time.time() < deadline:
            try:
                result = res_queue.get(timeout=0.2)
                break
            except queue.Empty:
                pass
        try:
            conn.sendall(result.encode("utf-8", "replace"))
        except OSError:
            pass
        conn.close()


threading.Thread(target=_serve, daemon=True, name="blender-bridge").start()
print("[bridge] READY", flush=True)
