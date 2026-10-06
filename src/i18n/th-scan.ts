/** Thai UI strings (scan), keyed by the English source text. */
export const TH_SCAN: Record<string, string> = {
  // ScanPage — messages
  'No regular grid found — fit it with the handles.': 'หาตารางช่องไม่เจอ — ลากจุดจับเพื่อปรับให้พอดีเองนะ',
  'Add your Anthropic API key in Settings first.': 'ใส่ Anthropic API key ในหน้าตั้งค่าก่อนนะ',
  'No occupied slots in this grid — check the grid first.': 'ไม่มีช่องที่มีไอเทมในตารางนี้ — ลองตรวจตารางก่อนนะ',
  'not read': 'อ่านไม่ได้',
  '(reader said {name})': '(ตัวอ่านบอกว่าเป็น {name})',
  'Replaced {n} icon(s) in public/icons/.': 'เปลี่ยนไอคอน {n} รายการใน public/icons/ แล้ว',
  '(Seed not regenerated: run python scripts/build_seed.py.)': '(ยังไม่ได้สร้าง seed ใหม่: ให้รัน python scripts/build_seed.py)',
  'Could not write icons: {error}': 'บันทึกไอคอนไม่สำเร็จ: {error}',
  'Updated {n} item icon(s) in this browser.': 'อัปเดตไอคอนไอเทม {n} รายการในเบราว์เซอร์นี้แล้ว',
  'Saved. Updated {n} item(s) in stock. Learned {m} new slot picture(s) for next time.':
    'บันทึกแล้ว! อัปเดตสต็อก {n} รายการ และจำภาพช่องใหม่ได้ {m} ภาพไว้ใช้ครั้งหน้า',
  'added by hand': 'เพิ่มเอง',
  'pasted image': 'ภาพที่วาง',

  // vision.ts errors (shown via s.error)
  'The model declined to read this image.': 'AI ไม่ยอมอ่านภาพนี้',
  'Response was cut off (64k output tokens) — split the screenshot into two halves.':
    'คำตอบถูกตัดกลางคัน (เกิน 64k output tokens) — ลองแบ่งภาพหน้าจอเป็นสองครึ่งนะ',
  'Unexpected response shape': 'รูปแบบคำตอบไม่ถูกต้อง',

  // Step 1
  'Step 1 · Paste (Ctrl+V)': 'ขั้นที่ 1 · วาง (Ctrl+V)',
  'screenshots of your storage, drop them here, or': 'ภาพหน้าจอคลังสินค้าของคุณ ลากมาวางตรงนี้ หรือ',
  'choose files': 'เลือกไฟล์',
  '. You can add several pages.': ' — เพิ่มได้หลายหน้าเลย',
  'Crop to just the slot grid. The app finds the grid, cuts out every slot, and only sends slots with items to the reader. Slots you confirm are remembered ({n} learned so far).':
    'ครอปให้เหลือแค่ตารางช่อง แอปจะหาตาราง ตัดแยกทุกช่อง แล้วส่งเฉพาะช่องที่มีไอเทมไปให้ตัวอ่าน ช่องที่คุณยืนยันแล้วจะถูกจำไว้ (ตอนนี้จำได้ {n} ภาพ)',

  // Shot list / status pills
  ready: 'พร้อม',
  scanning: 'กำลังสแกน',
  done: 'เสร็จแล้ว',
  error: 'ผิดพลาด',
  'reading…': 'กำลังอ่าน…',
  'Re-scan': 'สแกนใหม่',
  Scan: 'สแกน',
  'Remove screenshot': 'ลบภาพหน้าจอ',
  '{n} slots with items': 'มีไอเทม {n} ช่อง',
  'Scan all new': 'สแกนภาพใหม่ทั้งหมด',

  // Step 2 — GridEditor
  'Step 2 · Check the grid': 'ขั้นที่ 2 · ตรวจตาราง',
  '{cols}×{rows} slots · {n} with items · grid {source}': '{cols}×{rows} ช่อง · มีไอเทม {n} ช่อง · ตาราง{source}',
  'remembered from last time': 'จำไว้จากครั้งก่อน',
  'auto-detected': 'หาให้อัตโนมัติ',
  'not found — please fit it': 'หาไม่เจอ — ช่วยปรับให้พอดีหน่อย',
  adjusted: 'ปรับเองแล้ว',
  'Every slot should sit inside one box.': 'แต่ละช่องควรอยู่ในกรอบของตัวเองพอดี',
  'Drag the': 'ลากจุด',
  'top-left and': 'มุมซ้ายบน และจุด',
  'bottom-right handles to fit, adjust the column/row count, and click a slot to mark it empty / occupied (dimmed = empty, skipped).':
    'มุมขวาล่างให้พอดี ปรับจำนวนคอลัมน์/แถว แล้วคลิกที่ช่องเพื่อสลับว่าว่างหรือมีของ (สีจาง = ช่องว่าง ข้ามไป)',
  Columns: 'คอลัมน์',
  Rows: 'แถว',
  Move: 'เลื่อน',
  'Auto-detect': 'หาอัตโนมัติ',
  Zoom: 'ซูม',
  screenshot: 'ภาพหน้าจอ',
  'row {r}, col {c}': 'แถว {r} คอลัมน์ {c}',
  'empty (click to include)': 'ว่าง (คลิกเพื่อนับรวม)',
  'has item (click to skip)': 'มีไอเทม (คลิกเพื่อข้าม)',

  // Step 3 — audit
  'Step 3 · Audit the reading': 'ขั้นที่ 3 · ตรวจสอบผลการอ่าน',
  '{n} slot(s) recognised from your earlier confirmations': 'จำได้ {n} ช่องจากที่คุณเคยยืนยันไว้',
  'Nothing is saved until you confirm in step 4.': 'ยังไม่มีอะไรถูกบันทึกจนกว่าจะกดยืนยันในขั้นที่ 4',
  Use: 'ใช้',
  Slot: 'ช่อง',
  Ingredient: 'วัตถุดิบ',
  Amount: 'จำนวน',
  'Reader saw': 'ตัวอ่านเห็นว่า',
  Confidence: 'ความมั่นใจ',
  'slot #{n}': 'ช่อง #{n}',
  'Click to enlarge': 'คลิกเพื่อขยาย',
  '— choose ingredient —': '— เลือกวัตถุดิบ —',
  'The game shows rounded numbers for big stacks. Hover the item in game for the exact count.':
    'ในเกมจะแสดงตัวเลขแบบปัดเศษเมื่อของเยอะ ให้เอาเมาส์ชี้ไอเทมในเกมเพื่อดูจำนวนจริง',
  'shown as “{q}” — rounded': 'แสดงเป็น “{q}” — ปัดเศษแล้ว',
  'added manually': 'ใส่เอง',
  high: 'สูง',
  medium: 'กลาง',
  low: 'ต่ำ',
  'Matched a slot picture you confirmed before': 'ตรงกับภาพช่องที่คุณเคยยืนยันไว้',
  learned: 'จำได้',
  'Delete row': 'ลบแถว',
  'Add missed item': 'เพิ่มไอเทมที่ตกหล่น',
  'Slots the reader could not match to a recipe ingredient (gear, food, other items)':
    'ช่องที่ตัวอ่านจับคู่กับวัตถุดิบในสูตรไม่ได้ (อุปกรณ์ อาหาร ไอเทมอื่นๆ)',
  'Show skipped items ({n})': 'แสดงไอเทมที่ข้ามไป ({n})',
  'On Confirm & save, each confirmed slot picture replaces that item’s icon file in public/icons/ (backup: icons_first_version.bak/)':
    'เมื่อกด ยืนยันและบันทึก ภาพช่องที่ยืนยันแล้วจะไปแทนไฟล์ไอคอนของไอเทมนั้นใน public/icons/ (สำรองไว้ที่ icons_first_version.bak/)',
  'Writing files needs the local dev server (npm run dev). Here the icons are only updated in this browser.':
    'การเขียนไฟล์ต้องใช้เซิร์ฟเวอร์ในเครื่อง (npm run dev) ตรงนี้ไอคอนจะอัปเดตแค่ในเบราว์เซอร์นี้เท่านั้น',
  'Update icons in public/icons/': 'อัปเดตไอคอนใน public/icons/',
  'Update icons (this browser only)': 'อัปเดตไอคอน (เฉพาะเบราว์เซอร์นี้)',
  '{n} row(s) need an ingredient (or untick "Use").': 'มี {n} แถวที่ยังไม่ได้เลือกวัตถุดิบ (หรือเอาติ๊ก "ใช้" ออก)',
  'Reader note ({name}):': 'หมายเหตุจากตัวอ่าน ({name}):',

  // Step 4 — confirm
  'Step 4 · Confirm changes to stock': 'ขั้นที่ 4 · ยืนยันการเปลี่ยนแปลงสต็อก',
  'Replace with these amounts': 'แทนที่ด้วยจำนวนเหล่านี้',
  'Add to current stock': 'บวกเพิ่มเข้าสต็อกเดิม',
  'Confirm & save {n} item(s)': 'ยืนยันและบันทึก {n} รายการ',
  'Rows with the same ingredient are summed (one item split over several slots or pages). Confirming also teaches the app these slot pictures.':
    'แถวที่เป็นวัตถุดิบเดียวกันจะถูกรวมกัน (ของชิ้นเดียวที่แยกอยู่หลายช่องหรือหลายหน้า) การยืนยันยังช่วยสอนแอปให้จำภาพช่องเหล่านี้ด้วย',
  Current: 'ตอนนี้',
  New: 'ใหม่',
  Change: 'เปลี่ยนแปลง',

  // SlotModal
  'Slot detail': 'รายละเอียดช่อง',
  'Slot #{n}': 'ช่อง #{n}',
  Close: 'ปิด',
  'Your screenshot': 'ภาพหน้าจอของคุณ',
  cell: 'ช่อง',
  'Matched item': 'ไอเทมที่จับคู่ได้',
  none: 'ไม่มี',
  'Where it is': 'อยู่ตรงไหน',
  'Ingredient:': 'วัตถุดิบ:',
  "Use this exact slot picture as the item's icon everywhere (and in the reader's reference sheet)":
    'ใช้ภาพช่องนี้เป็นไอคอนของไอเทมทุกที่ (รวมถึงในแผ่นอ้างอิงของตัวอ่านด้วย)',
  'Saved as icon ✓': 'บันทึกเป็นไอคอนแล้ว ✓',
  'Use as item icon': 'ใช้เป็นไอคอนไอเทม',
  'Reader saw: {label}': 'ตัวอ่านเห็นว่า: {label}',

  // ReferenceSheetPreview
  'Reference sheet': 'แผ่นอ้างอิง',
  'icons from bdocodex (or your saved ones) that the reader compares against': 'ไอคอนจาก bdocodex (หรือที่คุณบันทึกไว้) ที่ตัวอ่านใช้เทียบ',
  '{n} items. Frame color = item grade.': '{n} รายการ · สีกรอบ = เกรดไอเทม',
  'reference sheet': 'แผ่นอ้างอิง',
  'Building…': 'กำลังสร้าง…',
}
