"""Animate one cutscene plate with Wan 2.2 TI2V-5B, through a local ComfyUI.

Tier 3 of the video ladder (aegis-gamedev references/media-video.md). This is
NOT for gameplay footage: Tier 1 capture already does that deterministically
and better. It exists for the one thing capture cannot do, which is give a
painted still some motion.

Why ComfyUI and not the official Wan repo: the official requirements pin
flash_attn, which has no Windows wheel, and the reference says a failed import
there is the smoke test failing rather than an invitation to compile it.
ComfyUI 0.27.0 carries Wan 2.2 natively (comfy/ldm/wan/vae2_2.py,
comfy_extras/nodes_wan.py) and needs no flash_attn at all.

    python plate_to_video.py <plate.webp> "<prompt>" [--length 49] [--steps 20]
"""
import argparse, json, os, shutil, subprocess, sys, time, urllib.request, uuid

COMFY = os.environ.get('COMFY_URL', 'http://127.0.0.1:8188')
COMFY_ROOT = os.environ.get('COMFY_ROOT', r'C:\Users\Majied\ComfyUI')
HERE = os.path.dirname(os.path.abspath(__file__))

UNET = 'wan2.2_ti2v_5B_fp16.safetensors'
CLIP = 'umt5_xxl_fp8_e4m3fn_scaled.safetensors'
VAE = 'wan2.2_vae.safetensors'

# Wan 2.2 TI2V-5B is trained at 1280x704. The plates are 1920x1080, so the node
# cover-scales down to it. Staying at the trained size is the same in-band law
# that governs the image tier (media-image section 13).
W, H = 1280, 704

# Wan's own published negative prompt. Unlike the Krea image path, guidance
# here is NOT zero, so this one is actually load bearing rather than
# documentation. "still" and "motionless frame" are the two that matter most:
# the failure mode of image-to-video is a video that never moves.
NEG = ('bright colours, overexposed, static, blurred detail, subtitles, style, '
       'artwork, painting, picture, still, overall greyness, worst quality, '
       'low quality, JPEG artifacts, ugly, deformed, extra fingers, '
       'poorly drawn hands, poorly drawn face, malformed, disfigured, '
       'fused fingers, motionless frame, cluttered background, three legs, '
       'many people in the background, walking backwards')


def post(path, payload):
    req = urllib.request.Request(COMFY + path,
                                 data=json.dumps(payload).encode(),
                                 headers={'Content-Type': 'application/json'})
    return json.loads(urllib.request.urlopen(req).read())


def get(path):
    return json.loads(urllib.request.urlopen(COMFY + path).read())


def build(image_name, prompt, length, steps, seed, cfg, shift):
    return {
        '1': {'class_type': 'UNETLoader',
              'inputs': {'unet_name': UNET, 'weight_dtype': 'default'}},
        '2': {'class_type': 'CLIPLoader',
              'inputs': {'clip_name': CLIP, 'type': 'wan'}},
        '3': {'class_type': 'VAELoader', 'inputs': {'vae_name': VAE}},
        '4': {'class_type': 'LoadImage', 'inputs': {'image': image_name}},
        '5': {'class_type': 'CLIPTextEncode',
              'inputs': {'text': prompt, 'clip': ['2', 0]}},
        '6': {'class_type': 'CLIPTextEncode',
              'inputs': {'text': NEG, 'clip': ['2', 0]}},
        '7': {'class_type': 'Wan22ImageToVideoLatent',
              'inputs': {'vae': ['3', 0], 'width': W, 'height': H,
                         'length': length, 'batch_size': 1,
                         'start_image': ['4', 0]}},
        '8': {'class_type': 'ModelSamplingSD3',
              'inputs': {'model': ['1', 0], 'shift': shift}},
        '9': {'class_type': 'KSampler',
              'inputs': {'model': ['8', 0], 'positive': ['5', 0],
                         'negative': ['6', 0], 'latent_image': ['7', 0],
                         'seed': seed, 'steps': steps, 'cfg': cfg,
                         'sampler_name': 'uni_pc', 'scheduler': 'simple',
                         'denoise': 1.0}},
        '10': {'class_type': 'VAEDecode',
               'inputs': {'samples': ['9', 0], 'vae': ['3', 0]}},
        '11': {'class_type': 'SaveImage',
               'inputs': {'images': ['10', 0], 'filename_prefix': 'plateanim'}},
    }


def fnv(s):
    h = 2166136261
    for ch in s:
        h = ((h ^ ord(ch)) * 16777619) & 0xffffffff
    return h % (2 ** 31)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('plate')
    ap.add_argument('prompt')
    ap.add_argument('--length', type=int, default=49)   # 49 frames at 24fps, ~2s
    ap.add_argument('--steps', type=int, default=20)
    ap.add_argument('--cfg', type=float, default=5.0)
    ap.add_argument('--shift', type=float, default=8.0)
    ap.add_argument('--fps', type=int, default=24)
    ap.add_argument('--out', default=None)
    args = ap.parse_args()

    key = os.path.splitext(os.path.basename(args.plate))[0]
    # The same FNV-1a-per-key discipline as the image tier: one key, one seed,
    # so a re-run reproduces and a re-roll is deliberate.
    seed = fnv(key)

    # ComfyUI's LoadImage reads from its own input/ directory, by name.
    from PIL import Image
    inp = os.path.join(COMFY_ROOT, 'input')
    os.makedirs(inp, exist_ok=True)
    name = key + '.png'
    Image.open(args.plate).convert('RGB').save(os.path.join(inp, name))

    wf = build(name, args.prompt, args.length, args.steps, seed, args.cfg, args.shift)
    r = post('/prompt', {'prompt': wf, 'client_id': str(uuid.uuid4())})
    pid = r['prompt_id']
    print('queued %s seed=%d %df %dsteps' % (pid, seed, args.length, args.steps), flush=True)

    t0 = time.time()
    while True:
        h = get('/history/' + pid)
        if pid in h:
            break
        time.sleep(3)
        if time.time() - t0 > 3600:
            sys.exit('timed out after an hour')
    took = time.time() - t0

    imgs = []
    for node in h[pid]['outputs'].values():
        for im in node.get('images', []):
            imgs.append(os.path.join(COMFY_ROOT, 'output',
                                     im.get('subfolder', ''), im['filename']))
    if not imgs:
        sys.exit('no frames came back; check the ComfyUI console')
    print('%d frames in %.0fs (%.2fs per frame)'
          % (len(imgs), took, took / max(1, len(imgs))), flush=True)

    stage = os.path.join(HERE, 'frames_' + key)
    shutil.rmtree(stage, ignore_errors=True)
    os.makedirs(stage)
    for i, p in enumerate(sorted(imgs)):
        shutil.copy(p, os.path.join(stage, 'f%04d.png' % i))

    out = args.out or os.path.join(HERE, key + '.mp4')
    subprocess.run(['ffmpeg', '-y', '-framerate', str(args.fps),
                    '-i', os.path.join(stage, 'f%04d.png'),
                    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18',
                    '-movflags', '+faststart', out], check=True,
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    # Every encode ships with its ffprobe line. An artifact without one is an
    # unverified artifact (media-video section 5, rule 7).
    subprocess.run(['ffprobe', '-v', 'error',
                    '-show_entries', 'stream=width,height,pix_fmt,r_frame_rate',
                    '-show_entries', 'format=duration,size',
                    '-of', 'default=noprint_wrappers=1', out])
    print('WROTE ' + out, flush=True)


if __name__ == '__main__':
    main()
