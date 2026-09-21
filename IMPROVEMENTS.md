# สรุปการปรับปรุง Browser Nova

เอกสารนี้สรุปการแก้ไขและปรับปรุงที่ทำกับโปรเจกต์ Browser Nova จากการรีวิวโค้ดด้านความปลอดภัยและความถูกต้อง

---

## รอบที่ 1 — แก้ไขจากการรีวิว (5 รายการ)

### 1. เดินสาย AI Safety Settings เข้า Orchestrator
**ปัญหา:** ค่า `maxActionsPerRun`, `maxRunDurationSec`, `requireConfirmForSensitive` ใน settings เป็น dead code — ตั้งค่าได้แต่ไม่ถูกนำไปใช้จริง

**แก้ไข:**
- `src/ai/orchestrator.ts` — constructor รับ `BudgetConfig` และเพิ่มเมธอด `setBudgetConfig()`
- `src/main/tab-manager.ts` — เพิ่ม `buildBudgetConfig()` สร้าง config จาก `AppSettings` แล้วส่งให้ทุก tab ทั้งตอนสร้าง (`createTab`) และตอนอัปเดต (`updateSettings`) พร้อม fallback กันค่า 0/NaN

### 2. กัน Path Traversal ที่ชื่อ Artifact
**ปัญหา:** ชื่อไฟล์ screenshot จาก AI/ผู้ใช้ อาจมี `../` หลุดออกนอกโฟลเดอร์ artifacts

**แก้ไข:** `src/automation/actions.ts`
- เพิ่ม `sanitizeArtifactName()` — ตัด `../`, absolute path, control chars, รองรับทั้ง `/` และ `\` โดยยังคงชื่อภาษาไทยไว้ได้
- ตรวจซ้ำว่า resolved path ยังอยู่ในโฟลเดอร์ artifacts ก่อนเขียนไฟล์ (containment check)

### 3. แก้ `afterUrl` ในรายงาน
**ปัญหา:** `afterUrl` รายงานค่าเท่ากับ `beforeUrl` เสมอ

**แก้ไข:** `src/automation/runner.ts` — เพิ่ม `getCurrentUrl()` อ่าน URL จริงตอนจบ run ผ่าน CDP `Runtime.evaluate`

### 4. แก้ TypeScript error (TS2367)
**ปัญหา:** `runner.ts:177` เทียบ `this.status !== 'stopped'` แล้ว TS มองว่าเป็น unintentional comparison

**แก้ไข:** เปลี่ยนไปเช็ก boolean flag `this.isStopped` แทน — ถูกต้องเชิงความหมายและ typecheck ผ่าน

### 5. กัน Memory Leak ใน CDP Broker
**ปัญหา:** `networkRequestsMap` โตไม่จำกัดใน tab ที่เปิดนาน

**แก้ไข:** `src/automation/cdp-broker.ts`
- ลบ entry เมื่อ request จบ (`responseReceived` / `loadingFailed`)
- cap ที่ 1000 entry (evict ตัวเก่าสุดเมื่อเต็ม)

### + เพิ่ม Typecheck เข้า Pipeline
`package.json` — เพิ่ม script `typecheck` และให้ `test` รัน `tsc --noEmit` ก่อน build (esbuild ไม่ typecheck ให้)

---

## รอบที่ 2 — Security Hardening + Tests (4 รายการ)

### 1. ย้าย Gemini API Key ออกจาก URL
**ปัญหา:** key อยู่ใน query string (`?key=...`) เสี่ยงหลุดเข้า log / error message / proxy log

**แก้ไข:** `src/ai/adapters/gemini-adapter.ts` — ส่ง key ผ่าน header `x-goog-api-key` แทน
(OpenAI adapter ใช้ `Authorization: Bearer` header อยู่แล้ว ไม่ต้องแก้)

### 2. Hardening หน้าต่างแอป (App Shell)
**แก้ไข:** `src/main/index.ts`
- `setWindowOpenHandler` — ปฏิเสธการเปิดหน้าต่าง OS, ลิงก์ http(s) ภายนอกส่งไปเปิดที่ default browser ผ่าน `shell.openExternal`
- `will-navigate` guard — กันไม่ให้ UI แอปถูกพา navigate ออกจากหน้า (ยกเว้น dev server / ไฟล์ที่โหลด)

### 3. จัดการ `window.open()` ในแท็บเว็บ
**แก้ไข:** `src/main/tab-manager.ts` — เพิ่ม `setWindowOpenHandler` ที่ WebContentsView
- popup / `target=_blank` เปิดเป็นแท็บใหม่ในแอป (profile เดียวกัน) แทน BrowserWindow แบบ default ที่ไม่ผ่าน hardening
- รับเฉพาะ scheme http(s) — ปฏิเสธ `file://`, `javascript:` ฯลฯ

### 4. เพิ่ม Unit Test (ไม่พึ่ง Network)
**เพิ่ม:** `tests/unit/unit-test.ts` — 20 เคส ครอบคลุม
- `normalizeUrl` — http/https/localhost/private IP/bare domain/preferHttp
- `evaluateSecurityStatus` — https/loopback/public http/internal/error
- `BudgetTracker` — action limit, loop detection, sensitive detection (ไทย+อังกฤษ), toggle ปิด

