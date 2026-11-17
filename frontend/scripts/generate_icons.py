"""Ícones PWA sem dependências externas. Execute da raiz do frontend."""
import struct
import zlib
from pathlib import Path


def chunk(kind, content):
    return struct.pack('!I', len(content)) + kind + content + struct.pack('!I', zlib.crc32(kind + content))


for size in (192, 512):
    data = bytearray()
    for y in range(size):
        data.append(0)
        for x in range(size):
            a, b = x / size, y / size
            color = (20, 91, 73)
            roof = .24 < a < .76 and abs(b - (.26 + abs(a - .5) * .8)) < .025
            walls = .31 < b < .73 and (.27 < a < .30 or .70 < a < .73)
            floor = .27 < a < .73 and .70 < b < .73
            cross = (.475 < a < .525 and .43 < b < .65) or (.39 < a < .61 and .515 < b < .565)
            if roof or walls or floor:
                color = (255, 255, 255)
            if cross:
                color = (217, 237, 162)
            data.extend(color)
    png = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('!2I5B', size, size, 8, 2, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(data)) + chunk(b'IEND', b'')
    Path(f'public/icon-{size}.png').write_bytes(png)
