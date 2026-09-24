# macOS builds and updates

## สถานะปัจจุบัน

เตรียม DMG/ZIP, app icon, Universal build, update controller, Settings UI, native update menu และ GitHub Actions แล้ว

เผยแพร่ [v0.2.0-preview.1](https://github.com/novaosai-lab/browser-nova/releases/tag/v0.2.0-preview.1) เมื่อ 22 กันยายน 2026 พร้อม DMG/ZIP/blockmap สำหรับ arm64 และ Universal รวม 8 ไฟล์ และ `SHA256SUMS` ตรวจ digest บน GitHub ตรงกับไฟล์ในเครื่องแล้ว ติดตั้งและเปิด Universal ใน Applications บน Apple Silicon แล้ว; ยังไม่ได้ทดสอบรันบน Intel จริง

รุ่น 0.2.0 เพิ่ม Side Panel Extension Manager ตาม [EXTENSIONS.md](EXTENSIONS.md) ดูผลตรวจและข้อจำกัดใน [IMPROVEMENTS.md](IMPROVEMENTS.md) ผล CI แยกตาม commit อยู่ที่ [Test and build macOS](https://github.com/novaosai-lab/browser-nova/actions/workflows/ci.yml) หลังแก้งานให้ปรับเอกสารและ push source ตาม [AGENTS.md](AGENTS.md); ขั้นตอนเผยแพร่ binary release อยู่ด้านล่าง

Local preview ใช้ ad-hoc signing และตั้ง `updatesEnabled: false` โดยเจตนา เพราะไม่มี Developer ID Application และ Apple notarization credentials ในเครื่องนี้ ไม่มี feed ปลอมหรือ GitHub token ฝังในแอป

ยังไม่ได้ทดสอบการอัปเดตจริงระหว่าง signed releases สองเวอร์ชัน ต้องมีใบรับรองและเผยแพร่ release จริงก่อน การผ่าน unit tests ไม่ได้ยืนยันว่า Squirrel.Mac ติดตั้งข้ามเวอร์ชันสำเร็จ

## Build ในเครื่อง

```sh
npm ci
npm test
npm run test:extensions
npm run dist:mac
npm run dist:mac:universal
```

ผลลัพธ์ใน `release/local/` มี `.dmg` สำหรับติดตั้ง, `.zip` และ `.blockmap` ส่วน ZIP จะใช้เป็น update payload ใน signed releases

## ตั้งค่า GitHub ครั้งแรก

Repository: **novaosai-lab/browser-nova** (public)

ใส่ค่าใน **Settings → Secrets and variables → Actions** ด้วยตนเอง ห้ามใส่ certificate หรือรหัสผ่านใน source code, issue, release notes หรือแชต:

| Secret | ค่า |
| --- | --- |
| `CSC_LINK` | Developer ID Application certificate พร้อม private key ที่ export เป็น `.p12` แล้วแปลงเป็น base64 |
| `CSC_KEY_PASSWORD` | รหัสผ่านของ `.p12` |
| `APPLE_ID` | Apple ID สำหรับ notarization |
| `APPLE_APP_SPECIFIC_PASSWORD` | App-specific password ที่ออกโดย Apple |
| `APPLE_TEAM_ID` | Apple Developer Team ID |

Apple Development certificate ใช้แทน Developer ID Application สำหรับ release นี้ไม่ได้ Workflow ใช้ `GITHUB_TOKEN` ของ Actions ที่จำกัดเฉพาะ repository จึงไม่ต้องเพิ่ม PAT สำหรับเผยแพร่ไฟล์

CI ทุก push เข้า main ทดสอบและสร้าง local arm64 artifact ส่วน **Signed macOS release** ทำงานเมื่อ push stable tag `vX.Y.Z` หรือกด Run workflow สร้าง Universal, ลงนาม, notarize, ตรวจลายเซ็นและ ticket แล้วอัปโหลดเป็น **draft release** เพื่อให้ตรวจไฟล์ก่อน Publish ไม่อัปเดตแอปของผู้ใช้จาก draft หรือ preview

## ออกเวอร์ชันใหม่

1. เพิ่ม `version` ด้วย `npm version patch --no-git-tag-version` แล้ว commit ทั้ง `package.json` และ lockfile
2. รัน tests และ push code จากนั้นสร้าง tag ให้ตรงเวอร์ชัน เช่น `v0.1.1` และ push tag
3. รอ workflow **Signed macOS release** ผ่าน
4. ใน draft release ตรวจว่ามี Universal `.dmg`, `.zip`, `.blockmap` และ **`latest-mac.yml`** ครบ ไฟล์ต้องมาจาก build เดียวกัน
5. ติดตั้ง DMG และตรวจการเปิดเว็บ/Settings จากนั้น Publish release เพื่อเปิดให้ updater เห็นเวอร์ชันใหม่

เก็บ artifact ของเวอร์ชันเก่าไว้เพื่อให้ differential download ทำงาน ห้ามแทนที่ไฟล์ release ที่เผยแพร่แล้ว หากพบปัญหาให้เพิ่มเวอร์ชันและออก release แก้ไข ไม่ใช้การ downgrade อัตโนมัติ

## Build signed release ในเครื่อง

ตั้งค่าความลับผ่าน environment ที่ปลอดภัย แล้วรัน:

```sh
npm run release:mac
```

ใช้ `CSC_NAME` ชื่อ `Developer ID Application: …` จาก Keychain แทน `CSC_LINK` ได้ Notarization รองรับ `APPLE_ID`/password/team, App Store Connect API key (`APPLE_API_KEY`, `APPLE_API_KEY_ID`, `APPLE_API_ISSUER`) หรือ `APPLE_KEYCHAIN_PROFILE` ตาม electron-builder

คำสั่งนี้สร้างไฟล์ใน `release/production/` และ **ไม่อัปโหลด** โดยอัตโนมัติ ถ้าขาด signing/notarization credentials จะหยุดก่อน build ใช้ `NOVA_GITHUB_REPOSITORY=OWNER/REPO` เปลี่ยนปลายทาง หรือ `NOVA_UPDATE_URL=https://…/mac/` สำหรับ server ของตนเอง เลือกอย่างใดอย่างหนึ่ง ต้อง build signed app ใหม่เพื่อเปลี่ยนปลายทาง

## พฤติกรรมการอัปเดต

- ใช้ `app-update.yml` ที่ electron-builder สร้างจาก GitHub provider; หน้าเว็บตั้ง feed เองไม่ได้
- ตรวจเมื่อเปิดแอป (หลัง 10 วินาที) และทุก 6 ชั่วโมง เฉพาะ signed release build
- แจ้งเวอร์ชันใหม่ ให้ผู้ใช้เลือกดาวน์โหลด แสดง progress ใน Settings และ Dock
- ตรวจ hash ของไฟล์ด้วย electron-updater และตรวจลายเซ็นบน macOS ผ่าน native updater
- ไม่ติดตั้งเองเมื่อปิดแอป ต้องกดรีสตาร์ตและยืนยันก่อน งานที่ยังไม่ได้บันทึก/automation อาจถูกปิด
- คง profile เดิมไว้ใน `browser-nova`; ไม่ลบ settings, cookies หรือ artifacts ระหว่าง update
- ปัญหา network/download/install แสดง error และให้ตรวจสอบใหม่ ป้องกันการกดซ้ำระหว่างดาวน์โหลด
- ไม่เปิด downgrade หรือ prerelease โดยอัตโนมัติ
- เว็บที่เรียกดูยังรองรับ HTTP ส่วน binary update ใช้ GitHub HTTPS หรือ HTTPS feed เท่านั้น

## ตรวจรับ updater ก่อนเปิดใช้งานจริง

ใช้ repository ทดลองแยกและ Developer ID เดียวกันสำหรับทั้งสองเวอร์ชัน โดยตั้ง `NOVA_GITHUB_REPOSITORY` ตั้งแต่ build แรก:

1. ติดตั้ง signed version A จาก DMG ลง Applications
2. เผยแพร่ signed version B ที่เลขมากกว่า พร้อม ZIP/blockmap/latest-mac.yml
3. ใน A กด Check for Updates → Download ดู progress จนพร้อมติดตั้ง
4. กดไว้ภายหลังและออกจากแอป: ต้องยังเป็น A เพราะไม่ติดตั้งบน quit
5. เปิดใหม่ ดาวน์โหลด/ใช้ cache แล้วกด Restart and Install: ต้องเปิดเป็น B และรักษาข้อมูล profile
6. ทดสอบ offline, feed 404, checksum mismatch, invalid signature และกดซ้ำ โดยใช้ repo ทดลองเท่านั้น

ทดสอบอัตโนมัติใน repository ครอบคลุม state transitions, error/retry, download/install gating, concurrent requests และ build config แต่ใช้ fake updater ไม่ดาวน์โหลดหรือติดตั้งจริง

## อ้างอิง

- [electron-builder auto-update v26](https://www.electron.build/v26/docs/features/auto-update/)
- [macOS code signing](https://www.electron.build/v26/docs/features/code-signing/)
- [GitHub Actions setup-node](https://github.com/actions/setup-node)

### Network inspector development build (22 September 2026)

The API inspector changes are available in the working-branch CI macOS artifact and local arm64 build. They do not replace the published v0.2.0-preview.1 assets. Run `npm run test:network` before packaging. Auto-update remains disabled.

Local installation verified: the arm64 Network Inspector build from commit `666f44d` is installed in `/Applications/Browser Nova.app`, with the previous app backed up locally. App signature and executable/ASAR hashes match the build; the installed UI opens the Fetch/XHR inspector. This is a manual local installation, not an auto-update test.

Resizable-panel local build installed on 22 September 2026. Previous app backed up as `release/backups/Browser Nova-before-resize-20260922.app`. Signature verification and installed expand/restore UI checks passed. No new public release or signed-update test.

## 0.2.1 Preview distribution

Publish as `v0.2.1-preview.1` (prerelease, no update feed). Use Universal DMG/ZIP/blockmaps plus `Browser-Nova-0.2.1-macOS-open-helper.zip` containing the executable helper and Thai README; hash all five assets into SHA256SUMS. Stage only this version, verify uploaded asset digests, then publish. Do not replace earlier assets.

The helper is an explicit user-run per-app quarantine override, not a certificate or notarization workaround performed automatically by the app. Run via `bash` in Terminal as documented in [the helper guide](scripts/macos/README-OPEN-MAC.md). Users must trust the download; enterprise policy can still block it.

## 0.3.0 local build

Bookmarks, manual encrypted password save/fill and Copy cURL are included in local arm64 builds and CI artifacts. Run `npm run test:logins` in addition to existing checks. Published 0.2.1 assets are unchanged; no new public release or update feed is implied by source sync. Keychain continuity between ad-hoc or signed versions is unverified.

Local 0.3.0 arm64 was installed and launched; signature and star/password UI checked. Previous app backup: `release/backups/Browser Nova-before-library-20260924.app`. No production password or API was used.
