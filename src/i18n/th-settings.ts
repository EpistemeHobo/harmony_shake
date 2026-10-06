/** Thai UI strings (settings), keyed by the English source text. */
export const TH_SETTINGS: Record<string, string> = {
  'Language (interface and item names)': 'ภาษา (หน้าเว็บและชื่อไอเทม)',
  'Screenshot reader': 'ตัวอ่านภาพหน้าจอ',
  'Learned slot pictures:': 'รูปช่องเก็บของที่จำไว้แล้ว:',
  '(from confirmed scans; used to recognise the same items next time)':
    '(มาจากการสแกนที่คุณกดยืนยันแล้ว ใช้ช่วยจำไอเทมเดิมได้ในครั้งต่อไป)',
  'Forget all learned slot pictures?': 'ลบรูปช่องเก็บของที่จำไว้ทั้งหมดเลยไหม?',
  'Forget all': 'ลบที่จำไว้ทั้งหมด',
  'Your own item icons (captured from screenshots):': 'ไอคอนไอเทมของคุณเอง (ตัดมาจากภาพหน้าจอ):',
  "Download them as one file; run scripts/import_icons.py on it to make them the project's default icons":
    'ดาวน์โหลดไอคอนทั้งหมดเป็นไฟล์เดียว แล้วรัน scripts/import_icons.py กับไฟล์นั้น เพื่อใช้เป็นไอคอนหลักของโปรเจกต์',
  'Export my icons': 'ส่งออกไอคอนของฉัน',
  'Screenshots are read by Claude through the Anthropic API using your own key. The key is stored only in this browser (localStorage) and is sent only to api.anthropic.com. It is never included in exported backups.':
    'ภาพหน้าจอจะถูกอ่านโดย Claude ผ่าน Anthropic API ด้วย API key ของคุณเอง คีย์นี้เก็บไว้ในเบราว์เซอร์นี้เท่านั้น (localStorage) และส่งไปที่ api.anthropic.com ที่เดียวเท่านั้น ไม่มีวันถูกใส่ลงในไฟล์สำรองข้อมูลที่ส่งออก',
  'Anthropic API key': 'Anthropic API key',
  'How to get the key?': 'หาคีย์ได้ยังไง?',
  Hide: 'ซ่อน',
  Show: 'แสดง',
  'Remove the API key from this browser?': 'ลบ API key ออกจากเบราว์เซอร์นี้เลยไหม?',
  'Remove key': 'ลบคีย์',
  Model: 'โมเดล',
  '(most accurate)': '(แม่นที่สุด)',
  '(cheaper)': '(ถูกกว่า)',
  '(cheapest)': '(ถูกที่สุด)',
  'How to get an Anthropic API key': 'วิธีหา Anthropic API key',
  Close: 'ปิด',
  'Theme': 'ธีม',
  'Dark': 'มืด',
  'Light': 'สว่าง',
  'Follow system': 'ตามระบบเครื่อง',
}
