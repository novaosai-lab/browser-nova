# Side Panel Extensions — Browser Nova 0.2.0 Preview

รองรับส่วนขยายแบบโฟลเดอร์ที่มี Manifest V3 และ `side_panel.default_path` สำหรับเครื่องมือ HTML/CSS/JavaScript ที่เรียก HTTP/HTTPS เช่นรูปแบบ OMS TOOL ที่ผู้ใช้ให้ตรวจ ไม่ใช่การรองรับ Chrome Web Store หรือ Chrome APIs ทุกชุด

## วิธีใช้

1. กดไอคอน Puzzle ที่ชื่อ **จัดการ Extensions** บน toolbar
2. เลือก **โหลดโฟลเดอร์ส่วนขยาย** แล้วเลือกโฟลเดอร์ที่มี `manifest.json`
3. ตรวจชื่อ เวอร์ชัน และ host permissions ในหน้าสรุปก่อนกดเพิ่ม
4. กด **เปิดแผง** หรือไอคอนทางลัดบน toolbar (ชี้เมาส์เพื่อดูชื่อส่วนขยาย)
5. กลับหน้ารายการเพื่อเปิด/ปิดใช้งานหรือถอนติดตั้ง การถอนติดตั้งมีขั้นยืนยันและลบข้อมูลโปรไฟล์เฉพาะส่วนขยายนั้น

ระบบคัดลอกไฟล์เป็น snapshot ใน userData ของ Nova; การแก้โฟลเดอร์ต้นทางภายหลังไม่เปลี่ยนโค้ดที่ติดตั้ง ต้องถอนแล้วโหลดใหม่เพื่อเปลี่ยนเวอร์ชัน โดยข้อมูลส่วนขยายเดิมจะถูกลบ รายการและสถานะเปิด/ปิดถูกจำข้ามการเปิดแอป แต่ไม่เปิดแผงหรือเรียก API เองตอน startup

## ขอบเขตที่รองรับ

| รายการ | ขอบเขต |
| --- | --- |
| Manifest | V3; `name`, `version`, `description`, `author`, `permissions`, `host_permissions`, `side_panel`, `action`, `background`, `icons` ตามตัวตรวจ manifest |
| Permission | `sidePanel` เท่านั้น; `host_permissions` เป็นรายการ host เจาะจง เช่น `http://example.test/*` หรือ `https://example.test/*` รวมทุก path/port ของ host และ scheme นั้น |
| Panel | หน้า HTML ภายในโฟลเดอร์ พร้อม local CSS/JS และ fetch ไปยัง host ที่อนุญาต |
| Action | `action.default_title` ยอมรับได้; Nova สร้างปุ่ม Puzzle ตามชื่อส่วนขยายเอง ยังไม่แสดง custom icons |
| Background | ไม่รัน worker ทั่วไป รับเฉพาะ bootstrap `chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });` หรือรูปแบบ `.catch((error) => console.error(error))` ที่ตรวจรองรับ แล้วใช้ตัวเปิดแผงของ Nova แทน |
| Session | persistent session แยกต่อส่วนขยาย ไม่ใช้ cookies/login ของแท็บหลักหรือ isolated test tab |
| Import limits | ไม่เกิน 100 ส่วนขยาย; ต่อโฟลเดอร์ไม่เกิน 25 MB / 2,000 entries / ความลึก 12 ระดับ; ไม่รับ symlinks หรือ path ที่ออกนอกโฟลเดอร์ |

ไม่รองรับ `.crx`, store install, wildcard host, arbitrary service worker, content scripts, popup API, browser-wide tab integration, extension auto-update หรือ Chrome API shim แบบทั่วไป แม้ native Electron อาจมี API บางตัวเพิ่ม การใช้นอกขอบเขตนี้ยังไม่ถือว่าผ่านการทดสอบ

## การแยกสิทธิ์และเครือข่าย

- ใช้ native extension origin และ host permissions ของ Electron; เปิด `webSecurity`, sandbox และ context isolation ไม่มี Node integration หรือ Nova preload bridge ในแผง
- session ของส่วนขยายบล็อกคำขอที่ไม่ใช่ไฟล์ของตัวเองหรือ host ที่อนุญาต รวม redirect ไป host อื่น; ไม่เปิด popup, top-level navigation ออกจาก panel, download หรือ device permissions
- IPC สำหรับจัดการส่วนขยายตรวจว่าเป็น main frame ของ app shell และตรวจ ID/bounds ใน main process
- Registry ผิดรูปแบบไม่ทำให้แอปปิด และไม่เขียนทับรายการเดิมเงียบ ๆ; หน้าจอ Extensions จะแสดงข้อผิดพลาดและหยุด import จนแก้ registry
- HTTP ยังคงเป็น HTTP; ไม่ปิด TLS validation/CORS ทั้งแอปเพื่อให้ส่วนขยายทำงาน
- การเชื่อมต่อบริการภายในยังขึ้นกับเครือข่าย/VPN/การยืนยันตัวตนของเครื่อง และการรองรับส่วนขยายไม่ได้รับรองผลการแก้ข้อมูลของบริการนั้น

## หลักฐานทดสอบ

- `npm test`: tests เดิม 64 รายการ + extension unit tests 3 รายการ ผ่าน ครอบคลุม manifest, host boundary, bootstrap และ symlink rejection
- `npm run test:extensions`: Electron จริง 18 checks ใช้ loopback API จำลอง ครอบคลุม import/cancel, snapshot, ไม่มี app bridge, PATCH/POST, blocked host/redirect, modal bounds, disable/restore/re-enable/uninstall และ corrupt registry
- UI manual ผ่านตัวควบคุมแอป: โหลด fixture ด้วย folder dialog, ดูสิทธิ์, เปิดจาก toolbar, กรอกค่า/กดปุ่มแล้วได้ผล และเปิด Settings โดยแผงไม่ทับ modal
- Packaged Universal 0.2.0 เปิดจาก Applications และเปิดหน้า Extensions ได้บน Apple Silicon; ยังไม่ได้รันบน Intel/Windows
- `tests/fixtures/side-panel` เป็น fixture สาธารณะที่ไม่เรียกเครือข่าย ใช้ทดสอบ UI ได้โดยไม่เชื่อมบริการจริง
- ตัวตรวจ manifest/bootstrap ยอมรับ OMS TOOL 1.0 ที่ผู้ใช้ให้ตรวจ แต่ **ยังไม่ได้เรียก API ภายในหรือทดสอบการแก้ข้อมูลจริง** ไม่รวมไฟล์หรือ host ภายในของ OMS TOOL ใน repository/release

## อ้างอิง

- [Electron 34.5.8 extension support](https://github.com/electron/electron/blob/v34.5.8/docs/api/extensions.md)
- [Chrome Side Panel API](https://developer.chrome.com/docs/extensions/reference/api/sidePanel)
