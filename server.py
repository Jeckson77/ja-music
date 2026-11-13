from http.server import BaseHTTPRequestHandler, HTTPServer
import os

class Removed(BaseHTTPRequestHandler):
    def do_HEAD(self):
        self.send_response(200 if self.path == "/" else 404)
        self.end_headers()

    def do_GET(self):
        if self.path == "/":
            body = b"Site removed."
            self.send_response(200)
        else:
            body = b"Not found."
            self.send_response(404)
        self.send_header("Content-Type", "text/plain; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        self.send_response(404)
        self.end_headers()

HTTPServer(("0.0.0.0", int(os.environ.get("PORT", "10000"))), Removed).serve_forever()
