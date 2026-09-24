# Bookmarks, saved passwords, and Copy cURL (0.3.0)

## Bookmarks

Click the star next to the address bar to open **Bookmarks & Passwords**. The current URL/title are prefilled. Save a bookmark, search saved entries, open one, rename it, or delete it. Saving the same normalized URL updates its title. Stored locally in `userData/library/bookmarks.json`; no cloud sync or folders yet.

## Saved passwords

In the star dialog select **Passwords**, enter the site's URL, username and password, then save. Saving the same origin + username updates the password. Multiple accounts per origin are supported. This version uses explicit manual save; it does not detect successful login or show a Chrome-style automatic save prompt.

Each complete login record is encrypted with Electron 34 `safeStorage` before writing to `userData/library/logins.json` (mode 0600). On macOS, encryption keys use Keychain. No plaintext fallback: unavailable OS storage (or Linux basic_text) disables saving. Passwords are never returned by the listing IPC and are not exported or synced. The trusted app dialog receives the password you type temporarily; it clears after a successful operation or close. No real account credentials are included in source, logs, tests, or GitHub; tests use synthetic fixtures.

Open the saved origin in a normal tab and click **Fill บนแท็บปัจจุบัน**. The native confirmation shows the origin and username (and warns for unencrypted HTTP). On approval, the main process rechecks the active tab and the isolated-world script checks exact origin including scheme and port. It fills one visible login password field and the associated username without submitting. It rejects new-password fields, multiple password fields, other origins, and isolated test profiles. Cross-origin iframes, shadow DOM and multi-step/custom login controls are not supported yet. The receiving page can read filled values as with normal typing.

Ad-hoc preview builds may trigger Keychain prompts after updates. Consistent Developer ID signing and migration between signed versions remain unverified. Encryption protects stored data; this is not a separately locked master-password vault or protection from a compromised Browser Nova process. Refer to [Electron safeStorage](https://www.electronjs.org/docs/latest/api/safe-storage).

## Copy cURL

Inspect → Network → select a request → **Copy cURL**. Copies a bash/zsh command containing URL, method, captured headers and request body; nothing is executed or sent. Single quotes and shell metacharacters are escaped. HTTP/2 pseudo-headers and host/content-length/connection/accept-encoding are omitted. Clipboard content may contain captured authorization or cookies and body secrets; treat it as sensitive.

Incomplete/truncated or multipart request payloads are rejected rather than generating a misleading replay. Captured headers can omit cookies/browser-added headers because Network extra-info events are not collected yet. Thus the command represents captured data, not a guarantee of identical browser replay. No file-upload reconstruction, PowerShell quoting or response body in cURL.

## Validation

- `npm test`: 71 tests, including store persistence/update/removal, mock-codec encrypted records, unavailable encryption, corrupt JSON protection, and cURL argv round-trip through a local bash function (no network request).
- `npm run test:logins`: 8 assertions in real Electron with loopback HTML: origin mismatch, form fill, no submit, new-password and ambiguous-form rejection.
- `npm run test:network`: 12 real Electron assertions for request/response capture.
- Actual Keychain round-trip and cross-version vault migration are not covered by the mock-codec tests. No real account credentials or production APIs used.
