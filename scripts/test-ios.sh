#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
if ! command -v xcodebuild >/dev/null; then
  echo 'Xcode 16+ on macOS is required to build and test FitCraft.' >&2
  exit 1
fi
mkdir -p build
if [[ -z "${FITCRAFT_SIMULATOR_ID:-}" ]]; then
  FITCRAFT_SIMULATOR_ID="$(xcrun simctl list devices available -j | python3 -c 'import json,sys; data=json.load(sys.stdin); devices=[d for runtime,items in data["devices"].items() if "iOS" in runtime for d in items if "iPhone" in d["name"]]; assert devices, "Install an iOS simulator runtime in Xcode Settings"; print(devices[0]["udid"])')"
fi
FITCRAFT_RUN_ID="$(date -u +%Y%m%dT%H%M%SZ)"
xcodebuild test \
  -project FitCraft.xcodeproj \
  -scheme FitCraft \
  -destination "platform=iOS Simulator,id=$FITCRAFT_SIMULATOR_ID" \
  -derivedDataPath build/DerivedData \
  -resultBundlePath "build/FitCraft-$FITCRAFT_RUN_ID.xcresult" \
  CODE_SIGNING_ALLOWED=NO
ditto -c -k --sequesterRsrc --keepParent \
  build/DerivedData/Build/Products/Debug-iphonesimulator/FitCraft.app \
  build/FitCraft-Simulator.zip
echo 'Tests finished. Simulator app: build/FitCraft-Simulator.zip'
echo 'This simulator build cannot be installed on a physical iPhone.'
