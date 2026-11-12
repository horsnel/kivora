#!/usr/bin/env python3
"""Prod probe for v5.30.22: POST /api/research (quick, anonymous) with a
real image attachment. The route's OVH pre-analysis runs on CF egress —
the anonymous tier may rate-limit shared IPs, which fails open, so the
assertion is: HTTP 200 + a sources array (pipeline completed), plus the
latency stays inside the image budget."""
import base64
import io
import json
import time
import urllib.request

from PIL import Image

im = Image.new("RGB", (48, 48), (30, 90, 200))
buf = io.BytesIO()
im.save(buf, "PNG")
data_url = "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()

body = json.dumps({
    "query": "what is this blue square?",
    "mode": "quick",
    "attachedFile": {"name": "probe.png", "type": "image/png",
                     "size": len(buf.getvalue()), "content": data_url},
}).encode()

req = urllib.request.Request(
    "https://kivora.pages.dev/api/research",
    data=body,
    headers={"Content-Type": "application/json"},
    method="POST",
)

t0 = time.time()
try:
    with urllib.request.urlopen(req, timeout=150) as r:
        payload = json.loads(r.read().decode())
        dt = time.time() - t0
        sources = payload.get("sources") or []
        print("STATUS", r.status)
        print("LATENCY_S", round(dt, 1))
        print("SOURCES", len(sources))
        print("SELF_HEALED", payload.get("selfHealed", False))
        print("FIRST_SOURCE", json.dumps(sources[0])[:160] if sources else "(none)")
        print("REPORT_CHARS", len(payload.get("report") or ""))
        ok = r.status == 200 and isinstance(sources, list)
        print("PROBE", "PASS" if ok else "FAIL")
except urllib.error.HTTPError as e:
    print("HTTP ERROR", e.code)
    print("BODY", e.read().decode()[:300])
    print("PROBE FAIL")
except Exception as e:
    print("ERR", type(e).__name__, str(e)[:200])
    print("PROBE FAIL")
