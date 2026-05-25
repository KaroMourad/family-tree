"""Serve the family tree folder over local HTTP so the editor can save in-place.

Open http://localhost:8765/ after starting this.
"""
import http.server
import socketserver
import webbrowser
from pathlib import Path

PORT = 8765
DIRECTORY = Path(__file__).parent

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(DIRECTORY), **kwargs)

with socketserver.TCPServer(("127.0.0.1", PORT), Handler) as httpd:
    url = f"http://localhost:{PORT}/index.html"
    print(f"Serving {DIRECTORY} on {url}")
    print("Press Ctrl+C to stop.")
    webbrowser.open(url)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")
