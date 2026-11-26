"""Send Python source to the running Blender bridge.

Usage:
  python send_cmd.py "bpy.ops.mesh.primitive_cube_add()"
  python send_cmd.py --file some_script.py
"""
import socket
import sys
import time

HOST = "127.0.0.1"
PORT = 9876


def send(code, timeout=190):
    s = socket.create_connection((HOST, PORT), timeout=5)
    s.sendall(code.encode("utf-8"))
    s.shutdown(socket.SHUT_WR)
    s.settimeout(timeout)
    out = []
    while True:
        chunk = s.recv(65536)
        if not chunk:
            break
        out.append(chunk)
    s.close()
    return b"".join(out).decode("utf-8", "replace")


if __name__ == "__main__":
    if len(sys.argv) >= 3 and sys.argv[1] == "--file":
        src = open(sys.argv[2], encoding="utf-8").read()
    else:
        src = " ".join(sys.argv[1:])
    print(send(src))
