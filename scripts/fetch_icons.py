"""Download item icons from bdocodex.com into public/icons/ and record them in data/codex_icons.json.

- Items with a known codexId: icon is read from the item page (img.item_icon).
- Items without one (group members like "Lion Blood"): looked up via bdocodex autocomplete by English name.
Already-downloaded icons are skipped, so the script can be re-run safely.

Run:  python scripts/fetch_icons.py   (then python scripts/build_seed.py)
"""
import json
import re
import time
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SEED = ROOT / 'src' / 'seed.ts'
ICON_DIR = ROOT / 'public' / 'icons'
MANIFEST = ROOT / 'data' / 'codex_icons.json'
BASE = 'https://bdocodex.com'
UA = {'User-Agent': 'Mozilla/5.0 (HarmonyShake icon fetcher; personal use)'}
DELAY = 0.4  # be polite to bdocodex


def get(url: str) -> bytes:
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read()


def seed_items():
    text = SEED.read_text(encoding='utf-8')
    m = re.search(r'SEED_ITEMS: Item\[\] = (\[.*?\n\])', text, re.S)
    return json.loads(m.group(1))


def icon_from_item_page(codex_id: int):
    html = get(f'{BASE}/us/item/{codex_id}/').decode('utf-8', 'replace')
    m = re.search(r'<img src="(/items/[^"]+)" class="item_icon', html)
    return m.group(1) if m else None


def lookup_by_name(name: str, codex_id=None):
    """Returns (codexId, icon path, grade) from bdocodex autocomplete."""
    url = f'{BASE}/ac.php?l=us&term={urllib.parse.quote(name)}'
    data = json.loads(get(url).decode('utf-8-sig'))
    items = [d for d in data if d.get('link_type') == 'item']
    by_id = [d for d in items if codex_id and int(d['value']) == int(codex_id)]
    exact = [d for d in items if d['name'].lower() == name.lower()]
    hit = (by_id or exact or items or [None])[0]
    if not hit:
        return None, None, None
    return int(hit['value']), f"/{hit['icon_path']}/{hit['icon']}", hit.get('grade')


def main():
    ICON_DIR.mkdir(parents=True, exist_ok=True)
    MANIFEST.parent.mkdir(parents=True, exist_ok=True)
    manifest = json.loads(MANIFEST.read_text(encoding='utf-8')) if MANIFEST.exists() else {}

    for it in seed_items():
        if it['category'] == 'group':
            continue
        iid = it['id']
        entry = manifest.get(iid, {})
        try:
            if entry.get('file') and (ROOT / 'public' / entry['file'].lstrip('/')).exists():
                if 'grade' not in entry:  # older manifest: only fill in the item grade
                    _, _, entry['grade'] = lookup_by_name(it['name'], entry.get('codexId'))
                    manifest[iid] = entry
                    MANIFEST.write_text(json.dumps(manifest, indent=2, ensure_ascii=False), encoding='utf-8')
                    time.sleep(DELAY)
                continue
            codex_id = it.get('codexId') or entry.get('codexId')
            icon_path = None
            if codex_id:
                icon_path = icon_from_item_page(codex_id)
                time.sleep(DELAY)
            found_id, ac_icon, grade = lookup_by_name(it['name'], codex_id)
            time.sleep(DELAY)
            icon_path = icon_path or ac_icon
            codex_id = codex_id or found_id
            if not icon_path:
                print(f'  !! no icon found for {it["name"]}')
                manifest[iid] = {'codexId': codex_id}
                continue
            ext = Path(icon_path).suffix or '.webp'
            out = ICON_DIR / f'{iid}{ext}'
            out.write_bytes(get(BASE + icon_path))
            time.sleep(DELAY)
            manifest[iid] = {'codexId': codex_id, 'grade': grade, 'source': icon_path, 'file': f'/icons/{out.name}'}
            print(f'  ok {it["name"]} -> {out.name}')
        except Exception as e:  # keep going; re-run picks up failures
            print(f'  !! {it["name"]}: {e}')
        MANIFEST.write_text(json.dumps(manifest, indent=2, ensure_ascii=False), encoding='utf-8')

    have = sum(1 for v in manifest.values() if v.get('file'))
    print(f'{have} icons in {ICON_DIR}')


if __name__ == '__main__':
    main()
