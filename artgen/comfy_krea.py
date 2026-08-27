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

# Study prompts remain intentionally bounded. The bridge never takes arbitrary
# prompt text: a review run must be reproducible and its added art direction
# must be explicit in the manifest.
STUDY_PROFILES = {
    "catalogue": {
        "seed_suffix": "",
        "description": "unaltered canonical catalogue prompt",
        "style_suffix": "",
    },
    "oil-water-abstract": {
        "seed_suffix": "#oil-water-abstract-v1",
        "description": "nonshipping oil-and-water modernist commander study",
        "style_suffix": (
            "Oil-and-water paint illustrative design: opaque oil-paint planes under "
            "translucent watercolour washes, visible bristle marks, wet blooms and dry brush. "
            "Modernist fractured colour relationships and slightly abstracted planes, but a familiar "
            "readable face and silhouette. Artistic, expressive and tactile, never photorealistic, "
            "never glossy 3D, never a realistic portrait."
        ),
    },
    "shipping-locked": {
        "seed_suffix": "#shipping-locked-v1",
        "description": "nonshipping study locked to the established commander catalogue look",
        "style_suffix": (
            "Preserve the established Cosmic Conquest shipping portrait look: flat interlocking colour shapes, "
            "heavy black shadow masses, hard cel edges, bold ink line, matte screen-print texture and a strong "
            "readable silhouette. Keep the illustration graphic and familiar, never photorealistic, never glossy 3D."
        ),
    },
}

# The fresh faction selector exposes these four commanders. Cues come from the
# lore commander bible and art-direction brief. They stay outside krea_jobs.py
# because this is a review study, not a change to the shipping catalogue.
COMMANDER_STUDY_CUES = {
    "cmd_vanta": (
        "Lore fidelity: Director Reyes of the Open Archive Combat Index wears an archive coat with "
        "transparent provenance panes, timestamp marks and a portable evidence lattice. She is disciplined "
        "archival intelligence, not a paranoid detective."
    ),
    "cmd_seraph": (
        "Lore fidelity: Seraph coordinates a mixed-species defense through consent-limited treaty infrastructure. "
        "Many distinct consent seals orbit as a radiant field harness without merging into one identity. "
        "Do not use biological angel wings, church ornament or faceless saint imagery."
    ),
    "cmd_sevra": (
        "Lore fidelity: Sevra is a clinical continuity notary with estate seals, echo capsules and death-contract "
        "ledgers. Her horror is administrative, not undead sorcery."
    ),
    "cmd_rake": (
        "Lore fidelity: Rake's route charts are stitched into his coat and hull plates beside quarantine tags. "
        "The interstellar route network is his regalia. He is dry and confident, never a cartoon pirate."
    ),
}

# The canonical portrait catalogue predates the lore's more precise political
# art briefs. These narrow replacements prevent old shorthand from overruling
# a study's current canon. A changed study subject gets its own seed suffix.
COMMANDER_STUDY_REVISIONS = {
    "cmd_sevra": {
        "seed_suffix": "#clinical-records-v2",
        "replacements": (
            (
                "a necrotic commander trailing reanimated husks on dark filaments, puppeteer gestures, hollow glowing eyes, a lipless smile",
                "a clinical continuity notary holding a sealed echo capsule, calm unreadable expression, orderly record-keeper posture, no exposed skull",
            ),
            (
                "deep violet biomechanical carapace fused with neon-lit implants, too many joints, unsettling asymmetry, bioluminescent veins",
                "structured deep violet notary coat with a clean biomechanical collar, cyan identity lights, estate seals and orderly data tabs, restrained asymmetry",
            ),
            (
                "painted in violet and magenta with iridescent chitin",
                "painted in violet, magenta and cyan with matte polymer, paper seals and luminous record marks",
            ),
        ),
    },
    "cmd_seraph": {
        "seed_suffix": "#treaty-infrastructure-v2",
        "replacements": (
            (
                "a radiant pleiadian commander haloed in golden light, six wings of hard light, serene and terrible",
                "a Federation field harmonist coordinating mixed-species defenders through distinct orbiting consent seals and transparent treaty-interface geometry, calm, protective and visibly individual",
            ),
            (
                "golden holographic armour of hard-light panels, luminous circuitry halos, serene ceremonial bearing, glowing seams",
                "golden emergency field harness with transparent boundary projectors, separate consent seals and visible identity markers, practical protective bearing",
            ),
        ),
    },
    "cmd_rake": {
        "seed_suffix": "#void-field-v2",
        "prefix": (
            "Head-and-shoulders commander portrait isolated on a solid void-black field. "
            "The entire background is pure unlit black, with no white paper, canvas, studio backdrop or scenery"
        ),
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


def study_prompt(job, study_name):
    """Return a reproducible review prompt without changing the catalogue."""
    study = dict(STUDY_PROFILES[study_name])
    if study_name == "catalogue":
        return job["prompt"], study
    cue = COMMANDER_STUDY_CUES.get(job["key"])
    if not cue:
        raise ValueError(
            f"{study_name} is presently defined only for the four initial faction commanders"
        )
    prompt = job["prompt"]
    revision = COMMANDER_STUDY_REVISIONS.get(job["key"])
    if revision:
        if revision.get("prefix"):
            prompt = revision["prefix"] + ". " + prompt
        for old, new in revision.get("replacements", ()):
            if old not in prompt:
                raise ValueError(f"study replacement no longer matches {job['key']} catalogue prompt")
            prompt = prompt.replace(old, new)
        study["seed_suffix"] += revision["seed_suffix"]
        study["prompt_revision"] = revision["seed_suffix"].lstrip("#")
    return f"{prompt}. {cue} {study['style_suffix']}", study


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

    prompt, study = study_prompt(job, args.study)
    seed_key = job["key"] + study["seed_suffix"]
    seed = fnv1a_seed(seed_key)
    study_slug = args.study.replace("-", "_")
    run_id = f"{job['key']}_{study_slug}_{seed}_{args.width}x{args.height}_{time.strftime('%Y%m%dT%H%M%SZ', time.gmtime())}"
    filename_prefix = f"cosmic_preflight/{run_id}"
    graph = workflow(prompt, seed, args.width, args.height, filename_prefix, args.model_profile)

    payload = json.dumps({
        "prompt": graph,
        "client_id": "cosmic-conquest-nonshipping-preflight",
    }).encode("utf-8")
    started = time.monotonic()
    queued = request_json(f"{server}/prompt", payload)
    if "prompt_id" not in queued:
        raise RuntimeError(f"ComfyUI did not accept the workflow: {queued}")
    prompt_id = queued["prompt_id"]
    print(f"queued {job['key']} with study seed {seed} on {args.model_profile}: {prompt_id}", flush=True)

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
        "study": {"name": args.study, **study},
        "effective_prompt": prompt,
        "seed_key": seed_key,
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
    parser.add_argument(
        "--study",
        choices=sorted(STUDY_PROFILES),
        default="catalogue",
        help="bounded nonshipping art-direction study, default: catalogue",
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
