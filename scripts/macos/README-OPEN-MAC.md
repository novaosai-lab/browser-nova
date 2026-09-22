# เปิด Browser Nova Preview บน Mac เครื่องอื่น

1. ดาวน์โหลด DMG จาก GitHub Release ของ novaosai-lab/browser-nova เท่านั้น เลือก Universal สำหรับ Intel หรือ Apple Silicon
2. เปิด DMG แล้วลาก Browser Nova.app ไป Applications
3. แตกไฟล์ Browser-Nova-0.2.1-macOS-open-helper.zip
4. เปิด Terminal พิมพ์ `bash` เว้นวรรค แล้วลากไฟล์ `Open-Browser-Nova.command` ลงใน Terminal และกด Enter
5. อ่านคำอธิบายแล้วพิมพ์ `OPEN` เพื่ออนุญาตเฉพาะแอปนี้ จากนั้นแอปจะเปิดให้

สคริปต์ไม่ดาวน์โหลดหรือติดตั้งแอปให้ ไม่ใช้ sudo ไม่ปิด Gatekeeper ทั้งเครื่อง และไม่ทำงานอัตโนมัติ สคริปต์เองอาจถูกบล็อกหากดับเบิลคลิก จึงให้รันด้วย bash ตามขั้นตอนด้านบน

การลบ quarantine ข้ามการตรวจแอปดาวน์โหลดของ Gatekeeper สำหรับแอปนี้ ไม่ได้เพิ่ม Developer ID หรือ notarization ตรวจ SHA256SUMS เทียบกับไฟล์ดาวน์โหลดก่อนใช้งานได้ด้วย `shasum -a 256 <file>`; ad-hoc signature ตรวจความสมบูรณ์แต่ไม่ยืนยันผู้เผยแพร่ เครื่องที่องค์กรจัดการอาจไม่อนุญาตขั้นตอนนี้ ให้ติดต่อผู้ดูแล

ไฟล์ arm64 ใช้กับ Apple Silicon เท่านั้น Universal มีทั้ง Intel และ Apple Silicon แต่ยังไม่ได้ทดสอบรันบน Intel จริง ต้องใช้ macOS ตามข้อกำหนดของแอป และ preview ยังปิด auto-update installation อยู่
