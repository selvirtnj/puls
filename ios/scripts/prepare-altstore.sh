#!/bin/sh
set -eu
# Only the unsigned CI/device build needs this. Normal Xcode signing owns its own entitlements.
if [ "${CODE_SIGNING_ALLOWED:-YES}" != "NO" ] || [ "${PLATFORM_NAME:-}" != "iphoneos" ]; then
  exit 0
fi
app="${TARGET_BUILD_DIR}/${WRAPPER_NAME}"
for extension in "$app"/PlugIns/*.appex; do
  [ -d "$extension" ] || continue
  /usr/bin/codesign --force --sign - "$extension"
done
/usr/bin/codesign --force --sign - --entitlements "${SRCROOT}/PULS/PULS.entitlements" "$app"
# Fail the build if the capability was lost. No account/certificate or health data is printed.
/usr/bin/codesign -d --entitlements :- "$app" 2>/dev/null | /usr/bin/grep -q 'com.apple.developer.healthkit'
