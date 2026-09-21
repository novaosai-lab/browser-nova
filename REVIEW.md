**ผลรีวิว Browser Nova — 21 กันยายน 2026**

อ่าน IMPROVEMENTS.md และ SUMMARY_ANTIGRAVITY.md แล้วตรวจเทียบกับซอร์สโค้ด รันชุดทดสอบเดิม และทำ regression checks แบบแยกส่วน ผลคือมีโครงสร้างต้นแบบครบหลายส่วนและมีการปรับปรุงตามรายงานจริง แต่ยังไม่ควรระบุว่าเสร็จ 100% ตาม PLAN.md เพราะพบ runtime bugs และบางฟังก์ชันยังส่งผลลัพธ์จำลอง

การตรวจครั้งนี้เป็น code review และการทดสอบแยกส่วน ไม่ได้ทดสอบ UI ของ Electron จริง ไม่เรียกผู้ให้บริการ AI จริง และไม่ได้แก้ซอร์สแอป คำสั่ง build/test สร้างไฟล์ใน dist ตามปกติ

สิ่งที่ทำแล้วจากการตรวจโค้ด:

| ส่วน | สิ่งที่มีจริง | ขอบเขตที่ยืนยันได้ |
| --- | --- | --- |
| Browser shell | Electron, React UI, WebContentsView, tabs, URL normalization, profile/session | มี implementation; การเปิดแอปยังมีปัญหา ESM ด้านล่าง |
| Inspection | CDP broker, element picker, console/network events | มีโค้ดรับ event; AI tools สำหรับอ่านข้อมูลยังเป็น placeholder |
| Automation | navigate/click/fill/assertText/screenshot/scroll/wait, workflow, reports, CLI/local API | มี implementation; cancel, origin, navigation failure และ cleanup ยังไม่ครบ |
| AI | orchestrator, Gemini/OpenAI-compatible adapters, MockAdapter, budget/confirmation | มีโครงสร้าง; page observation เสีย และไม่มีหลักฐาน live-provider end-to-end |
| Design Lab | Smart Copy, design tokens, table CSV/JSON, PNG + HTML snapshot | มี implementation ขั้นต้น; React export และสำเนาแบบออฟไลน์ยังไม่พร้อมครบ |
| Improvements รอบก่อน | budget settings wiring, sanitize artifact path, afterUrl จริง, typecheck pipeline, Gemini key ใน header, popup handling, pending-request cap | ตรวจพบการแก้ตามรายงาน แต่ network cap/cleanup ยังมีข้อผิดพลาดอื่นเหลืออยู่ |

ผลตรวจที่รันรอบนี้:

| การตรวจ | ผล |
| --- | --- |
| npm test | ผ่าน: typecheck, main/preload build, unit 20/20 และ smoke 19/19 |
| npm run build:renderer | ผ่าน |
| JavaScript ของ PageObserver | พบ SyntaxError: Unexpected identifier 'as' และได้ observation ว่าง |
| Cancel ขณะรอ model | ยังมี click หลัง cancel; สถานะ running → cancelled → succeeded |
| navigate รับ errorText และไม่มี load event | Promise resolve เป็นผลสำเร็จหลัง timeout |
| workflow click จาก origin ที่ไม่อนุญาต | action ยังถูกเรียก และ report เป็น completed |
| AI inspectNetwork/inspectConsole | คืนข้อความคงที่ ไม่มีรายการ request/log |
| responseReceived แล้ว loadingFailed | เหลือ event success 200; failure หลัง headers ไม่ถูกส่งต่อ |
| รัน workflow จบสองครั้ง | console/network listeners ค้างอย่างละสองตัว |
| main entry แบบ ESM โดย mock Electron | พบ __dirname is not defined ก่อนสร้างหน้าต่าง |
| Smart Copy ฟอนต์ที่มี quote | React snippet parse ไม่ผ่าน; child SVG หาย และ CSS ใช้ camelCase |

Regression checks ใช้โค้ดจริงที่ bundle ชั่วคราวแล้วแทน CDP/model/Electron ด้วย test doubles และใช้ JavaScript parser ตรวจ expression ไม่ควรนับผลนี้เป็นการทดสอบหน้าต่างหรือเว็บจริง ข้อจำกัด bind พอร์ตที่ระบุใน IMPROVEMENTS.md ไม่เกิดในการรันชุดทดสอบบนเครื่องนี้

