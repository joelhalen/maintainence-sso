#!/usr/bin/env bash
# Install OpenJDK 17 and Android SDK command-line tools on Debian/Ubuntu.
# Run once on the build server: sudo ./scripts/install-android-sdk.sh
set -euo pipefail

ANDROID_SDK_ROOT="${ANDROID_SDK_ROOT:-/opt/android-sdk}"
CMDLINE_TOOLS_ZIP="commandlinetools-linux-11076708_latest.zip"
CMDLINE_TOOLS_URL="https://dl.google.com/android/repository/${CMDLINE_TOOLS_ZIP}"

echo "==> Installing system packages (OpenJDK 17, wget, unzip)..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq openjdk-17-jdk-headless wget unzip

echo "==> Creating Android SDK at ${ANDROID_SDK_ROOT}..."
install -d -m 0755 "${ANDROID_SDK_ROOT}/cmdline-tools"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

if [[ ! -x "${ANDROID_SDK_ROOT}/cmdline-tools/latest/bin/sdkmanager" ]]; then
  echo "==> Downloading Android command-line tools..."
  wget -q -O "${TMP}/${CMDLINE_TOOLS_ZIP}" "${CMDLINE_TOOLS_URL}"
  unzip -q "${TMP}/${CMDLINE_TOOLS_ZIP}" -d "${TMP}/cmdline-tools-extract"
  rm -rf "${ANDROID_SDK_ROOT}/cmdline-tools/latest"
  mv "${TMP}/cmdline-tools-extract/cmdline-tools" "${ANDROID_SDK_ROOT}/cmdline-tools/latest"
fi

export ANDROID_SDK_ROOT
export ANDROID_HOME="${ANDROID_SDK_ROOT}"
export PATH="${ANDROID_SDK_ROOT}/cmdline-tools/latest/bin:${ANDROID_SDK_ROOT}/platform-tools:${PATH}"

echo "==> Accepting SDK licenses and installing packages..."
yes | sdkmanager --sdk_root="${ANDROID_SDK_ROOT}" --licenses >/dev/null || true
sdkmanager --sdk_root="${ANDROID_SDK_ROOT}" \
  "platform-tools" \
  "platforms;android-34" \
  "build-tools;34.0.0"

PROFILE_SNIPPET='/etc/profile.d/android-sdk.sh'
cat > "${PROFILE_SNIPPET}" <<EOF
export ANDROID_SDK_ROOT="${ANDROID_SDK_ROOT}"
export ANDROID_HOME="\${ANDROID_SDK_ROOT}"
export PATH="\${ANDROID_SDK_ROOT}/cmdline-tools/latest/bin:\${ANDROID_SDK_ROOT}/platform-tools:\${PATH}"
EOF
chmod 644 "${PROFILE_SNIPPET}"

echo ""
echo "Android SDK installed successfully."
echo "  ANDROID_SDK_ROOT=${ANDROID_SDK_ROOT}"
echo "  Java: $(java -version 2>&1 | head -1)"
echo ""
echo "Log out/in or run: source ${PROFILE_SNIPPET}"
echo "Then build an APK: ./scripts/build-android-apk.sh"
