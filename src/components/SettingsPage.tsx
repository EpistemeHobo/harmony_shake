import { useEffect, useState } from 'react'
import { clearSamples, updateSettings, useAppState } from '../store'
import { useLang, useT } from '../i18n'

const MODELS = [
  { id: 'claude-opus-5-5', name: 'Claude Opus 5.5', note: '(most accurate)' },
  { id: 'claude-sonnet-5-5', name: 'Claude Sonnet 5.5', note: '(cheaper)' },
  { id: 'claude-haiku-4-5', name: 'Claude Haiku 4.5', note: '(cheapest)' },
]

export default function SettingsPage() {
  const { settings, samples, items } = useAppState()
  const t = useT()
  const captured = items.filter((i) => i.icon?.startsWith('data:image/'))
  const [show, setShow] = useState(false)
  const [guide, setGuide] = useState(false)

  return (
    <section>
      <div className="card form">
        <label>
          {t('Language (interface and item names)')}
          <select value={settings.lang} onChange={(e) => updateSettings({ lang: e.target.value as 'th' | 'en' })}>
            <option value="th">ไทย (Thai)</option>
            <option value="en">English</option>
          </select>
        </label>
              <label>
          {t('Theme')}
          <select value={settings.theme ?? 'dark'} onChange={(e) => updateSettings({ theme: e.target.value as 'dark' | 'light' | 'system' })}>
            <option value="dark">{t('Dark')}</option>
            <option value="light">{t('Light')}</option>
            <option value="system">{t('Follow system')}</option>
          </select>
        </label>
      </div>

      <div className="card">
        <h3>{t('Screenshot reader')}</h3>
        <div className="row-wrap small" style={{ marginBottom: 8 }}>
          <span>
            {t('Learned slot pictures:')} <b>{(samples ?? []).length}</b>{' '}
            {t('(from confirmed scans; used to recognise the same items next time)')}
          </span>
          <button
            disabled={!(samples ?? []).length}
            onClick={() => confirm(t('Forget all learned slot pictures?')) && clearSamples()}
          >
            {t('Forget all')}
          </button>
        </div>
        <div className="row-wrap small" style={{ marginBottom: 8 }}>
          <span>
            {t('Your own item icons (captured from screenshots):')} <b>{captured.length}</b>
          </span>
          <button
            disabled={!captured.length}
            title={t("Download them as one file; run scripts/import_icons.py on it to make them the project's default icons")}
            onClick={() => {
              const data = JSON.stringify({ kind: 'harmony-shake-icons', icons: Object.fromEntries(captured.map((i) => [i.id, i.icon])) })
              const a = document.createElement('a')
              a.href = URL.createObjectURL(new Blob([data], { type: 'application/json' }))
              a.download = `harmony-shake-icons-${new Date().toISOString().slice(0, 10)}.json`
              a.click()
              URL.revokeObjectURL(a.href)
            }}
          >
            {t('Export my icons')}
          </button>
        </div>
        <p className="muted small">
          {t(
            'Screenshots are read by Claude through the Anthropic API using your own key. The key is stored only in this browser (localStorage) and is sent only to api.anthropic.com. It is never included in exported backups.',
          )}
        </p>
        <div className="form">
          <label className="full">
            <span>
              {t('Anthropic API key')}{' '}
              <button
                type="button"
                className="link-btn"
                onClick={(e) => {
                  e.preventDefault()
                  setGuide(true)
                }}
              >
                {t('How to get the key?')}
              </button>
            </span>
            <span className="row-wrap">
              <input
                className="grow"
                type={show ? 'text' : 'password'}
                autoComplete="off"
                placeholder="sk-ant-…"
                value={settings.apiKey}
                onChange={(e) => updateSettings({ apiKey: e.target.value.trim() })}
              />
              <button onClick={() => setShow((s) => !s)}>{show ? t('Hide') : t('Show')}</button>
              <button
                className="danger"
                disabled={!settings.apiKey}
                onClick={() => confirm(t('Remove the API key from this browser?')) && updateSettings({ apiKey: '' })}
              >
                {t('Remove key')}
              </button>
            </span>
          </label>
          <label>
            {t('Model')}
            <select value={settings.model} onChange={(e) => updateSettings({ model: e.target.value })}>
              {MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} {t(m.note)}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <DataPolicy />
      {guide && <KeyGuide onClose={() => setGuide(false)} />}
    </section>
  )
}

