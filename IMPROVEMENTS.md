# สรุปการปรับปรุง Browser Nova


## Network API Inspector — 22 กันยายน 2026

**ติดตั้งในเครื่องแล้ว:** แทนที่ `/Applications/Browser Nova.app` ด้วย arm64 Network Inspector build จาก commit `666f44d`; สำรองแอปเดิมไว้ใน `release/backups/Browser Nova-before-network-20260922.app`. ตรวจ ad-hoc signature และ SHA-256 ของ app.asar/executable ตรงกับ build; เปิดแอปและตรวจ UI ว่า Inspect แสดง Fetch/XHR, search และ Headers/Payload/Response แล้ว การติดตั้งครั้งนี้ไม่ได้รัน unit/integration tests ซ้ำ และไม่ใช่ signed auto-update.

- Inspect เปิด Network เป็นค่าเริ่มต้นและกรอง Fetch/XHR; ค้นหา URL/method/status, กรอง error และล้างรายการได้
- เลือก request เพื่ออ่าน request/response headers, query parameters, payload และ response แบบ formatted JSON พร้อม Copy
- CDP เก็บ response หลัง loadingFinished แสดง pending/error/duration/ขนาด; สลับแท็บล้างรายการป้องกันข้อมูลปนกัน
- เก็บในหน่วยความจำ 200 รายการขณะเปิด Inspect, request/response body สูงสุด 65,536 ตัวอักษร; body ที่อ่านไม่ได้แสดงเหตุผล ไม่มีการ replay หรือเรียก API ภายในจริง
- ข้อจำกัด: ไม่ใช่ HAR/packet capture; ไม่มีประวัติก่อนเปิด Inspect, redirect hops และ extra-info headers (เช่น cookies บางส่วน) ไม่ครบ; streaming ต้องรอจบ, binary แสดงเป็นข้อความ และ multipart upload อาจไม่มี payload ครบ ใช้ DevTools เต็มสำหรับกรณีเหล่านี้
- Build: macOS arm64 local build และ ad-hoc signature verification ผ่าน; ติดตั้งใน Applications แล้วตามบันทึกด้านบน แต่ไม่ได้เผยแพร่ release ใหม่ ใช้ไฟล์ใน release/local หรือ CI artifact
- Validation: npm test ผ่าน 67 รายการและ renderer build; เพิ่ม real Electron loopback integration สำหรับ Fetch/XHR, POST payload, headers/body, HTTP 422 และ truncation (12 assertions). ไม่ใช่ signed-update test


เอกสารนี้สรุปการแก้ไขและปรับปรุงที่ทำกับโปรเจกต์ Browser Nova จากการรีวิวโค้ดด้านความปลอดภัยและความถูกต้อง

**อัปเดตล่าสุด: 22 กันยายน 2026** — เพิ่ม Side Panel Extensions ใน macOS Preview 0.2.0 ดู [EXTENSIONS.md](EXTENSIONS.md) ส่วน auto-update installation ยังปิดใน preview และต้องผ่านเงื่อนไข [RELEASE.md](RELEASE.md) ก่อนใช้งานจริง