**รองรับ:** เพิ่ม build step ใน `scripts/build.mjs` และเสียบเข้า `test` ใน `package.json` (รันก่อน smoke test) — ทำให้มี coverage จริงแม้ในสภาพแวดล้อมที่ bind พอร์ตไม่ได้

---

## ผลการตรวจสอบ

| การตรวจสอบ | ผล |
|---|---|
| `tsc --noEmit` | ✅ ผ่าน (exit 0) |
| `node scripts/build.mjs` | ✅ สำเร็จ |
| Unit tests | ✅ 20/20 ผ่าน |
| Navigation/security smoke tests | ✅ ผ่าน |
| e2e smoke test (fixture server) | ⚠️ รันในสภาพแวดล้อม sandbox ไม่ได้ (bind พอร์ต 127.0.0.1:8080 ถูกบล็อก — ข้อจำกัด environment ไม่เกี่ยวกับโค้ด) |

> แนะนำให้รัน `npm test` บนเครื่องจริงเพื่อทดสอบ AI loop (MockAdapter) ครบวงจรกับ fixture server

---

## รอบที่ 3 — UX/UI พื้นฐานแบบ Google Chrome (5 รายการ)

### 1. คีย์ลัดแบบ Chrome (ใช้งานได้จริง)
**ปัญหา:** tooltip โฆษณาคีย์ลัด (Cmd+T, Cmd+W, Cmd+R, Cmd+L, Cmd+[ / Cmd+]) แต่ไม่มีโค้ดรองรับ และ keydown ฝั่ง renderer จะไม่ทำงานตอนหน้าเว็บใน WebContentsView โฟกัสอยู่

**แก้ไข:** สร้าง Application Menu ที่ฝั่ง main (`buildAppMenu`) พร้อม accelerator — New Tab / Close Tab / Reload / Focus Address Bar / Back / Forward / DevTools — accelerator ของเมนูทำงานได้แม้หน้าเว็บกำลังโฟกัส และเมนู Edit มาตรฐานทำให้ Copy/Paste/Select-All ใช้งานได้

### 2. Omnibox ค้นหาได้ (พิมพ์คำ = ค้นหา Google)
**ปัญหา:** พิมพ์ข้อความที่ไม่ใช่ URL เช่น "แมว" หรือ "weather today" กลายเป็น `https://weather today` (พัง)

**แก้ไข:** เพิ่ม `isProbablySearchQuery()` ใน `navigation.ts` — ถ้ามีช่องว่างหรือเป็นคำเดี่ยวที่ไม่มีจุด จะส่งไปค้นหาที่ Google (`https://www.google.com/search?q=...`) เหมือน Chrome ส่วนโดเมน/IP/localhost ยังเปิดเป็น URL ตามเดิม

### 3. แท็บใหม่เป็นหน้าว่าง (New Tab Page)
**ปัญหา:** ปุ่มแท็บใหม่บังคับเปิด `http://127.0.0.1:8080`

**แก้ไข:** แท็บใหม่เปิด `about:blank` แสดงหน้า New Tab เหมือน Chrome

### 4. เลือกข้อความทั้งหมดเมื่อโฟกัส Address Bar
**แก้ไข:** `onFocus` ของช่อง URL เลือกข้อความทั้งหมด (Chrome behavior) พิมพ์ทับได้ทันที + เปลี่ยน placeholder เป็น "ค้นหา Google หรือพิมพ์ URL" + ใส่ `id="nova-omnibox"` ให้คีย์ลัด Cmd+L โฟกัสได้

### 5. แสดง Favicon บนแท็บ
**แก้ไข:** `TabBar` แสดง favicon จริงของเว็บ (ข้อมูลมีอยู่แล้วใน `Tab.favicon`) พร้อม fallback เป็นไอคอนเดิมเมื่อโหลดไม่ได้

---

## รายการที่ยังไม่ได้ทำ (ข้อเสนอแนะเพิ่มเติม)

- Renderer CSP (Content-Security-Policy)
- `will-download` handling
- เก็บ API key ด้วย `safeStorage.encryptString`
- Structured logging
- GitHub Actions CI pipeline
- Packaging / auto-update

---

## ไฟล์ที่แก้ไข/เพิ่ม

**แก้ไข:**
- `src/ai/orchestrator.ts`
- `src/ai/adapters/gemini-adapter.ts`
- `src/main/tab-manager.ts`
- `src/main/index.ts`
- `src/main/navigation.ts`
- `src/shared/ipc-channels.ts`
- `src/preload/index.ts`
- `src/renderer/App.tsx`
- `src/renderer/components/AddressBar.tsx`
- `src/renderer/components/TabBar.tsx`
- `src/automation/actions.ts`
- `src/automation/runner.ts`
- `src/automation/cdp-broker.ts`
- `scripts/build.mjs`
- `package.json`

**เพิ่ม:**
- `tests/unit/unit-test.ts`

---

🤖 Generated with [Claude Code](https://claude.com/claude-code)
