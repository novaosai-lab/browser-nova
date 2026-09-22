#!/bin/bash
# Run explicitly in Terminal after installing Browser Nova in /Applications.
set -euo pipefail
app_path='/Applications/Browser Nova.app'
fail() { printf '\n%s\n' "$1" >&2; exit 1; }
[[ "$(/usr/bin/uname -s)" == Darwin ]] || fail 'This helper requires macOS.'
[[ -d "$app_path" && ! -L "$app_path" ]] || fail 'Install Browser Nova.app in /Applications first.'
identifier=$(/usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "$app_path/Contents/Info.plist")
[[ "$identifier" == 'ai.novaos.browser-nova' ]] || fail 'Unexpected application identifier; nothing changed.'
/usr/bin/codesign --verify --deep --strict "$app_path" || fail 'App integrity check failed. Download a fresh copy; nothing changed.'
printf '%s\n' 'Browser Nova preview is not notarized by Apple.'
printf '%s\n' 'This removes the download quarantine flag ONLY from /Applications/Browser Nova.app and opens it.'
printf '%s\n' 'It does not disable Gatekeeper globally or add an Apple certificate.'
printf '%s\n' 'The ad-hoc signature checks integrity, not publisher identity. Continue only if you trust your download.'
printf 'Type OPEN to continue, or press Return to cancel: '
IFS= read -r answer || exit 0
[[ "$answer" == OPEN ]] || { printf 'Cancelled; nothing changed.\n'; exit 0; }
/usr/bin/xattr -dr com.apple.quarantine "$app_path" || fail 'Could not remove quarantine. Check file ownership or contact your Mac administrator. No sudo is used.'
/usr/bin/open "$app_path"
printf '\nBrowser Nova launched. This helper is normally needed only once per downloaded version.\n'