ผลทดสอบรอบ 0.1.1: `npm test` ผ่าน unit 35 รายการ + smoke 19 รายการ + updater/config 10 รายการ = **64 ผ่าน** พร้อม typecheck/build ดู CI ของแต่ละ commit ที่ [GitHub Actions](https://github.com/novaosai-lab/browser-nova/actions/workflows/ci.yml) รายละเอียดรอบเก่าด้านล่างเป็นประวัติ ณ เวลานั้น ไม่ใช่สถานะล่าสุดทั้งหมด


**อัปเดตเอกสาร 22 กันยายน 2026:** ปรับ [Super Agent Roadmap](SUPER_AGENT_ROADMAP.md) หลังตรวจโค้ดและได้รับอนุมัติ โดยเติม Phase 1 runtime/policy/secret boundaries, เกณฑ์ P1-A ถึง P1-H, สถาปัตยกรรมครบ 6 เสาหลัก, ขอบเขต Clone และ Phase Multi-model ตัดคำรับประกันและกรอบเวลาที่ไม่มีหลักฐาน งานนี้แก้เฉพาะเอกสาร ไม่ได้ implement ฟีเจอร์ใหม่หรือรัน tests แอปซ้ำในเครื่อง ตรวจ diff/ลิงก์/โครงสร้าง Markdown แล้ว; CI ตรวจตาม workflow เมื่อ push ข้อบกพร่อง runtime และ signed-update limitations ยังเหลือตาม roadmap และ RELEASE.md


## รอบที่ 7 — Side Panel Extensions (22 กันยายน 2026, 0.2.0)

- เพิ่ม Extension Manager: เลือกโฟลเดอร์ ตรวจ manifest/สิทธิ์ ติดตั้งเป็น snapshot เปิดจาก toolbar เปิด/ปิดใช้งาน ถอนติดตั้ง และ restore รายการหลังเปิดแอป
- รองรับ MV3 Side Panel subset โดย Nova เปิดแผงแทน bootstrap `setPanelBehavior`; worker ทั่วไปและ Chrome APIs อื่นนอกขอบเขตไม่ถือว่ารองรับ
- แยก persistent session ต่อ extension ใช้ native host permissions พร้อม network allowlist รวม redirect, ไม่มี Nova bridge/Node integration, คง web security และตรวจ management IPC
- เพิ่ม fixture สาธารณะและ CI สำหรับ native Electron integration โดยไม่ใช้ OMS source หรือ endpoint ภายใน
- ตรวจ: `npm test` ผ่าน 67 รายการ (เดิม 64 + extension unit 3), Electron loopback integration ผ่าน 18 checks; UI fixture โหลด/เปิด/กรอก/กดปุ่ม/Settings ผ่าน ตัวตรวจ OMS manifest/bootstrap ผ่าน แต่ยังไม่เรียก API จริง
- Build arm64/Universal ผ่าน ตรวจ signature/DMG ทั้งสองแบบ และติดตั้ง/เปิด Universal 0.2.0 จาก Applications บน Apple Silicon แล้ว; ไม่รวม test harness หรือส่วนขยายภายในใน app bundle
- Registry เสียจะแสดงข้อผิดพลาดและไม่ทับข้อมูลเดิม; ทดสอบกรณีนี้เพิ่มเติมแล้ว
- ข้อจำกัด: ไม่มี store/CRX install, arbitrary workers/content scripts, shared login กับแท็บหลัก, custom toolbar icons หรือ extension auto-update; แอป preview ยังไม่ notarize/เปิด auto-update installation
- คู่มือและขอบเขตทั้งหมดอยู่ใน [EXTENSIONS.md](EXTENSIONS.md) งานนี้ไม่ได้ปิด Phase 1 ของ Super Agent Roadmap

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

## ผลการตรวจสอบเดิมหลังรอบที่ 2

| การตรวจสอบ | ผล |
|---|---|
| `tsc --noEmit` | ✅ ผ่าน (exit 0) |
| `node scripts/build.mjs` | ✅ สำเร็จ |
| Unit tests | ✅ 20/20 ผ่าน |
| Navigation/security smoke tests | ✅ ผ่าน |
| e2e smoke test (fixture server) | ⚠️ รันในสภาพแวดล้อม sandbox ไม่ได้ (bind พอร์ต 127.0.0.1:8080 ถูกบล็อก — ข้อจำกัด environment ไม่เกี่ยวกับโค้ด) |

> Smoke tests ชุดนี้ใช้ MockAdapter และข้อมูล observation จำลอง ไม่ใช่การทดสอบ AI ควบคุม Electron ครบวงจร ต่อมารันบนเครื่องจริงแล้วผ่าน 19 รายการโดยไม่มีข้อจำกัด bind พอร์ต

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

## รอบที่ 4 — แก้การเปิดแอป/Enter และส่งมอบ macOS Preview

### การเปิดแอปและ navigation

- แก้ main process แบบ ESM ให้คำนวณ directory จาก `import.meta.url` ทำให้เปิดแอปจริงได้
- ให้ main process เป็นเจ้าของ `TabState` ทั้งรายการแท็บและ `activeTabId`; renderer รับ state snapshot/event ร่วมกัน แก้กด Enter แล้วไม่ไปเว็บเมื่อแท็บแรกถูกสร้างหลัง renderer mount
- ป้องกัน snapshot เก่าทับ state ใหม่ และเพิ่ม regression checks สำหรับการสร้าง/สลับ/ปิดแท็บและ renderer reload
- ตรวจใน packaged app แล้วว่าเปิด Google และ HTTP fixture ผ่านแถบ URL ได้

### macOS packaging และ lifecycle

- เพิ่ม `electron-builder`, ไอคอนแอป, DMG/ZIP/blockmap และ `SHA256SUMS` พร้อมคำสั่ง `dist:mac`, `dist:mac:universal`, `release:mac`
- สร้างทั้ง arm64 และ Universal; ตรวจว่า Universal มี `arm64` และ `x86_64`, ตรวจ ad-hoc signature และความสมบูรณ์ของ DMG
- ติดตั้งและเปิด Universal ที่ `/Applications/Browser Nova.app` บน Apple Silicon แล้ว ยังไม่ได้รันบนเครื่อง Intel
- Packaged app เริ่มจาก `about:blank` ไม่ต้องใช้ fixture/Vite; ใช้ profile คงที่ใน `~/Library/Application Support/browser-nova`
- เพิ่ม single-instance lock; macOS ปิดหน้าต่างแล้วซ่อนไว้เพื่อเปิดกลับโดยใช้ IPC เดิม; Local API เลือกพอร์ตว่างบน loopback และให้ CLI อ่านจาก `local-server.json`

### Updater และ GitHub

- เพิ่ม `electron-updater`, state machine, เมนู **Check for Updates…** และสถานะ/ความคืบหน้าใน Settings
- เตรียมตรวจเวอร์ชันเมื่อเปิดแอปและทุก 6 ชั่วโมงใน signed release, ให้เลือกดาวน์โหลด และยืนยันก่อนรีสตาร์ตติดตั้ง
- ปิด downgrade/prerelease/การติดตั้งเองตอน quit; รองรับ error/retry และป้องกันคำขอซ้ำ; จำกัด update IPC ให้ shell main frame
- เตรียม production build ที่ตรวจ signing/notarization credentials ก่อน build และใช้ GitHub HTTPS feed โดยไม่ฝัง token ในแอป
- สร้าง [repository public](https://github.com/novaosai-lab/browser-nova), workflow CI และ workflow signed release ที่สร้าง draft release
- เผยแพร่ tag `v0.1.0-preview.1` พร้อมไฟล์ 8 รายการและ `SHA256SUMS`; ตรวจ digest ของไฟล์ทั้ง 8 บน GitHub ตรงกับเครื่องแล้ว
- **Preview ยังไม่เปิด auto-update installation และยังไม่ notarize กับ Apple** ต้องติดตั้ง signed release แรกด้วยตนเอง และทดสอบ update ระหว่าง signed releases ก่อนยืนยันว่าใช้งานจริงครบวงจร

## รอบที่ 5 — อัปเดตเอกสารและกติกา GitHub

- ปรับ `SUMMARY_ANTIGRAVITY.md` ให้สะท้อน Preview และขอบเขตการทดสอบจริง แทนการอ้างว่าครบตามแผน 100%
- ปรับรายการ backlog และสถานะหลังรีวิวให้แยกงานที่แก้แล้วกับข้อจำกัดที่ยังเหลือ
- เพิ่ม [AGENTS.md](AGENTS.md): หลังเปลี่ยนงานต้องอัปเดต Markdown ที่เกี่ยวข้อง ตรวจตามความเหมาะสม commit และ push GitHub พร้อมยืนยันผล ไม่ต้องถามซ้ำสำหรับการ push งานปกติ
- รอบนี้แก้เฉพาะเอกสาร ตรวจ diff และลิงก์ภายใน; จำนวน 64 tests ด้านบนอ้างอิงผลการทดสอบโค้ดรอบก่อน

## รอบที่ 6 — แก้พื้นที่ลากหน้าต่าง macOS (0.1.1)

**อาการ:** ผู้ใช้ลากตัวหน้าต่างแอปเพื่อย้ายตำแหน่งไม่ได้

**สาเหตุในโค้ด:** `.tabs-list` ใช้ `flex: 1` แต่กำหนด `-webkit-app-region: no-drag` ทำให้พื้นที่ว่างเกือบทั้งแถบหัวหน้าต่างไม่รับการลาก

**การแก้ไข:**

- ให้พื้นที่ว่างใน `.tabs-list` เป็น native drag region และกำหนด `no-drag` เฉพาะแท็บ/ปุ่มที่ต้องคลิก
- เพิ่มพื้นที่จับลากด้านขวา 72 px ที่ไม่หดตามจำนวนแท็บ พร้อม `min-width: 0` ให้รายการแท็บเลื่อนภายในได้เมื่อเต็ม
- เพิ่มเวอร์ชันเป็น 0.1.1 และสร้าง macOS arm64/Universal preview ใหม่
- วิธีใช้: ลากบริเวณว่างบนแถบแท็บ หรือมุมขวาสุดของแถบแท็บ เพื่อย้ายหน้าต่าง

**การตรวจ:** `npm test` ผ่าน 64 รายการ; renderer/main build ผ่าน; ตรวจใน Electron ว่าปุ่มเพิ่มแท็บ การเลือกแท็บเดิม และปุ่มปิดแท็บยังทำงาน ตรวจ signature และ DMG ทั้งสองแบบผ่าน; Universal มี arm64/x86_64; ติดตั้งและเปิด 0.1.1 จาก Applications บน Apple Silicon แล้ว

**ผลตรวจด้วยเมาส์จริง:** หลังติดตั้ง 0.1.1 ผู้ใช้ยืนยันว่า “ลากย้ายหน้าต่างได้แล้ว”

**ขอบเขตการตรวจ:** เครื่องมือควบคุม UI ไม่สามารถยืนยันการขยับหน้าต่างได้เอง จึงใช้ผลยืนยันจากผู้ใช้สำหรับ native window drag; unit/smoke tests ไม่ใช่การทดสอบลากหน้าต่าง และยังไม่ได้รันบนเครื่อง Intel จริง

## รอบที่ 7 — วิเคราะห์เอกสารและจัดทำแผนยกระดับสู่ Super Agent Browser

**สิ่งที่ดำเนินการ:**
- วิเคราะห์เอกสารทางเทคนิคทั้งหมดในโปรเจกต์ ([PLAN.md](PLAN.md), [REVIEW.md](REVIEW.md), [IMPROVEMENTS.md](IMPROVEMENTS.md), [SUMMARY_ANTIGRAVITY.md](SUMMARY_ANTIGRAVITY.md))
- สรุปจุดบกพร่องที่ต้องแก้ไขจาก [REVIEW.md](REVIEW.md) ก่อนขยายต่อ (เช่น Runtime syntax error ใน `PageObserver`, การขาด `AbortSignal` และ Deadlines, Origin Guard ข้าม Redirect/Popups, และการส่งข้อมูล Network/Console จริงให้ AI)
- จัดทำเอกสารพิมพ์เขียว [SUPER_AGENT_ROADMAP.md](SUPER_AGENT_ROADMAP.md) กำหนด 6 เสาหลักสู่การเป็น Super Agent Browser:
  1. **Hybrid Perception:** ผสาน Semantic Accessibility Tree (`Accessibility.getFullAXTree`) ร่วมกับ Set-of-Marks (SoM) Numbered Overlay และ Coordinate Fallback
  2. **Cognitive Architecture & Self-Healing:** การแตกเป้าหมายย่อย (Hierarchical Goal Decomposition), ระบบตรวจจับและปิด Pop-up/Cookie Banner อัตโนมัติ และการสั่งงานข้ามหลายแท็บ (Multi-Tab)
  3. **Memory & Skill Synthesis:** ระบบ Session-to-Skill Compiler แปลงภารกิจที่ทำสำเร็จเป็น Macro Workflow JSON สำหรับรันซ้ำได้ทันทีแบบ Zero Token
  4. **Enterprise Security:** กำแพงกั้น Untrusted Data ป้องกัน Indirect Prompt Injection, Human-in-the-Loop Risk Checkpoints และการเข้ารหัส Key ด้วย `safeStorage`
  5. **Super Design Lab:** AST Serializer สกัดโค้ด React + Tailwind พร้อม SVG ครบถ้วน, Asset Harvester (ZIP) และ API Reverse-Engineering
  6. **Hybrid Multi-Model Engine:** แบ่งสถาปัตยกรรมเป็น Fast Perception Layer และ Deep Reasoning Layer
- กำหนดแผนงานการพัฒนา 4 เฟสชัดเจนเพื่อขับเคลื่อนโปรเจกต์ต่อไป

## รายการที่ยังต้องทำ

- ดำเนินการแก้ไขตาม Roadmap Phase 1 (Foundation Hardening จาก [REVIEW.md](REVIEW.md))
- Renderer CSP (Content-Security-Policy)
- `will-download` handling
- เก็บ API key ด้วย `safeStorage.encryptString`
- Structured logging
- Developer ID Application, notarization secrets และทดสอบการอัปเดตจริงระหว่าง signed releases สองเวอร์ชัน
- รัน Universal build บนเครื่อง Intel จริง
- พัฒนาฟีเจอร์ตาม [SUPER_AGENT_ROADMAP.md](SUPER_AGENT_ROADMAP.md) ในเฟสถัดไป

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
- `SUPER_AGENT_ROADMAP.md`

---

🤖 Generated with [Claude Code](https://claude.com/claude-code)
