"""Generate src/seed.ts from harmony_tree_bdocodex.json (scraped from bdocodex.com).

Run:  python scripts/build_seed.py
"""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'harmony_tree_bdocodex.json'
ICONS = ROOT / 'data' / 'codex_icons.json'  # written by scripts/fetch_icons.py
OUT = ROOT / 'src' / 'seed.ts'

# Average output per normal Alchemy craft (game shows 1~4). The user's sheet assumes 3.
ALCHEMY_AVG_YIELD = 3
PROCESSING_AVG_YIELD = 2.5
# Primary recipe to keep when codex lists several for one output.
PREFERRED_RECIPE = {'Strong Elixir of Edania': 'mrecipe/7685'}
# Higher-grade elixir -> base elixir. In draught variants, x10 higher grade replaces x30 base.
HIGHER_GRADE = {
    'Elixir of Frenzy': 'Elixir of Endless Frenzy',
    'Elixir of Concentration': 'Elixir of Advanced Concentration',
    'Elixir of Fury': 'Elixir of Endless Fury',
    'Elixir of Destruction': 'Elixir of Lethal Destruction',
    'Elixir of Life': 'Elixir of Strong Life',
    'Defense Elixir': 'Elixir of Steel Defense',
    'Elixir of Endurance': 'Elixir of Overwhelming Endurance',
    'Helix Elixir': 'Splendid Helix Elixir',
    'Elixir of Wind': 'Elixir of Flowing Wind',
    'Elixir of Swiftness': 'Elixir of Intrepid Swiftness',
    'Elixir of Spells': 'Elixir of Agile Spells',
    'Elixir of Shock': 'Elixir of Strong Shock',
    'Elixir of Draining': 'Elixir of Strong Draining',
    'Elixir of Perforation': 'Elixir of Brutal Perforation',
    'Elixir of Death': 'Brutal Death Elixir',
    "Grim Reaper's Elixir": "Grim Soul Reaper's Elixir",
    'Elixir of Assassination': 'Elixir of Lethal Assassin',
    'Elixir of Detection': 'Elixir of Sharp Detection',
    'Elixir of Carnage': 'Elixir of Brutal Carnage',
    'Elixir of Sky': 'Merciless Sky Elixir',
    # Party Harmony variants (mrecipe/7675-7681): 1 blue replaces 3 green here too.
    'Elixir of Will': 'Elixir of Remarkable Will',
    'Elixir of Edania': 'Strong Elixir of Edania',
}


def slug(s: str) -> str:
    return re.sub(r'[^a-z0-9]+', '-', s.lower().replace("'", '')).strip('-')


data = json.loads(SRC.read_text(encoding='utf-8'))

items: dict[str, dict] = {}
by_name: dict[str, str] = {}


def add_item(en, th=None, category='raw', codex=None, note=None):
    iid = slug(en)
    if iid in items:
        it = items[iid]
        if th and not it.get('nameTh'):
            it['nameTh'] = th
        return iid
    it = {'id': iid, 'name': en, 'category': category}
    if th:
        it['nameTh'] = th
    if codex:
        it['codexId'] = codex
    if note:
        it['note'] = note
    items[iid] = it
    by_name[en] = iid
    return iid


# Items missing from the original crawl (checked on bdocodex 2026-10-06).
EXTRA_ITEMS = [
    {'en': 'Elixir of Remarkable Will', 'th': 'น้ำยาอีลิกเซอร์แห่งความตั้งใจที่ยอดเยี่ยม', 'codexId': 703, 'kind': 'intermediate'},
]

# The Party recipe has 8 variants on bdocodex. Use mrecipe/7677: 3x Elixir of Will + 1x Harmony Draught
# + 3x Elixir of Edania + 1x Spellbound Catalyst. It skips crafting Strong Elixir of Edania (no Blue Reagent);
# blue-grade Will / Strong Edania in stock still count ×3 through stockAliases.
PARTY_RECIPE = {
    'output': '[Party] Harmony Draught - Edania',
    'codexRecipe': 'mrecipe/7677',
    'method': 'Simple Alchemy',
    'outputQty': '1',
    'ingredients': [
        {'name': 'Elixir of Will', 'qty': 3, 'group': False},
        {'name': 'Harmony Draught', 'qty': 1, 'group': False},
        {'name': 'Elixir of Edania', 'qty': 3, 'group': False},
        {'name': 'Spellbound Catalyst', 'qty': 1, 'group': False},
    ],
}
data['recipes'] = [PARTY_RECIPE] + [r for r in data['recipes'] if r['output'] != PARTY_RECIPE['output']]

