"""로컬 미리보기 서버(캐시 끔): python scripts/serve.py [port]  -> http://127.0.0.1:8765"""
import sys, functools, http.server, pathlib
class NoCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate"); super().end_headers()
web = pathlib.Path(__file__).resolve().parent.parent / "web"
port = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
http.server.ThreadingHTTPServer(("127.0.0.1", port), functools.partial(NoCache, directory=str(web))).serve_forever()
