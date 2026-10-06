/** Thai UI strings (recipes), keyed by the English source text. */
export const TH_RECIPES: Record<string, string> = {
  // Category labels (also defined in th-core via common.tsx)
  'Raw materials': 'วัตถุดิบ',

  // Craft methods (option text only; values stay English)
  Alchemy: 'แปรธาตุ',
  'Simple Alchemy': 'แปรธาตุอย่างง่าย',
  Cooking: 'ทำอาหาร',
  'Simple Cooking': 'ทำอาหารอย่างง่าย',
  Processing: 'แปรรูป',
  Other: 'อื่น ๆ',

  // Recipes page — item list
  'Filter…': 'ค้นหา…',
  recipe: 'สูตร',
  'Avg yield for all Alchemy recipes:': 'จำนวนที่ได้เฉลี่ยของสูตรแปรธาตุทั้งหมด:',
  Apply: 'ใช้ค่านี้',
  'Restore default items & recipes? Your stock, history and icons are kept; custom recipe edits are lost.':
    'คืนค่าไอเทมและสูตรเริ่มต้นใช่ไหม? ของในคลัง ประวัติ และไอคอนจะยังอยู่ แต่สูตรที่แก้เองจะหายไป',
  'Restore default recipes': 'คืนค่าสูตรเริ่มต้น',
  'Select an item.': 'เลือกไอเทมก่อนนะ',

  // Item editor
  'Delete "{name}" and its recipe?': 'ลบ "{name}" และสูตรของมันใช่ไหม?',
  'Delete item': 'ลบไอเทม',
  'English name': 'ชื่อภาษาอังกฤษ',
  'Thai name': 'ชื่อภาษาไทย',
  Category: 'หมวดหมู่',
  'Reference icon': 'ไอคอนอ้างอิง',
  'Use bdocodex icon': 'ใช้ไอคอนจาก bdocodex',
  Remove: 'ลบออก',
  Database: 'ฐานข้อมูล',
  Note: 'โน้ต',
  'Group members (stock of any of these counts)': 'สมาชิกในกลุ่ม (มีอันไหนในคลังก็นับได้)',
  'Add member': 'เพิ่มสมาชิก',
  'Counts as this item in stock (e.g. blue-grade elixir = 3 green)': 'นับเป็นไอเทมนี้ในคลังได้ (เช่น ยาเกรดฟ้า 1 = เกรดเขียว 3)',
  Add: 'เพิ่ม',
  Recipe: 'สูตร',
  'Remove recipe': 'ลบสูตร',
  'Add recipe': 'เพิ่มสูตร',
  'No recipe — treated as a raw material (bought / gathered / dropped).': 'ยังไม่มีสูตร — จะนับเป็นวัตถุดิบ (ซื้อ / เก็บเอง / ดรอปจากมอน)',
  Method: 'วิธีทำ',
  'Average units you get per craft, including procs. E.g. 3 if one alchemy craft gives ~3 elixirs on average.':
    'จำนวนเฉลี่ยที่ได้ต่อการทำ 1 ครั้ง (รวมของที่ได้เพิ่มแล้ว) เช่น ใส่ 3 ถ้าแปรธาตุ 1 ครั้งได้ยาประมาณ 3 ขวด',
  'Avg yield per craft': 'จำนวนที่ได้เฉลี่ยต่อครั้ง',
  Ingredient: 'วัตถุดิบ',
  'Qty per craft': 'จำนวนต่อครั้ง',
  'Add ingredient': 'เพิ่มวัตถุดิบ',
  'Learned from your scans: {n} slot picture(s).': 'เรียนรู้จากการสแกนของคุณแล้ว: {n} รูปช่องไอเทม',
  'Forget (if it was learned wrong)': 'ลืมทิ้ง (ถ้าจำผิด)',
  'Used in': 'ใช้ทำ',

  // Token log page
  'Clear the whole token log?': 'ล้างบันทึกโทเคนทั้งหมดใช่ไหม?',
  'Token usage': 'การใช้โทเคน',
  'Every Claude API call made by the screenshot reader is logged here (stored in this browser only). Cost is an estimate from list prices.':
    'ทุกครั้งที่ตัวอ่านภาพหน้าจอเรียกใช้ Claude API จะถูกบันทึกไว้ที่นี่ (เก็บไว้ในเบราว์เซอร์นี้เท่านั้น) ค่าใช้จ่ายเป็นแค่ราคาประมาณจากราคาตั้ง',
  '{calls} call(s) · input {input} · output {output} · cache {cache} · est. {cost}':
    '{calls} ครั้ง · อินพุต {input} · เอาต์พุต {output} · แคช {cache} · ประมาณ {cost}',
  'Export CSV': 'ส่งออก CSV',
  'Clear log': 'ล้างบันทึก',
  'Per day': 'รายวัน',
  Day: 'วันที่',
  Calls: 'การเรียกใช้',
  Tokens: 'โทเคน',
  'Est. cost': 'ค่าใช้จ่ายโดยประมาณ',
  'No API calls yet. Scan a screenshot to see usage here.': 'ยังไม่มีการเรียก API เลย ลองสแกนภาพหน้าจอดูก่อน แล้วการใช้งานจะขึ้นที่นี่',
  When: 'เวลา',
  Kind: 'ประเภท',
  Model: 'โมเดล',
  Input: 'อินพุต',
  Output: 'เอาต์พุต',
  'Cache read / write': 'แคช อ่าน / เขียน',
  Total: 'รวม',
  Time: 'ใช้เวลา',
  '(asked {model})': '(ขอใช้ {model})',
  'Shared Alchemy average (change it in the box on the left or on the Calculator)': 'ใช้ค่าเฉลี่ยแปรธาตุรวม (แก้ได้ที่ช่องด้านซ้าย หรือหน้าคำนวณ)',
  'Use its own fixed yield instead': 'ใช้จำนวนที่ได้แบบคงที่ของสูตรนี้แทน',
  'Use the shared Alchemy average': 'ใช้ค่าเฉลี่ยแปรธาตุรวม',
}