for it in data['items'] + EXTRA_ITEMS:
    cat = {'product': 'product', 'intermediate': 'intermediate'}.get(it['kind'], 'raw')
    add_item(it['en'], it.get('th'), cat, it.get('codexId'), it.get('obtain'))

# Ingredient groups: "<base> (any)" with weighted members.
group_ids: dict[str, str] = {}
for gname, members in data['groups'].items():
    base_th = next((m['th'] for m in members if m['en'] == gname), None) or items.get(slug(gname), {}).get('nameTh')
    gid = 'g-' + slug(gname)
    member_ids, aliases = [], []
    for m in members:
        mid = add_item(m['en'], m.get('th'), 'raw')
        member_ids.append(mid)
        worth = m.get('worth') or 1
        aliases.append({'itemId': mid, 'factor': worth})
    items[gid] = {
        'id': gid,
        'name': f'{gname} (any)',
        'nameTh': f'{base_th} (กลุ่ม)' if base_th else None,
        'category': 'group',
        'members': member_ids,
        'stockAliases': aliases,
        'note': 'Any of: ' + ', '.join(f"{m['en']} ×{m.get('worth') or 1}" for m in members),
    }
    group_ids[gname] = gid

recipes = []
seen_outputs = set()
for r in data['recipes']:
    out = r['output']
    if out in PREFERRED_RECIPE and r['codexRecipe'] != PREFERRED_RECIPE[out]:
        continue
    if out in seen_outputs:
        continue
    seen_outputs.add(out)
    oid = by_name.get(out) or add_item(out, category='intermediate')
    if items[oid]['category'] == 'raw':
        items[oid]['category'] = 'intermediate'
    method = r['method']
    q = str(r['outputQty'])
    if method == 'Simple Alchemy':
        y = float(q) if q.replace('.', '').isdigit() else 1
    elif method == 'Alchemy':
        y = ALCHEMY_AVG_YIELD if '~' in q else float(q)
    else:
        method = 'Processing'
        y = PROCESSING_AVG_YIELD if '~' in q else float(q)
    ings = []
    for g in r['ingredients']:
        if g['group'] and g['name'] in group_ids:
            ings.append({'itemId': group_ids[g['name']], 'qty': g['qty']})
        else:
            ings.append({'itemId': by_name.get(g['name']) or add_item(g['name']), 'qty': g['qty']})
    rec = {'id': 'r-' + oid, 'output': oid, 'method': method, 'yield': y, 'ingredients': ings, 'codex': r['codexRecipe']}
    if method == 'Alchemy':
        # Range yields (1~4) follow the shared in-app Alchemy average; a fixed codex yield (e.g. Edania = 1) stays fixed.
        rec['fixedYield'] = '~' not in q
    recipes.append(rec)

for base, hi in HIGHER_GRADE.items():
    b, h = by_name.get(base), by_name.get(hi)
    if b and h:
        items[b]['stockAliases'] = [{'itemId': h, 'factor': 3}]
        items[h]['note'] = f'Higher grade of {base}; counts as 3× {base} for draughts.'
    else:
        print('WARN missing higher grade', base, hi)

icon_manifest = json.loads(ICONS.read_text(encoding='utf-8')) if ICONS.exists() else {}
for iid, m in icon_manifest.items():
    if iid not in items:
        continue
    if m.get('codexId') and not items[iid].get('codexId'):
        items[iid]['codexId'] = m['codexId']
    if m.get('file'):
        items[iid]['defaultIcon'] = m['file']
    if m.get('grade') is not None:
        items[iid]['grade'] = m['grade']

# Groups show their base member's icon (e.g. "Bear Blood (any)" uses the Bear Blood icon).
for it in items.values():
    if it['category'] == 'group' and it.get('members'):
        base = items.get(it['members'][0], {})
        if base.get('defaultIcon'):
            it['defaultIcon'] = base['defaultIcon']

for it in items.values():
    if it.get('nameTh') is None:
        it.pop('nameTh', None)

order = {'product': 0, 'intermediate': 1, 'raw': 2, 'group': 3}
item_list = sorted(items.values(), key=lambda i: (order[i['category']], i['name']))

ts = [
    '// AUTO-GENERATED by scripts/build_seed.py from harmony_tree_bdocodex.json (bdocodex.com). Do not edit by hand.',
    "import type { Item, Recipe } from './types'",
    '',
    'export const SEED_VERSION = 6',
    '',
    'export const SEED_ITEMS: Item[] = ' + json.dumps(item_list, ensure_ascii=False, indent=2),
    '',
    'export const SEED_RECIPES: Recipe[] = ' + json.dumps(recipes, ensure_ascii=False, indent=2),
    '',
]
OUT.write_text('\n'.join(ts), encoding='utf-8')
print(f'{len(item_list)} items, {len(recipes)} recipes -> {OUT}')
