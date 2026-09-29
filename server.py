import http.server
import socketserver
import os
import sys

PORT = 8000
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def end_headers(self):
        # Enable CORS and caching headers for snappy local asset loading
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        super().end_headers()

    def guess_type(self, path):
        # Ensure JavaScript modules have proper MIME type
        if path.endswith('.js') or path.endswith('.mjs'):
            return 'application/javascript'
        if path.endswith('.css'):
            return 'text/css'
        if path.endswith('.html'):
            return 'text/html'
        return super().guess_type(path)

def run():
    socketserver.TCPServer.allow_reuse_address = True
    ports_to_try = [8000, 8080, 8081, 3000, 8888]
    httpd = None
    selected_port = None

    for port in ports_to_try:
        try:
            httpd = socketserver.TCPServer(("", port), Handler)
            selected_port = port
            break
        except OSError:
            continue

    if not httpd:
        try:
            # Fallback to any free OS port
            httpd = socketserver.TCPServer(("", 0), Handler)
            selected_port = httpd.server_address[1]
        except Exception as e:
            print(f"Error starting server: {e}")
            sys.exit(1)

    url = f"http://localhost:{selected_port}"
    print("==================================================")
    print(">> HYPERDRIFT 3D RACING SERVER RUNNING")
    print(f">> Open in your browser: {url}")
    print("==================================================")

    # Automatically open default browser if run directly or via bat script
    if '--open' in sys.argv:
        import webbrowser
        webbrowser.open(url)

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nServer shutting down.")
        httpd.server_close()

if __name__ == '__main__':
    run()
