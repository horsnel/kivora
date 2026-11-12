# ══════════════════════════════════════════════════════════════════
# Kivora inference gateway on Lightning AI (LitServe)
# ══════════════════════════════════════════════════════════════════
# One OpenAI-compatible endpoint that serves EVERY text/vision model the
# platform calls, dispatched by the request's "model" field. The app's
# provider chain (lib/groq.js, lib/mistral.js) hits this first whenever
# LIGHTNING_BASE_URL is configured.
#
#   Run in a Lightning Studio (GPU attached):
#     pip install -r requirements.txt
#     python service.py                    # serves :8000
#
#   Then set in Cloudflare Pages (Production env):
#     LIGHTNING_BASE_URL=https://<your-studio-domain>   # bare origin, no /v1
#     LIGHTNING_API_KEY=<value of API_KEY below>
#
# Models served here (canonical IDs — the app sends these verbatim):
#   openai/gpt-oss-120b              chat (Nova 3)      — ~63GB MXFP4 → 1×H100-80GB or A100-80GB
#   openai/gpt-oss-20b               chat fast (Nova 1.9) — ~12GB MXFP4 → 1×L4-24GB
#   qwen/qwen3.8-27b                 vision (Nova Vision) — bf16 ~54GB → 1×A100-80GB (or AWQ on 48GB)
#   deepseek-r1-distill-llama-70b    Pro reasoning      — 2×A100-80GB bf16 / 1×H100-80GB FP8
#   mistral-small-latest             devtools/study/reelpen/explore — 1×A100-40GB
#
# FLUX.1-schnell + Whisper large-v3: see voice_service.py (audio) and
# deploy.md §image for the image endpoint — they are separate processes.

import os
import litserve as ls

# Shared API key for the gateway (set the same value as LIGHTNING_API_KEY
# in Cloudflare Pages). Empty string = open endpoint (Studio is public).
API_KEY = os.environ.get("KIVORA_GATEWAY_API_KEY", "")

# model_id → vLLM config. Each engine is lazy-loaded on first request so a
# small Studio can serve the fast tier while the big model spins up on
# demand (or you comment out rows you don't host on this instance).
MODEL_REGISTRY = {
    "openai/gpt-oss-120b": dict(model="openai/gpt-oss-120b", max_len=131072),
    "openai/gpt-oss-20b": dict(model="openai/gpt-oss-20b", max_len=131072),
    "qwen/qwen3.8-27b": dict(model="qwen/qwen3.8-27b", max_len=131072),  # multimodal
    "deepseek-r1-distill-llama-70b": dict(model="deepseek-ai/DeepSeek-R1-Distill-Llama-70B", max_len=131072),
    "mistral-small-latest": dict(model="mistralai/Mistral-Small-3.2-24B-Instruct-2506", max_len=32768),
}


def _check_auth(request):
    if not API_KEY:
        return None
    auth = request.headers.get("authorization", "")
    if auth != f"Bearer {API_KEY}":
        return {"error": {"message": "Invalid API key", "type": "invalid_request_error"}}
    return None


class KivoraGateway(ls.LitAPI):
    """OpenAI-compatible multi-model gateway. The engine for each canonical
    model ID is created lazily on first use and cached for the worker's life."""

    def setup(self, device):
        self.device = device
        self._engines = {}

    def _engine(self, model_id):
        if model_id in self._engines:
            return self._engines[model_id]
        cfg = MODEL_REGISTRY.get(model_id)
        if cfg is None:
            raise KeyError(f"model {model_id} not hosted on this gateway")
        from vllm import LLM  # heavy import kept lazy
        engine = LLM(
            model=cfg["model"],
            max_model_len=cfg["max_len"],
            # vision models need their multimodal handler enabled
            enable_multimodal=("qwen" in model_id.lower()),
            gpu_memory_utilization=0.90,
        )
        self._engines[model_id] = engine
        return engine

    def decode_request(self, request):
        """OpenAISpec hands us the raw OpenAI body: {model, messages, ...}"""
        model = request.get("model") or "openai/gpt-oss-20b"
        if model not in MODEL_REGISTRY:
            raise ValueError(f"Unknown model: {model}. Hosted: {sorted(MODEL_REGISTRY)}")
        return {
            "model": model,
            "messages": request.get("messages", []),
            "temperature": request.get("temperature", 0.7),
            "max_tokens": request.get("max_tokens", 4096),
            "tools": request.get("tools"),
            "stream": bool(request.get("stream", False)),
        }

    def predict(self, payload):
        engine = self._engine(payload["model"])
        # vLLM exposes an OpenAI-compatible chat surface; streaming yields
        # delta chunks that LitServe's OpenAISpec relays as SSE.
        from vllm import SamplingParams
        sampling = SamplingParams(
            temperature=payload["temperature"],
            max_tokens=payload["max_tokens"],
        )
        results = engine.chat(payload["messages"], sampling, use_tqdm=False)
        return results[0]

    def encode_response(self, output):
        text = output.outputs[0].text
        usage = {"prompt_tokens": len(output.prompt_token_ids),
                 "completion_tokens": len(output.outputs[0].token_ids),
                 "total_tokens": len(output.prompt_token_ids) + len(output.outputs[0].token_ids)}
        return {"choices": [{"message": {"role": "assistant", "content": text}, "finish_reason": "stop"}],
                "usage": usage}


if __name__ == "__main__":
    api = KivoraGateway()
    server = ls.LitServer(
        api,
        accelerator="auto",
        spec=ls.OpenAISpec(api_route="/v1/chat/completions"),
        max_batch_size=1,        # one GPU slot per request — vLLM batches internally
        timeout=300,             # long budget for the 120B on cold start
    )
    server.run(port=os.environ.get("PORT", 8000))
