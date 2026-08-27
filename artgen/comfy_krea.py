"""Run one nonshipping Krea 2 preflight through a local ComfyUI server.

This bridge deliberately reads the canonical job catalogue instead of accepting
an ad-hoc prompt. It preserves the job's FNV-1a seed and writes PNG plus a
manifest only under artgen/preflight/, which is ignored and never packed.

Usage:
    python artgen/comfy_krea.py --key cut_human_intro_1 --width 1280 --height 720
"""

import argparse
import json
import os
import sys
import time
import urllib.parse
import urllib.request
import uuid
from pathlib import Path


HERE = Path(__file__).resolve().parent
PREFLIGHT_DIR = HERE / "preflight"
DEFAULT_SERVER = "http://127.0.0.1:8188"

# The installed scaled-FP8 checkpoint cannot run on PyTorch MPS because that
# backend has no Float8_e4m3fn tensor support. The Q5_1 Krea 2 GGUF is the
# compatible local default. Keep the native FP8 graph available for a future
# compatible CUDA or Metal backend without changing the catalogue contract.
MODEL_PROFILES = {
    "gguf-q5": {
        "loader": "UnetLoaderGGUF",
        "unet_name": "krea2_turbo_bf16-Q5_1.gguf",
        "description": "Krea 2 Turbo Q5_1 GGUF, local MPS-compatible default",
    },
    "fp8": {
        "loader": "UNETLoader",
        "unet_name": "krea2_turbo_fp8_scaled.safetensors",
        "weight_dtype": "default",
        "description": "Krea 2 Turbo scaled FP8, requires a Float8-capable backend",
    },
}

sys.path.insert(0, str(HERE))
from krea_jobs import build_jobs  # noqa: E402


def fnv1a_seed(key):
    """Return the catalogue's stable FNV-1a seed for a key."""
    value = 2166136261
    for char in key:
        value = ((value ^ ord(char)) * 16777619) & 0xFFFFFFFF
    return value % (2 ** 31)


def job_for(key):
    for job_key, prompt, gen_px, out_px, aspect in build_jobs():
        if job_key == key:
            if prompt is None:
                raise ValueError(f"{key} is a derived asset and has no generation prompt")
            return {
                "key": job_key,
                "prompt": prompt,
                "catalogue_gen_px": gen_px,
                "catalogue_out_px": out_px,
                "aspect": aspect,
            }
    raise ValueError(f"unknown catalogue key: {key}")


def workflow(prompt, seed, width, height, filename_prefix, model_profile):
    """Build the native Krea 2 Turbo graph supplied by this ComfyUI install."""
    profile = MODEL_PROFILES[model_profile]
    unet_inputs = {"unet_name": profile["unet_name"]}
    if "weight_dtype" in profile:
        unet_inputs["weight_dtype"] = profile["weight_dtype"]
    return {
        "1": {
            "class_type": profile["loader"],
            "inputs": unet_inputs,
        },
        "2": {
            "class_type": "CLIPLoader",
            "inputs": {
                "clip_name": "qwen3vl_4b_fp8_scaled.safetensors",
                "type": "krea2",
                "device": "default",
            },
        },
        "3": {
            "class_type": "VAELoader",
            "inputs": {"vae_name": "qwen_image_vae.safetensors"},
        },
        "4": {
            "class_type": "CLIPTextEncode",
            "inputs": {"text": prompt, "clip": ["2", 0]},
        },
        "5": {
            "class_type": "EmptyLatentImage",
            "inputs": {"width": width, "height": height, "batch_size": 1},
        },
        "6": {
            "class_type": "ConditioningZeroOut",
            "inputs": {"conditioning": ["4", 0]},
        },
        "7": {
            "class_type": "KSampler",
            "inputs": {
                "model": ["1", 0],
                "seed": seed,
                "steps": 8,
                "cfg": 1.0,
                "sampler_name": "euler",
                "scheduler": "simple",
                "positive": ["4", 0],
                "negative": ["6", 0],
                "latent_image": ["5", 0],
                "denoise": 1.0,
            },
        },
        "8": {
            "class_type": "VAEDecode",
            "inputs": {"samples": ["7", 0], "vae": ["3", 0]},
        },
        "9": {
            "class_type": "SaveImage",
            "inputs": {"filename_prefix": filename_prefix, "images": ["8", 0]},
        },
    }


def request_json(url, data=None, timeout=30):
    headers = {"Content-Type": "application/json"} if data is not None else {}
    request = urllib.request.Request(url, data=data, headers=headers)
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"ComfyUI returned HTTP {error.code}: {detail}") from error
    except urllib.error.URLError as error:
        raise RuntimeError(f"cannot reach ComfyUI at {url}: {error.reason}") from error


def write_atomic(path, contents):
    temp = path.with_name(f".{path.name}.{uuid.uuid4().hex}.tmp")
    try:
        temp.write_bytes(contents)
        os.replace(temp, path)
    finally:
        if temp.exists():
            temp.unlink()


