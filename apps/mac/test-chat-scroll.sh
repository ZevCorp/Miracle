#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
./build.sh release
result="$(mktemp -t yu-chat-scroll).json"
.artifacts/U.app/Contents/MacOS/U --chat-scroll-test "$result"
python3 - "$result" <<'PY'
import json, sys
from pathlib import Path
report = Path(sys.argv[1])
data = json.loads(report.read_text())
print(json.dumps(data, ensure_ascii=False, indent=2))
print("Evidence:", report)
sys.exit(0 if data["passed"] else 1)
PY
