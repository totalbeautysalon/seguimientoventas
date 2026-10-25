import http.server
import socketserver
import os
import webbrowser
import socket

def get_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"

PORT = 8085
os.chdir(os.path.dirname(os.path.abspath(__file__)))

Handler = http.server.SimpleHTTPRequestHandler
Handler.extensions_map.update({
    ".js": "application/javascript",
    ".css": "text/css",
    ".png": "image/png"
})

local_ip = get_ip()
print("=" * 60)
print(" TOTAL BEAUTY SALON Y ACADEMIA - ARQUEO DIARIO DE CAJA")
print("=" * 60)
print(f" Servidor local activo en: http://localhost:{PORT}")
print(f" Para abrir desde una tablet/celular en el salon: http://{local_ip}:{PORT}")
print(" Presione Ctrl + C para detener el servidor.")
print("=" * 60)

try:
    webbrowser.open(f"http://localhost:{PORT}")
except Exception:
    pass

try:
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        httpd.serve_forever()
except KeyboardInterrupt:
    print("\nServidor cerrado.")
