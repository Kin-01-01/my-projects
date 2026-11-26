#!/usr/bin/env python3
# 本地静态服务器（针对本站的加载优化版）
# 相比 python -m http.server 的改进：
#   1) 多线程：21 个模块可并行加载（自带版单线程会串行排队）
#   2) HTTP/1.1 + keep-alive：复用 TCP 连接，省去每个请求三次握手
#   3) gzip 压缩：文本资源体积降到约 1/4（three.min.js 655KB -> 163KB）
#   4) 缓存策略：/vendor 与 /assets 视为不可变（一年强缓存）；源码与 HTML 走 ETag 协商缓存
#   5) 正确的 MIME（含 .mp3/.mjs/.webmanifest）
import gzip
import hashlib
import io
import os
import socketserver
import sys
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.dirname(os.path.abspath(__file__))
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8123

COMPRESSIBLE = {
    '.html', '.htm', '.css', '.js', '.mjs', '.json', '.svg', '.txt', '.md', '.xml', '.map',
}
IMMUTABLE_PREFIXES = ('/vendor/', '/assets/')
EXTRA_TYPES = {
    '.mjs': 'text/javascript',
    '.mp3': 'audio/mpeg',
    '.webmanifest': 'application/manifest+json',
    '.woff2': 'font/woff2',
}


class Handler(SimpleHTTPRequestHandler):
    protocol_version = 'HTTP/1.1'          # 开启 keep-alive
    server_version = 'ZeroStack/1.0'
    extensions_map = {**SimpleHTTPRequestHandler.extensions_map, **EXTRA_TYPES}

    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)

    # ---- 缓存策略 ----
    def end_headers(self):
        path = self.path.split('?')[0]
        if path.startswith(IMMUTABLE_PREFIXES):
            # 第三方库与素材：一年强缓存
            self.send_header('Cache-Control', 'public, max-age=31536000, immutable')
        else:
            # 源码与 HTML：禁止任何缓存（no-store）——每次刷新都必定拿到最新代码，
            # 杜绝"改了代码但页面仍在跑旧版本"导致的时序错觉
            self.send_header('Cache-Control', 'no-store, must-revalidate')
        self.send_header('Vary', 'Accept-Encoding')
        super().end_headers()

    def send_head(self):
        path = self.translate_path(self.path)
        if os.path.isdir(path):
            return super().send_head()
        if not os.path.isfile(path):
            return super().send_head()
        try:
            with open(path, 'rb') as f:
                raw = f.read()
        except OSError:
            return super().send_head()

        ext = os.path.splitext(path)[1].lower()
        etag = '"%s"' % hashlib.sha1(raw).hexdigest()[:20]

        # 协商缓存：命中则 304，浏览器直接复用本地副本（重载近乎瞬时）
        if self.headers.get('If-None-Match') == etag:
            self.send_response(HTTPStatus.NOT_MODIFIED)
            self.send_header('ETag', etag)
            self.send_header('Cache-Control',
                             'public, max-age=31536000, immutable'
                             if self.path.split('?')[0].startswith(IMMUTABLE_PREFIXES)
                             else 'no-cache, must-revalidate')
            self.end_headers()
            return None

        body = raw
        encoding = None
        if ext in COMPRESSIBLE and 'gzip' in (self.headers.get('Accept-Encoding') or ''):
            buf = io.BytesIO()
            with gzip.GzipFile(fileobj=buf, mode='wb', compresslevel=6) as gz:
                gz.write(raw)
            if buf.tell() < len(raw):
                body = buf.getvalue()
                encoding = 'gzip'

        # ---- Range 请求（206）：音频/视频播放与拖动进度依赖它 ----
        rng = self.headers.get('Range')
        start, end = 0, len(body) - 1
        partial = False
        if rng and rng.startswith('bytes=') and encoding is None:
            spec = rng[6:].split(',')[0].strip()
            a, _, b = spec.partition('-')
            try:
                if a == '':                       # bytes=-N（末尾 N 字节）
                    n = int(b)
                    start = max(0, len(body) - n)
                else:
                    start = int(a)
                    if b:
                        end = min(int(b), len(body) - 1)
                if 0 <= start <= end < len(body):
                    partial = True
                else:
                    start, end = 0, len(body) - 1
            except ValueError:
                start, end = 0, len(body) - 1

        payload = body[start:end + 1] if partial else body
        self.send_response(HTTPStatus.PARTIAL_CONTENT if partial else HTTPStatus.OK)
        self.send_header('Content-Type', self.guess_type(path))
        self.send_header('Content-Length', str(len(payload)))
        self.send_header('ETag', etag)
        if partial:
            self.send_header('Content-Range', 'bytes %d-%d/%d' % (start, end, len(body)))
            self.send_header('Accept-Ranges', 'bytes')
        else:
            self.send_header('Accept-Ranges', 'bytes')
        if encoding:
            self.send_header('Content-Encoding', encoding)
        self.end_headers()
        if self.command == 'HEAD':
            return None
        return io.BytesIO(payload)

    def log_message(self, fmt, *args):     # 精简日志
        sys.stderr.write('%s %s\n' % (self.address_string(), fmt % args))


class Server(ThreadingHTTPServer):
    daemon_threads = True
    allow_reuse_address = True


if __name__ == '__main__':
    os.chdir(ROOT)
    print('serving %s on http://127.0.0.1:%d  (threaded + gzip + cache)' % (ROOT, PORT))
    Server(('127.0.0.1', PORT), Handler).serve_forever()