const REPO = 'https://github.com/EpistemeHobo/harmony_shake.git'

function Cmd({ children }: { children: string }) {
  return <pre className="cmd">{children}</pre>
}

/** How the app handles the API key and other data, and how to run a private copy from source. */
function DataPolicy() {
  return useLang() === 'th' ? <DataPolicyTh /> : <DataPolicyEn />
}

function DataPolicyEn() {
  return (
    <div className="card policy">
      <h3>User data policy</h3>

      <h4>1. Your Anthropic API key</h4>
      <ul>
        <li>
          <b>How it's read:</b> only from the <i>Anthropic API key</i> box above. The app never asks for it anywhere else and never reads it from files or
          the clipboard.
        </li>
        <li>
          <b>Where it's stored:</b> in this browser's <code>localStorage</code>, for this site address only (e.g. <code>http://localhost:5173</code>). It is{' '}
          <b>not</b> written to any file, not included in <i>Export backup</i>, and not part of the project's source code or git repository.
        </li>
        <li>
          <b>Where it's sent:</b> only to <code>https://api.anthropic.com</code>, directly from your browser, when you click <i>Scan</i>. There is no
          Harmony Shake server in between. The key travels in the request header over HTTPS.
        </li>
        <li>
          <b>How to remove it:</b> click <i>Remove key</i> above, or clear this site's data in your browser. You can also revoke the key at any time at{' '}
          <a className="link" href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer">
            console.anthropic.com
          </a>
          .
        </li>
      </ul>

      <h4>2. What else is sent, and to whom</h4>
      <ul>
        <li>
          <b>To Anthropic, only when you scan:</b> the cut-out pictures of your storage slots, the item list with names, and the icon reference sheet. Nothing
          about your account, PC or other browser data. Anthropic handles it under the data policy of your own API account.
        </li>
        <li>
          <b>Everything else stays in this browser:</b> stock, history, recipe edits, learned slot pictures, icons and the token log live in{' '}
          <code>localStorage</code>. They leave your browser only if you export a backup yourself.
        </li>
        <li>
          <b>No tracking:</b> no analytics, no ads, no cookies. Item icons are bundled with the app, so it doesn't contact bdocodex.com or any other site
          while you use it.
        </li>
      </ul>

      <h4>3. Privacy risks to be aware of</h4>
      <ul>
        <li>
          Anything that can run code on this page can read <code>localStorage</code>, including <b>browser extensions</b> with access to all sites, and
          anyone using this <b>browser profile</b>. Avoid saving your key on a shared or public computer.
        </li>
        <li>
          <b>Only enter your key into a copy you trust.</b> A modified copy hosted by someone else could send your key anywhere. The safest copy is one you
          run yourself from the source code (section 4).
        </li>
        <li>
          Use a key you can afford to lose: set a <b>spend limit</b> for it in the Anthropic console, and revoke it if you think it leaked.
        </li>
      </ul>

      <h4>4. Maximum security: run your own copy from source</h4>
      <p>
        Harmony Shake is open source on GitHub:{' '}
        <a className="link" href="https://github.com/EpistemeHobo/harmony_shake" target="_blank" rel="noreferrer">
          github.com/EpistemeHobo/harmony_shake
        </a>
        . Running it on your own PC means the code that handles your key is code you can read, and nothing runs on anyone else's server. The only network call
        that carries your key is in <code>src/vision.ts</code>.
      </p>
      <p>
        You need{' '}
        <a className="link" href="https://nodejs.org/" target="_blank" rel="noreferrer">
          Node.js
        </a>{' '}
        (20.19+ or 22.12+) and{' '}
        <a className="link" href="https://git-scm.com/downloads" target="_blank" rel="noreferrer">
          Git
        </a>
        . In a terminal, either clone it in one step:
      </p>
      <Cmd>{`git clone ${REPO}\ncd harmony_shake`}</Cmd>
      <p>or set up an empty folder with git and pull the code into it:</p>
      <Cmd>{`mkdir harmony_shake\ncd harmony_shake\ngit init\ngit remote add origin ${REPO}\ngit pull origin main`}</Cmd>
      <p>Then install and start it, and open http://localhost:5173:</p>
      <Cmd>{`npm install\nnpm run dev`}</Cmd>
      <p>To get updates later, run this in the same folder (review the changes first if you like):</p>
      <Cmd>{`git pull origin main\nnpm install`}</Cmd>
      <p className="muted small">
        Your data is tied to the address you open. Moving to a self-run copy starts empty: use <i>Stock → Export backup</i> on the old copy and{' '}
        <i>Import backup</i> on the new one, then enter your API key again.
      </p>
    </div>
  )
}

function DataPolicyTh() {
  return (
    <div className="card policy">
      <h3>นโยบายข้อมูลผู้ใช้</h3>

      <h4>1. Anthropic API key ของคุณ</h4>
      <ul>
        <li>
          <b>แอปรับคีย์มาจากไหน:</b> จากช่อง <i>Anthropic API key</i> ด้านบนเท่านั้น แอปจะไม่ขอคีย์จากที่อื่นเลย และไม่เคยไปอ่านคีย์จากไฟล์หรือจากคลิปบอร์ด
          (ข้อความที่คุณก๊อปไว้)
        </li>
        <li>
          <b>คีย์ถูกเก็บไว้ที่ไหน:</b> เก็บใน <code>localStorage</code> ของเบราว์เซอร์นี้ (พื้นที่เก็บข้อมูลเล็ก ๆ ในเบราว์เซอร์) และใช้ได้เฉพาะกับที่อยู่เว็บนี้เท่านั้น
          (เช่น <code>http://localhost:5173</code>) คีย์<b>ไม่</b>ถูกเขียนลงไฟล์ไหนเลย ไม่ถูกใส่ลงใน <i>ส่งออกไฟล์สำรอง</i> และไม่ได้อยู่ในซอร์สโค้ดหรือใน
          git repository ของโปรเจกต์
        </li>
        <li>
          <b>คีย์ถูกส่งไปที่ไหน:</b> ส่งไปที่ <code>https://api.anthropic.com</code> ที่เดียวเท่านั้น ส่งตรงจากเบราว์เซอร์ของคุณตอนที่คุณกด <i>สแกน</i>{' '}
          ไม่มีเซิร์ฟเวอร์ของ Harmony Shake มาคั่นกลาง คีย์จะเดินทางไปในส่วนหัวของคำขอ (request header) ผ่าน HTTPS ซึ่งเป็นการเชื่อมต่อแบบเข้ารหัส
          คนอื่นแอบดูระหว่างทางไม่ได้
        </li>
        <li>
          <b>ลบคีย์ยังไง:</b> กด <i>ลบคีย์</i> ด้านบน หรือล้างข้อมูลของเว็บนี้ในเบราว์เซอร์ก็ได้ และคุณยังยกเลิกคีย์ (ทำให้คีย์ใช้ไม่ได้อีก) ได้ทุกเมื่อที่{' '}
          <a className="link" href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer">
            console.anthropic.com
          </a>
        </li>
      </ul>

      <h4>2. มีอะไรถูกส่งออกไปอีกบ้าง และส่งให้ใคร</h4>
      <ul>
        <li>
          <b>ส่งให้ Anthropic เฉพาะตอนที่คุณสแกน:</b> รูปช่องเก็บของที่ตัดมาจากภาพหน้าจอ รายชื่อไอเทม และแผ่นรูปไอคอนไว้เทียบ แค่นั้นเอง ไม่มีข้อมูลเกี่ยวกับไอดีเกม
          คอมพิวเตอร์ หรือข้อมูลอื่นในเบราว์เซอร์ของคุณ Anthropic จะดูแลข้อมูลนี้ตามนโยบายข้อมูลของบัญชี API ของคุณเอง
        </li>
        <li>
          <b>อย่างอื่นทั้งหมดอยู่ในเบราว์เซอร์นี้:</b> ของในคลัง ประวัติ สูตรที่แก้ไข รูปช่องเก็บของที่จำไว้ ไอคอน และบันทึกการใช้โทเคน เก็บอยู่ใน{' '}
          <code>localStorage</code> ทั้งหมด จะออกจากเบราว์เซอร์ก็ต่อเมื่อคุณกดส่งออกไฟล์สำรองเองเท่านั้น
        </li>
        <li>
          <b>ไม่มีการติดตาม:</b> ไม่มีเก็บสถิติ ไม่มีโฆษณา ไม่มีคุกกี้ ไอคอนไอเทมรวมมากับแอปอยู่แล้ว เลยไม่ต้องติดต่อ bdocodex.com หรือเว็บอื่นใดระหว่างที่คุณใช้งาน
        </li>
      </ul>

      <h4>3. ความเสี่ยงด้านความเป็นส่วนตัวที่ควรรู้</h4>
      <ul>
        <li>
          อะไรก็ตามที่รันโค้ดบนหน้านี้ได้ จะอ่าน <code>localStorage</code> ได้ด้วย เช่น <b>ส่วนขยายของเบราว์เซอร์ (extension)</b> ที่ได้สิทธิ์เข้าทุกเว็บ
          และทุกคนที่ใช้ <b>โปรไฟล์เบราว์เซอร์</b> เดียวกับคุณ เพราะฉะนั้นอย่าบันทึกคีย์ไว้ในคอมที่ใช้ร่วมกับคนอื่น หรือคอมสาธารณะอย่างร้านเน็ต
        </li>
        <li>
          <b>ใส่คีย์เฉพาะในเว็บที่คุณไว้ใจเท่านั้น</b> ถ้ามีคนเอาแอปนี้ไปแก้แล้วเปิดเป็นเว็บของเขาเอง เขาอาจแอบส่งคีย์ของคุณไปที่ไหนก็ได้
          เวอร์ชันที่ปลอดภัยที่สุดคือเวอร์ชันที่คุณรันเองจากซอร์สโค้ด (ดูข้อ 4)
        </li>
        <li>
          ใช้คีย์ที่ถึงหลุดไปก็ไม่เสียหายมาก: ตั้ง <b>วงเงินใช้จ่าย (spend limit)</b> ให้คีย์ใน Anthropic console และถ้าสงสัยว่าคีย์หลุด ให้ยกเลิกคีย์นั้นทันที
        </li>
      </ul>

      <h4>4. ปลอดภัยที่สุด: รันแอปเองจากซอร์สโค้ด</h4>
      <p>
        Harmony Shake เป็นโอเพนซอร์ส (เปิดให้ทุกคนดูโค้ดได้) อยู่บน GitHub:{' '}
        <a className="link" href="https://github.com/EpistemeHobo/harmony_shake" target="_blank" rel="noreferrer">
          github.com/EpistemeHobo/harmony_shake
        </a>{' '}
        การรันบนคอมของคุณเองหมายความว่า โค้ดที่จัดการคีย์ของคุณเป็นโค้ดที่คุณเปิดอ่านเองได้ และไม่มีอะไรรันอยู่บนเซิร์ฟเวอร์ของคนอื่นเลย
        จุดเดียวที่ส่งคีย์ของคุณออกไปทางเน็ตอยู่ในไฟล์ <code>src/vision.ts</code>
      </p>
      <p>
        คุณต้องมี{' '}
        <a className="link" href="https://nodejs.org/" target="_blank" rel="noreferrer">
          Node.js
        </a>{' '}
        (เวอร์ชัน 20.19 ขึ้นไป หรือ 22.12 ขึ้นไป) และ{' '}
        <a className="link" href="https://git-scm.com/downloads" target="_blank" rel="noreferrer">
          Git
        </a>{' '}
        จากนั้นเปิดหน้าต่างเทอร์มินัล (หน้าจอพิมพ์คำสั่ง) แล้วเลือกวิธีใดวิธีหนึ่ง วิธีแรกคือ clone ทีเดียวจบ:
      </p>
      <Cmd>{`git clone ${REPO}\ncd harmony_shake`}</Cmd>
      <p>หรือสร้างโฟลเดอร์เปล่าแล้วใช้ git ดึงโค้ดลงมา:</p>
      <Cmd>{`mkdir harmony_shake\ncd harmony_shake\ngit init\ngit remote add origin ${REPO}\ngit pull origin main`}</Cmd>
      <p>จากนั้นติดตั้งและเปิดแอป แล้วเข้าไปที่ http://localhost:5173 ในเบราว์เซอร์:</p>
      <Cmd>{`npm install\nnpm run dev`}</Cmd>
      <p>ถ้าอยากอัปเดตเป็นเวอร์ชันใหม่ในภายหลัง ให้รันคำสั่งนี้ในโฟลเดอร์เดิม (จะเช็กดูว่ามีอะไรเปลี่ยนก่อนก็ได้):</p>
      <Cmd>{`git pull origin main\nnpm install`}</Cmd>
      <p className="muted small">
        ข้อมูลของคุณผูกอยู่กับที่อยู่เว็บที่คุณเปิด ถ้าย้ายมาใช้เวอร์ชันที่รันเอง ข้อมูลจะเริ่มจากว่างเปล่า: ให้ใช้ <i>ของในคลัง → ส่งออกไฟล์สำรอง</i> ในเวอร์ชันเก่า
        แล้วใช้ <i>นำเข้าไฟล์สำรอง</i> ในเวอร์ชันใหม่ จากนั้นใส่ API key ใหม่อีกครั้ง
      </p>
    </div>
  )
}

/** Step-by-step guide for creating an Anthropic API key. */
function KeyGuide({ onClose }: { onClose: () => void }) {
  const t = useT()
  const lang = useLang()
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal key-guide" role="dialog" aria-label={t('How to get an Anthropic API key')}>
        <div className="card-head">
          <h3>{t('How to get an Anthropic API key')}</h3>
          <button onClick={onClose}>{t('Close')}</button>
        </div>
        {lang === 'th' ? <KeyGuideTh /> : <KeyGuideEn />}
      </div>
    </div>
  )
}

function KeyGuideEn() {
  return (
    <>
      <ol>
        <li>
          Go to{' '}
          <a className="link" href="https://console.anthropic.com/" target="_blank" rel="noreferrer">
            console.anthropic.com
          </a>{' '}
          and <b>sign up</b> or <b>log in</b>. This is the developer console, separate from a Claude.ai chat subscription.
        </li>
        <li>
          <b>Add credits:</b> open <i>Settings → Billing</i> and buy prepaid credits (a few dollars is plenty to start). API usage is billed from these
          credits; a Claude.ai Pro/Max plan does not cover it.
        </li>
        <li>
          <b>Set a spend limit (recommended):</b> in <i>Settings → Limits</i>, cap the monthly spend so a leaked key can't cost you much.
        </li>
        <li>
          <b>Strict spend limit: turn off auto-reload.</b> In <i>Settings → Billing</i>, switch off the option that automatically buys more credits when
          your balance runs low. Then you can never spend more than the credits you bought: when they run out, requests simply stop until you top up
          yourself.
        </li>
        <li>
          <b>Create the key:</b> open{' '}
          <a className="link" href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer">
            API Keys
          </a>
          , click <i>Create Key</i>, and give it a name such as <code>harmony-shake</code>.
        </li>
        <li>
          <b>Copy it immediately.</b> The key starts with <code>sk-ant-</code> and is shown only once. If you lose it, delete it and create a new one.
        </li>
        <li>
          <b>Paste it</b> into the <i>Anthropic API key</i> box on this Settings page. It's saved in this browser only.
        </li>
      </ol>
      <p className="muted small">
        Cost: one storage page is roughly $0.10–0.40 with Opus 5.5 (cheaper with Sonnet 5.5 or Haiku 4.5). The <i>Token log</i> tab shows the real cost of
        every scan. Keep the key private: anyone who has it can spend your credits. You can revoke it in the console at any time.
      </p>
    </>
  )
}

function KeyGuideTh() {
  return (
    <>
      <ol>
        <li>
          เข้าไปที่{' '}
          <a className="link" href="https://console.anthropic.com/" target="_blank" rel="noreferrer">
            console.anthropic.com
          </a>{' '}
          แล้ว <b>สมัครสมาชิก (Sign up)</b> หรือ <b>เข้าสู่ระบบ (Log in)</b> เว็บนี้คือ console สำหรับนักพัฒนา ซึ่งแยกจากการสมัครแชตกับ Claude.ai
          นะ (คนละบัญชีคนละการจ่ายเงินกัน)
        </li>
        <li>
          <b>เติมเครดิต:</b> ไปที่เมนู <i>Settings → Billing</i> (การตั้งค่า → การชำระเงิน) แล้วซื้อเครดิตแบบเติมเงินล่วงหน้า (เริ่มแค่ไม่กี่ดอลลาร์ก็พอแล้ว)
          ค่าใช้ API จะหักจากเครดิตนี้ ส่วนแพ็กเกจ Claude.ai Pro/Max ใช้จ่ายค่า API ไม่ได้
        </li>
        <li>
          <b>ตั้งวงเงินใช้จ่าย (แนะนำ):</b> ในเมนู <i>Settings → Limits</i> (การตั้งค่า → วงเงิน) ตั้งยอดใช้จ่ายสูงสุดต่อเดือนไว้ ถ้าคีย์หลุดไป
          จะได้ไม่เสียเงินเยอะ
        </li>
        <li>
          <b>คุมเงินแบบเข้มสุด: ปิดการเติมเงินอัตโนมัติ (auto-reload)</b> ในเมนู <i>Settings → Billing</i> ให้ปิดตัวเลือกที่จะซื้อเครดิตเพิ่มเองอัตโนมัติตอนเงินใกล้หมด
          แบบนี้คุณจะไม่มีทางจ่ายเกินเครดิตที่ซื้อไว้: พอเครดิตหมด แอปก็แค่ใช้งาน API ไม่ได้ จนกว่าคุณจะเติมเงินเอง
        </li>
        <li>
          <b>สร้างคีย์:</b> เปิดหน้า{' '}
          <a className="link" href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer">
            API Keys
          </a>{' '}
          กดปุ่ม <i>Create Key</i> (สร้างคีย์) แล้วตั้งชื่อ เช่น <code>harmony-shake</code>
        </li>
        <li>
          <b>ก๊อปคีย์ทันที!</b> คีย์จะขึ้นต้นด้วย <code>sk-ant-</code> และจะโชว์ให้เห็นแค่ครั้งเดียว ถ้าทำหาย ให้ลบคีย์นั้นทิ้งแล้วสร้างใหม่
        </li>
        <li>
          <b>วางคีย์</b> ลงในช่อง <i>Anthropic API key</i> ในหน้าตั้งค่านี้ คีย์จะถูกบันทึกไว้ในเบราว์เซอร์นี้เท่านั้น
        </li>
      </ol>
      <p className="muted small">
        ค่าใช้จ่าย: สแกนหน้าคลังเก็บของ 1 หน้า ประมาณ $0.10–0.40 ถ้าใช้ Opus 5.5 (ถูกกว่านี้ถ้าใช้ Sonnet 5.5 หรือ Haiku 4.5) แท็บ <i>บันทึกการใช้โทเคน</i>{' '}
        จะแสดงค่าใช้จ่ายจริงของการสแกนแต่ละครั้ง เก็บคีย์เป็นความลับนะ ใครได้คีย์ไปก็ใช้เครดิตของคุณได้ และคุณยกเลิกคีย์ได้ใน console ทุกเมื่อ
      </p>
    </>
  )
}