ข้อแก้ไขเรียงตามความสำคัญ โดย P1 = ควรแก้ก่อนใช้งานจริง, P2 = ฟังก์ชันหรือความเสถียรที่ควรแก้ถัดมา:

1. **[P1] Main entry ใช้ __dirname ทั้งที่ build เป็น ESM** — [index.ts:61](</Users/watit.tan/Desktop/ME/Browser nova/src/main/index.ts:61>) ใช้ตัวแปรที่ไม่ได้ประกาศ ขณะที่ package ระบุ type=module และ build script ตั้ง format=esm; banner สร้างเพียง require จึงเกิด ReferenceError ก่อนสร้างหน้าต่าง แก้โดยคำนวณ directory จาก import.meta.url หรือเปลี่ยน main build เป็น CJS อย่างสอดคล้องกัน แล้วเพิ่ม test เปิดแอปจริง ทั้ง dev และ build เอกสาร Electron ยืนยันว่า main process ใช้ Node ESM loader: [Electron ESM](https://www.electronjs.org/docs/latest/tutorial/esm#main-process)

2. **[P1] AI อ่านหน้าเว็บไม่ได้จาก expression ที่มี TypeScript หลุดเข้า browser** — [observation.ts:57](</Users/watit.tan/Desktop/ME/Browser nova/src/ai/observation.ts:57>) มี `(el as any).value` ภายใน template string ที่ส่ง Runtime.evaluate จึงไม่ถูก compiler แปลงและ browser parse ไม่ได้ อีกทั้งไม่ตรวจ exceptionDetails จึงคืน url=unknown แบบเงียบ แก้ให้ expression เป็น JavaScript ล้วน ตรวจ exceptionDetails แล้วหยุดหรือแจ้ง error อย่างชัดเจน หลังแก้ต้องไม่อ่าน value ของ password/secret input ไปส่ง model

3. **[P1] Cancel ไม่กัน action หลัง model ตอบกลับ และเวลา run ไม่ใช่ deadline จริง** — [orchestrator.ts:73](</Users/watit.tan/Desktop/ME/Browser nova/src/ai/orchestrator.ts:73>) ไม่ตรวจ cancellation หลัง await model ก่อน executeTool; cancel เปลี่ยนแค่ boolean และท้าย run ยัง emit succeeded การทดสอบกด cancel ระหว่างรอ model แล้วยังได้ click จริงผ่าน executor double แก้ด้วย AbortSignal, runId ที่ไม่เปลี่ยนระหว่าง run, cancellation checks ก่อนทุก action และ terminal state เดียว พร้อม timer ที่หยุด fetch/การรอได้ ปัจจุบัน budget เช็กเวลาเฉพาะตอน recordAction จึงไม่ครอบคลุม model ที่ค้างหรือ confirmation ที่ไม่ตอบ

4. **[P1] Origin restriction ยังไม่ครอบคลุมการทำงานจริง** — [runner.ts:120](</Users/watit.tan/Desktop/ME/Browser nova/src/automation/runner.ts:120>) ตรวจเฉพาะ URL ของ step navigate ไม่ตรวจหน้าเริ่มต้น หน้าใหม่หลัง redirect/click หรือหน้าก่อน fill/extract ส่วน AI เรียก ActionExecutor โดยตรงโดยไม่มี origin guard กลาง ควรใช้ policy กลางตรวจ scheme/origin/frame ก่อน action และหลัง navigation รวมถึง popup และหยุดเมื่อผู้ใช้เปลี่ยนหน้าระหว่างรัน ต้องมี run lock ต่อแท็บเพื่อไม่ให้ AI กับ workflow ควบคุมพร้อมกัน

5. **[P1] การเก็บ key และขอบเขต trusted UI ยังไม่ครบ** — [index.ts:42](</Users/watit.tan/Desktop/ME/Browser nova/src/main/index.ts:42>) เขียน API keys ลง settings.json เป็นข้อความธรรมดา และ [ipc-handlers.ts:227](</Users/watit.tan/Desktop/ME/Browser nova/src/main/ipc-handlers.ts:227>) ส่งค่าทั้งหมดกลับ renderer; handler ใช้ TypeScript annotations แต่ไม่มี runtime schema หรือ sender validation นอกจากนี้ shell navigation ยอมรับ file:// ทุก path และ dev URL ด้วย startsWith ควรเก็บ secret ใน Keychain/safeStorage, ส่งกลับเฉพาะสถานะว่ามี key, ตรวจ senderFrame/exact URL และ schema และเพิ่ม CSP โดยไม่ทำลาย dev workflow

6. **[P1] ปุ่มยืนยัน/หยุดอาจใช้ tabId ผิดเมื่อสลับแท็บ** — [AiChatPanel.tsx:35](</Users/watit.tan/Desktop/ME/Browser nova/src/renderer/components/ai/AiChatPanel.tsx:35>) รับ AI events ทุกแท็บโดยไม่กรอง tabId แล้ว handleConfirm/handleCancel ใช้ activeTab ขณะกด หากงานของ A ขออนุมัติแล้วผู้ใช้เปลี่ยนไป B การตอบจะถูกส่งไป B และ A ค้าง ควรเก็บ state แยกด้วย tabId+runId และส่ง confirmationId กลับให้ตรงคำขอ ส่วน step update ยังใช้ msg_ จาก main แต่ placeholder ใช้ ai_ จึงแสดง progress ไม่ได้ตามที่ตั้งใจ

7. **[P2] Navigation ล้มเหลวแต่รายงานสำเร็จ** — [actions.ts:20](</Users/watit.tan/Desktop/ME/Browser nova/src/automation/actions.ts:20>) resolve เมื่อครบ timeout และไม่ตรวจ errorText จาก Page.navigate จึงเดิน step ต่อได้ทั้งที่เว็บไม่เปิด ควรตรวจ errorText, reject เมื่อ timeout และผูก load/URL กับ navigation ที่เริ่มจริง แล้วทดสอบ DNS failure, refused connection, redirect และ same-document navigation

8. **[P2] AI ตรวจ Network/Console ยังเป็น placeholder** — [orchestrator.ts:197](</Users/watit.tan/Desktop/ME/Browser nova/src/ai/orchestrator.ts:197>) คืนข้อความ “ตรวจสอบเรียบร้อยแล้ว” แทนข้อมูลจริง ทำให้ model ไม่มีหลักฐานสำหรับวิเคราะห์ปัญหา ควรให้ broker เก็บ buffer ต่อแท็บพร้อม limit แล้วส่ง structured logs/requests และ timestamp ให้ tool ตอบกลับ รวมถึงป้องกัน model สรุปสำเร็จเมื่อยังไม่มีหลักฐาน นอกจากนี้ [tab-manager.ts:62](</Users/watit.tan/Desktop/ME/Browser nova/src/main/tab-manager.ts:62>) fallback ไป MockAdapter เมื่อไม่มี API key ควรแสดงโหมด Demo ชัดหรือให้ตั้งค่าก่อนใช้งานจริง

9. **[P2] Smart Copy ยังสร้าง component ที่ใช้จริงไม่ได้ในหลายกรณี** — [design-lab.ts:41](</Users/watit.tan/Desktop/ME/Browser nova/src/main/design-lab.ts:41>) แทรก style/text ลงโค้ดโดยไม่ escape; fontFamily ที่มี quote ทำให้ TSX parse ไม่ผ่าน และ innerText ทำให้ child element/SVG/image หาย ส่วน CSS ใช้ backgroundColor/fontSize แทน kebab-case ควร serialize DOM เป็น AST, escape string/JSX, รักษาลูก/attributes ที่รองรับ และ compile preview ทุก export Snapshot ปัจจุบันมี PNG และ outerHTML แต่ยังไม่ได้ bundle assets, rewrite URL หรือสร้าง offline archive

10. **[P2] การแก้ memory ของ Network ลบ request เร็วเกินไป** — [cdp-broker.ts:179](</Users/watit.tan/Desktop/ME/Browser nova/src/automation/cdp-broker.ts:179>) ลบ entry ตั้งแต่ responseReceived ซึ่งยังไม่ใช่จุดจบการรับ body เมื่อเกิด loadingFailed ภายหลังจึงไม่มี metadata และไม่รายงานความล้มเหลว ควรเก็บจน loadingFinished/loadingFailed ใช้ cap/TTL คุม request ที่ค้าง และอัปเดต UI แถวเดิมตาม requestId; เพิ่ม test สำหรับ body truncation และ redirect chain

11. **[P2] Cleanup ยังมีทั้ง listeners และ webContents ที่ไม่ถูกปิด** — [runner.ts:102](</Users/watit.tan/Desktop/ME/Browser nova/src/automation/runner.ts:102>) เพิ่ม console/network listeners ทุกรอบแต่ไม่มี unsubscribe ใน finally; ทดสอบสอง run แล้วเหลืออย่างละสอง listener ส่วน [tab-manager.ts:266](</Users/watit.tan/Desktop/ME/Browser nova/src/main/tab-manager.ts:266>) ปิดแท็บด้วย removeChildView/delete map แต่ไม่ close webContents ควรมี dispose ต่อแท็บ/runner/broker และทดสอบหลังปิดแท็บว่าไม่มีงานหรือ renderer เหลือ นอกจากนี้ macOS ปิดแล้วเปิดหน้าต่างใหม่จะเรียก registerIpcHandlers ซ้ำ ควรลงทะเบียนครั้งเดียวหรือถอด handlers ตอน dispose

12. **[P2] Locator เลือก element แรกแม้มีตัวที่มองเห็นเพียงตัวเดียวเป็นตัวถัดไป** — [locators.ts:27](</Users/watit.tan/Desktop/ME/Browser nova/src/automation/locators.ts:27>) คำนวณ visibleEls แล้วทิ้งผล กลับไปใช้ els[0] ทำให้ selector ที่ตรงกับ hidden template ก่อนปุ่มจริง timeout ได้ ควรเลือก visibleEls[0] เมื่อมีหนึ่งตัว และเพิ่ม enabled/readonly/overlay/hit-target checks ก่อน input action

ความหมายของผลทดสอบในสองเอกสารควรปรับให้ตรงกัน: SUMMARY_ANTIGRAVITY.md ระบุ “เสร็จ 100% ตาม PLAN” แต่ [smoke-test.ts:78](</Users/watit.tan/Desktop/ME/Browser nova/tests/e2e/smoke-test.ts:78>) สร้าง MockAdapter และ observation เอง แล้วเช็ก decision ทีละข้อ ไม่มี Electron, PageObserver, AiOrchestrator หรือ ActionExecutor อยู่ในเส้นทางทดสอบนั้น ดังนั้น 39/39 ยืนยันเฉพาะ tests ปัจจุบัน ไม่ยืนยัน AI browser end-to-end ข้อความแนะนำใน IMPROVEMENTS.md ว่า npm test จะทดสอบ AI loop ครบวงจรจึงควรแก้ด้วย

งานจาก PLAN ที่ยังไม่พบ implementation ครบในซอร์สปัจจุบัน ได้แก่ Asset Collector/ZIP, Evidence Pack, AI Rebuild ทั้งหน้า, Visual Compare, multi-page/state capture, snapshot แบบ HTMLComplete/MHTML/PDF, AI Pause/Resume และ persistent session restore ของรายการแท็บ (มี persistent cookies แล้ว) งาน download handling, structured logs, CI, packaging/signing และ auto-update ก็ยังเป็น backlog ตาม IMPROVEMENTS.md ไม่ควรนับรวมเป็นฟีเจอร์ที่ส่งมอบแล้ว

ลำดับแก้ที่แนะนำ:

| ลำดับ | ผลลัพธ์ที่ต้องได้ก่อนเดินต่อ |
| --- | --- |
| 1 | แอปเปิดจริงได้และ PageObserver อ่าน fixture ได้; เพิ่ม Electron startup test และ workflow บน DOM จริง |
| 2 | Cancel/deadline/origin/run lock/confirmation ถูกบังคับใน code และทดสอบ action ที่พยายามทำหลัง cancel หรือข้าม origin |
| 3 | Key storage, runtime IPC validation และ state ของแท็บถูกต้อง; ทดสอบสลับแท็บและปิด/เปิดหน้าต่างใหม่ |
| 4 | Network/Console ส่งหลักฐานจริง, navigation failure ไม่เป็น success, report และ cleanup ครบ |
| 5 | Smart Copy export compile ได้และ preview ตรง fixture ก่อนเพิ่ม Clone/Evidence Pack/Asset Collector |
| 6 | ทดสอบ live provider ด้วย fixture ที่ไม่มีข้อมูลจริง, ทำ packaged smoke test แล้วจึงอัปเดตเอกสารสถานะส่งมอบ |
เสนอปรับสถานะโปรเจกต์เป็น “ต้นแบบที่ build และ unit/smoke tests ผ่าน; รอแก้ runtime blockers และตรวจ Electron end-to-end” โดยเก็บจำนวน test และขอบเขตที่ทดสอบไว้ชัดเจน ไม่ใช้เปอร์เซ็นต์ความครบของผลิตภัณฑ์แทน test pass rate
