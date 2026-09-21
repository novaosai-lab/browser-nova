# Browser Nova

Desktop browser สำหรับเปิด HTTP/HTTPS, ตรวจ DOM/Console/Network และสั่ง automation ด้วย AI ภาษาไทยหรืออังกฤษ สร้างด้วย Electron, React และ TypeScript

## ดาวน์โหลด macOS

ไฟล์ติดตั้งอยู่ที่ [GitHub Releases](https://github.com/novaosai-lab/browser-nova/releases)

- **arm64**: Mac ที่ใช้ Apple Silicon
- **universal**: Apple Silicon และ Intel
- เปิด DMG แล้วลาก **Browser Nova.app** ไปที่ **Applications**
- macOS 11 หรือใหม่กว่า สำหรับ Electron 34 ที่ใช้ใน build นี้

รุ่น 0.1.0 preview เป็น build สำหรับทดสอบ ลงนามแบบ ad-hoc ยังไม่ได้ notarize กับ Apple และยังไม่เปิดอัปเดตอัตโนมัติ ต้องติดตั้ง signed release แรกด้วยตนเองเมื่อพร้อม รุ่น signed ต่อไปจะตรวจสอบผ่าน GitHub Releases และให้ยืนยันก่อนติดตั้ง ดู [RELEASE.md](RELEASE.md)

## ใช้งาน

- พิมพ์ URL แล้ว Enter; URL `http://` ยังคงใช้ HTTP เว้นแต่เว็บไซต์/HSTS บังคับเปลี่ยนเอง
- `Cmd+T` เปิดแท็บ, `Cmd+L` ไปแถบที่อยู่, `Cmd+R` โหลดใหม่
- Settings ใช้ตั้ง AI provider/API key และดูสถานะอัปเดต
- เมนู **Browser Nova → Check for Updates…** ใช้ตรวจเวอร์ชันใหม่

## พัฒนาและทดสอบ

ต้องมี Node.js 24, npm และ macOS สำหรับสร้างไฟล์ติดตั้ง

```sh
npm ci
npm run dev
```

```sh
npm test
npm run dist:mac            # local arm64 DMG + ZIP
npm run dist:mac:universal  # local Apple Silicon + Intel DMG + ZIP
```

ผลลัพธ์อยู่ใน `release/local/` แอปที่ติดตั้งเปิดได้โดยไม่ใช้ Vite หรือ fixture server ข้อมูลผู้ใช้อยู่ใน `~/Library/Application Support/browser-nova` และคงอยู่เมื่อเปลี่ยนเวอร์ชัน

หากใช้หน้า fixture ให้รัน `npm run build:main` และ `npm run test:fixture` แยก terminal ก่อนเปิด `http://127.0.0.1:8080` ชุด `npm test` เริ่ม fixture เอง จึงต้องไม่มี process อื่นใช้พอร์ต 8080 ขณะทดสอบ

โครงการยังอยู่ในช่วงพัฒนา ดูข้อจำกัดเดิมด้าน inspection, AI automation และ design extraction ใน [REVIEW.md](REVIEW.md) การเพิ่ม packaging และ updater ไม่ได้แก้ข้อจำกัดทั้งหมดนั้น
