"""실 API나 기존 DB를 건드리지 않고 HTTP→저장 경계를 검사한다."""
import concurrent.futures
import json
import sqlite3
import threading
import unittest
import zlib
import uuid
from contextlib import closing, contextmanager
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import urlopen
from unittest.mock import patch

import server


@contextmanager
def test_directory():
    # Python 3.14의 Windows 임시 폴더 전용 ACL 대신 작업 폴더 권한을 상속한다.
    directory = server.ROOT / 'qa' / ('cache-test-' + uuid.uuid4().hex)
    directory.mkdir()
    try:
        yield directory
    finally:
        for file in directory.iterdir():
            file.unlink()
        directory.rmdir()


class CachePolicyTest(unittest.TestCase):
    def test_http_storage_policy(self):
        a = server.REGISTERED_POINTS['station']
        b = server.REGISTERED_POINTS['p8']
        coords = dict(zip(('start_x', 'start_y', 'end_x', 'end_y'), (*a, *b)))
        result = {'status': 'OK', 'routes': [{'meters': 650, 'minutes': 12}]}
        calls = []

        def provider(mode, points):
            calls.append((mode, dict(points)))
            return 200, result

        class QuietHandler(server.Handler):
            def log_message(self, *args):
                pass

        with test_directory() as directory, patch.object(server, 'fetch_kakao_route', provider):
            database = Path(directory) / 'test.sqlite3'
            with patch.object(server, 'WALK_CACHE_DB', database):
                http = server.ThreadingHTTPServer(('127.0.0.1', 0), QuietHandler)
                thread = threading.Thread(target=http.serve_forever, daemon=True)
                thread.start()
                try:
                    def request(start='', end='', points=None):
                        query = dict(mode='walk', start_id=start, end_id=end, **(points or coords))
                        with urlopen(f'http://127.0.0.1:{http.server_port}/api/route?{urlencode(query)}') as response:
                            return json.load(response)

                    # 같은 좌표라도 주소 입력/현재 위치/ID 없는 구버전 요청은 저장 금지.
                    request(); request('custom', 'p8'); request('station', 'current')
                    self.assertFalse(database.exists())
                    self.assertEqual(len(calls), 3)
                    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as workers:
                        list(workers.map(lambda _: request('station', 'p8'), range(4)))
                    self.assertEqual(len(calls), 4, '등록 구간 동시 조회는 한 번만 API 호출')
                    request('station', 'p8')
                    self.assertEqual(len(calls), 4)
                    with closing(sqlite3.connect(database)) as db:
                        self.assertEqual(db.execute('SELECT COUNT(*) FROM walk_routes').fetchone()[0], 1)
                    # 등록 캐시가 있어도 임의 주소는 그것을 읽지 않는다.
                    request('custom', 'p8'); request('station', '')
                    self.assertEqual(len(calls), 6)
                    forged = {**coords, 'start_x': '126.3861234'}
                    request('station', 'p8', forged)
                    unknown = {**coords, 'end_y': '34.7921234'}
                    # 예전에 저장된 임의 구간도 앞으로 재사용하지 않는다.
                    with closing(sqlite3.connect(database)) as db:
                        db.execute('INSERT INTO walk_routes(route_key,response) VALUES (?,?)',
                                   (server.walk_cache_key(unknown), zlib.compress(json.dumps(result).encode())))
                        db.commit()
                    request('custom', 'custom', unknown)
                    self.assertEqual(len(calls), 8)
                    # 함수 직접 호출도 저장 검사를 우회할 수 없다.
                    server.save_walk_route(forged, result, 'station', 'p8')
                    self.assertIsNone(server.cached_walk_route(unknown, 'custom', 'custom'))
                    with closing(sqlite3.connect(database)) as db:
                        self.assertEqual(db.execute('SELECT COUNT(*) FROM walk_routes').fetchone()[0], 2)
                    reverse = dict(zip(('start_x','start_y','end_x','end_y'), (*b,*a)))
                    request('p8', 'station', reverse)
                    with closing(sqlite3.connect(database)) as db:
                        self.assertEqual(db.execute('SELECT COUNT(*) FROM walk_routes').fetchone()[0], 3)
                    self.assertEqual(server.cached_walk_route(coords, 'station', 'p8'), result)
                finally:
                    http.shutdown()
                    http.server_close()
                    thread.join()


if __name__ == '__main__':
    unittest.main()
