"""Make your own captured icons the project's default icons.

1. In the app: Settings -> "Export my icons"  (downloads harmony-shake-icons-YYYY-MM-DD.json)
2. Run:  python scripts/import_icons.py path/to/harmony-shake-icons-YYYY-MM-DD.json
3. Run:  python scripts/build_seed.py

Each icon is written to public/icons/<item-id>.png (replacing the bdocodex .webp for that item)
and recorded in data/codex_icons.json with source "capture".
"""
import base64
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ICON_DIR = ROOT / 'public' / 'icons'
MANIFEST = ROOT / 'data' / 'codex_icons.json'


def main(path: str):
    data = json.loads(Path(path).read_text(encoding='utf-8'))
    if data.get('kind') != 'harmony-shake-icons':
        sys.exit('Not a Harmony Shake icon export (use Settings -> "Export my icons").')
    manifest = json.loads(MANIFEST.read_text(encoding='utf-8')) if MANIFEST.exists() else {}
    ICON_DIR.mkdir(parents=True, exist_ok=True)
    done = 0
    for item_id, url in data['icons'].items():
        if not url.startswith('data:image/png;base64,'):
            print(f'  skip {item_id}: not a PNG data URL')
            continue
        out = ICON_DIR / f'{item_id}.png'
        out.write_bytes(base64.b64decode(url.split(',', 1)[1]))
        old = manifest.get(item_id, {}).get('file')
        if old and old != f'/icons/{out.name}':
            (ROOT / 'public' / old.lstrip('/')).unlink(missing_ok=True)
        entry = manifest.get(item_id, {})
        entry.update({'file': f'/icons/{out.name}', 'source': 'capture'})
        manifest[item_id] = entry
        done += 1
        print(f'  ok {item_id}')
    MANIFEST.write_text(json.dumps(manifest, indent=2, ensure_ascii=False), encoding='utf-8')
    print(f'{done} icon(s) imported. Now run: python scripts/build_seed.py')


if __name__ == '__main__':
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
