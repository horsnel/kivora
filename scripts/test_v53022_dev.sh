#!/bin/bash
# Dev functional test for v5.30.22: POST /api/research with an image while
# a mock OVH gateway is up; asserts the mock is hit AND the route log line
# appears — proving the pre-analysis runs inside the real route flow.
set -u
cd /home/z/my-project/kivora

# mock OVH gateway
node -e '
const http = require("http");
const srv = http.createServer((req, res) => {
  let b = "";
  req.on("data", c => b += c);
  req.on("end", () => {
    require("fs").writeFileSync("/tmp/ovh_mock_hit.json", JSON.stringify({ path: req.url, body: JSON.parse(b).model }));
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ choices: [{ message: { role: "assistant", content: "A red test square with no people." }, finish_reason: "stop" }] }));
  });
});
srv.listen(9992, () => console.log("mock up"));
' &
MOCK_PID=$!
sleep 1

cat >> .env.local <<'EOF'
OVH_VISION_BASE=http://localhost:9992
EOF

pkill -f "next[-]server" 2>/dev/null; pkill -f "next[ ]dev" 2>/dev/null
sleep 2
(npm run dev > /tmp/dev53022.log 2>&1 &)
# wait until the dev server actually accepts connections (cold compile varies)
for i in $(seq 1 30); do
  sleep 4
  if curl -s -o /dev/null --max-time 5 http://localhost:3000/; then
    echo "dev up after ~$((i*4))s"
    break
  fi
done

python3 - <<'EOF'
import base64, io, json, urllib.request
from PIL import Image
im = Image.new("RGB", (32, 32), (200, 30, 30))
buf = io.BytesIO(); im.save(buf, "PNG")
data_url = "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()
body = json.dumps({
    "query": "what is in this picture?",
    "mode": "quick",
    "attachedFile": {"name": "test.png", "type": "image/png", "size": len(buf.getvalue()), "content": data_url},
}).encode()
req = urllib.request.Request("http://localhost:3000/api/research", data=body,
                             headers={"Content-Type": "application/json"}, method="POST")
try:
    with urllib.request.urlopen(req, timeout=90) as r:
        print("ROUTE STATUS", r.status)
        print("ROUTE BODY", r.read().decode()[:200])
except urllib.error.HTTPError as e:
    print("ROUTE HTTP", e.code)
    print("ROUTE BODY", e.read().decode()[:300])
except Exception as e:
    print("ROUTE ERR", type(e).__name__, str(e)[:150])
EOF

sleep 1
echo "── mock hit ──"
cat /tmp/ovh_mock_hit.json 2>/dev/null || echo "NO MOCK HIT"
echo "── route log ──"
grep -nE "OVH vision brief used" /tmp/dev53022.log | head -2 || echo "NO ENRICHMENT LOG"

# cleanup: restore fail-open default (no OVH override), stop mock + dev
python3 - <<'EOF'
lines = [l for l in open(".env.local") if not l.startswith("OVH_VISION_BASE")]
open(".env.local", "w").writelines(lines)
print("env restored")
EOF
kill $MOCK_PID 2>/dev/null
pkill -f "next[-]server" 2>/dev/null; pkill -f "next[ ]dev" 2>/dev/null
echo "done"
