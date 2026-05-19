#!/usr/bin/env bash
# Build a debug MegaMTX Android APK (bundled web assets + native Capacitor shell).
#
# Usage:
#   ./scripts/build-android-apk.sh
#   VITE_API_URL=https://your-domain.example/api ./scripts/build-android-apk.sh
#
# Output:
#   releases/megamtx-latest.apk  (served at https://megamtx.joelhalen.net/download_apk)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FRONTEND="${ROOT}/frontend"
RELEASES="${ROOT}/releases"
APK_PUBLISH="${RELEASES}/megamtx-latest.apk"
ANDROID_SDK_ROOT="${ANDROID_SDK_ROOT:-/opt/android-sdk}"

# Default API URL for production mobile builds
VITE_API_URL="${VITE_API_URL:-https://megamtx.joelhalen.net/api}"
export VITE_API_URL
export VITE_CAPACITOR_BUILD=true
export CAPACITOR_BUILD=true
export ANDROID_SDK_ROOT
export ANDROID_HOME="${ANDROID_SDK_ROOT}"
export PATH="${ANDROID_SDK_ROOT}/cmdline-tools/latest/bin:${ANDROID_SDK_ROOT}/platform-tools:${PATH}"
export JAVA_HOME="${JAVA_HOME:-$(dirname "$(dirname "$(readlink -f "$(command -v java)")")")}"

log() { echo "[build-android] $*"; }

if ! command -v java >/dev/null 2>&1; then
  echo "ERROR: Java not found. Run: sudo ./scripts/install-android-sdk.sh" >&2
  exit 1
fi

if [[ ! -x "${ANDROID_SDK_ROOT}/cmdline-tools/latest/bin/sdkmanager" ]]; then
  echo "ERROR: Android SDK not found at ${ANDROID_SDK_ROOT}. Run: sudo ./scripts/install-android-sdk.sh" >&2
  exit 1
fi

install -d -m 0755 "${RELEASES}"

log "Installing frontend dependencies..."
cd "${FRONTEND}"
if [[ -f package-lock.json ]]; then
  npm ci
else
  npm install
fi

log "Building web bundle for Capacitor (API: ${VITE_API_URL})..."
npm run build:capacitor

if [[ ! -f android/gradlew ]]; then
  log "Initializing Android platform (first-time or repair)..."
  rm -rf android
  npx cap add android
fi

log "Syncing web assets into Android project..."
npx cap sync android

GRADLE_FILE="${FRONTEND}/android/app/build.gradle"
VERSION_NAME="${BUILD_VERSION_NAME:-$(node -p "require('${FRONTEND}/package.json').version")}"
OLD_CODE="$(grep -E 'versionCode [0-9]+' "${GRADLE_FILE}" | awk '{print $2}')"
if [[ -n "${BUILD_VERSION_CODE:-}" ]]; then
  NEW_CODE="${BUILD_VERSION_CODE}"
else
  NEW_CODE=$((OLD_CODE + 1))
fi
MIN_VERSION_CODE="${APP_MIN_VERSION_CODE:-1}"
APK_PUBLIC_URL="${APP_APK_URL:-https://megamtx.joelhalen.net/download_apk}"

sed -i "s/versionCode ${OLD_CODE}/versionCode ${NEW_CODE}/" "${GRADLE_FILE}"
sed -i "s/versionName \"[^\"]*\"/versionName \"${VERSION_NAME}\"/" "${GRADLE_FILE}"
log "Android version: ${VERSION_NAME} (code ${OLD_CODE} → ${NEW_CODE}, min required code ${MIN_VERSION_CODE})"

log "Compiling debug APK (Gradle)..."
cd android
chmod +x gradlew
./gradlew assembleDebug --no-daemon

GRADLE_APK="app/build/outputs/apk/debug/app-debug.apk"
if [[ ! -f "${GRADLE_APK}" ]]; then
  echo "ERROR: Gradle did not produce ${GRADLE_APK}" >&2
  exit 1
fi

cp -f "${GRADLE_APK}" "${APK_PUBLISH}"
chmod 0644 "${APK_PUBLISH}"

BUILD_TIME="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
SHA256="$(sha256sum "${APK_PUBLISH}" | awk '{print $1}')"

cat > "${RELEASES}/build-info.json" <<EOF
{
  "versionName": "${VERSION_NAME}",
  "versionCode": ${NEW_CODE},
  "minVersionCode": ${MIN_VERSION_CODE},
  "apkUrl": "${APK_PUBLIC_URL}",
  "playStoreUrl": null,
  "appStoreUrl": null,
  "builtAt": "${BUILD_TIME}",
  "apiUrl": "${VITE_API_URL}",
  "apkFile": "megamtx-latest.apk",
  "sha256": "${SHA256}",
  "bytes": $(stat -c%s "${APK_PUBLISH}")
}
EOF

log "Done."
log "  APK: ${APK_PUBLISH}"
log "  SHA256: ${SHA256}"
log "  Download: https://megamtx.joelhalen.net/download_apk"
log "  Size: $(du -h "${APK_PUBLISH}" | cut -f1)"