def image_bytes(server, image):
    query = urllib.parse.urlencode({
        "filename": image["filename"],
        "subfolder": image.get("subfolder", ""),
        "type": image.get("type", "output"),
    })
    url = f"{server}/view?{query}"
    try:
        with urllib.request.urlopen(url, timeout=60) as response:
            return response.read()
    except urllib.error.URLError as error:
        raise RuntimeError(f"could not download the completed ComfyUI image: {error.reason}") from error


def run(args):
    if args.width % 8 or args.height % 8:
        raise ValueError("width and height must both be divisible by 8")
    if args.width < 16 or args.height < 16:
        raise ValueError("width and height must both be at least 16")

    server = args.server.rstrip("/")
    job = job_for(args.key)
    if job["aspect"] == "wide" and args.width * 9 != args.height * 16:
        raise ValueError(f"{args.key} is a wide asset and requires a 16:9 preflight size")

    seed = fnv1a_seed(job["key"])
    run_id = f"{job['key']}_{seed}_{args.width}x{args.height}_{time.strftime('%Y%m%dT%H%M%SZ', time.gmtime())}"
    filename_prefix = f"cosmic_preflight/{run_id}"
    graph = workflow(job["prompt"], seed, args.width, args.height, filename_prefix, args.model_profile)

    payload = json.dumps({
        "prompt": graph,
        "client_id": "cosmic-conquest-nonshipping-preflight",
    }).encode("utf-8")
    started = time.monotonic()
    queued = request_json(f"{server}/prompt", payload)
    if "prompt_id" not in queued:
        raise RuntimeError(f"ComfyUI did not accept the workflow: {queued}")
    prompt_id = queued["prompt_id"]
    print(f"queued {job['key']} with catalogue seed {seed} on {args.model_profile}: {prompt_id}", flush=True)

    deadline = started + args.timeout
    record = None
    while time.monotonic() < deadline:
        history = request_json(f"{server}/history/{prompt_id}")
        record = history.get(prompt_id)
        if record:
            status = record.get("status", {})
            if status.get("status_str") == "error":
                raise RuntimeError(f"ComfyUI generation failed: {status.get('messages', status)}")
            images = record.get("outputs", {}).get("9", {}).get("images", [])
            if images:
                break
        time.sleep(2)
    else:
        raise TimeoutError(f"ComfyUI did not complete within {args.timeout} seconds")

    image = images[0]
    image_path = PREFLIGHT_DIR / f"{run_id}.png"
    manifest_path = PREFLIGHT_DIR / f"{run_id}.json"
    PREFLIGHT_DIR.mkdir(parents=True, exist_ok=True)
    write_atomic(image_path, image_bytes(server, image))
    elapsed_seconds = round(time.monotonic() - started, 2)
    manifest = {
        "shipping_status": "nonshipping",
        "promotion": "forbidden",
        "purpose": "local ComfyUI Krea 2 brand preflight only",
        "run_id": run_id,
        "comfy_prompt_id": prompt_id,
        "server": server,
        "model_profile": {"name": args.model_profile, **MODEL_PROFILES[args.model_profile]},
        "catalogue": job,
        "seed": seed,
        "preflight_size": {"width": args.width, "height": args.height},
        "sampler": {"steps": 8, "cfg": 1.0, "sampler": "euler", "scheduler": "simple"},
        "elapsed_seconds": elapsed_seconds,
        "comfy_output": image,
        "local_image": image_path.name,
    }
    write_atomic(manifest_path, json.dumps(manifest, indent=2, sort_keys=True).encode("utf-8") + b"\n")
    print(f"completed in {elapsed_seconds}s", flush=True)
    print(f"review PNG: {image_path}", flush=True)
    print(f"review manifest: {manifest_path}", flush=True)


def main():
    parser = argparse.ArgumentParser(description="Run one nonshipping local Krea 2 ComfyUI preflight")
    parser.add_argument("--key", required=True, help="exact key from artgen/krea_jobs.py")
    parser.add_argument("--width", type=int, default=1280, help="preflight width, default: 1280")
    parser.add_argument("--height", type=int, default=720, help="preflight height, default: 720")
    parser.add_argument("--server", default=DEFAULT_SERVER, help=f"ComfyUI server, default: {DEFAULT_SERVER}")
    parser.add_argument(
        "--model-profile",
        choices=sorted(MODEL_PROFILES),
        default="gguf-q5",
        help="local Krea model loader, default: gguf-q5",
    )
    parser.add_argument("--timeout", type=int, default=1800, help="maximum wait in seconds, default: 1800")
    args = parser.parse_args()
    if args.timeout <= 0:
        parser.error("timeout must be positive")
    try:
        run(args)
    except (RuntimeError, TimeoutError, ValueError) as error:
        print(f"preflight failed: {error}", file=sys.stderr)
        raise SystemExit(1)


if __name__ == "__main__":
    main()
