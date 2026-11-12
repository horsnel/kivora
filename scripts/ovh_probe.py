#!/usr/bin/env python3
"""Live probe of OVHcloud AI Endpoints anonymous vision tier.
Builds a tiny real JPEG (solid color + text is not possible without fonts —
we just need a valid image the VL model can see), POSTs it with no auth
header, and prints the raw status/body so we know exactly what the
anonymous tier accepts before wiring it into the research route."""
import base64
import io
import json
import struct
import urllib.request
import zlib


def tiny_jpeg():
    # 64x64 solid red JPEG via PIL (available in this sandbox)
    from PIL import Image
    im = Image.new("RGB", (64, 64), (200, 30, 30))
    buf = io.BytesIO()
    im.save(buf, "JPEG", quality=70)
    return buf.getvalue()


jpg = tiny_jpeg()
b64 = base64.b64encode(jpg).decode()
data_url = f"data:image/jpeg;base64,{b64}"

body = json.dumps({
    "model": "Qwen2.5-VL-72B-Instruct",
    "messages": [{
        "role": "user",
        "content": [
            {"type": "text", "text": "What color is this image? One short sentence."},
            {"type": "image_url", "image_url": {"url": data_url}},
        ],
    }],
    "max_tokens": 100,
    "temperature": 0.2,
}).encode()

req = urllib.request.Request(
    "https://oai.endpoints.kepler.ai.cloud.ovh.net/v1/chat/completions",
    data=body,
    headers={"Content-Type": "application/json"},
    method="POST",
)
try:
    with urllib.request.urlopen(req, timeout=45) as r:
        print("STATUS", r.status)
        print("BODY", r.read().decode()[:600])
except urllib.error.HTTPError as e:
    print("HTTP ERROR", e.code)
    print("BODY", e.read().decode()[:600])
except Exception as e:
    print("ERR", type(e).__name__, str(e)[:200])
