import os, sys, glob, traceback, torch
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from krea_gen import REPO
from diffusers import Krea2Transformer2DModel
from diffusers import BitsAndBytesConfig as DiffBnB

print('REPO', REPO, flush=True)
q = dict(load_in_4bit=True, bnb_4bit_quant_type='nf4',
         bnb_4bit_compute_dtype=torch.bfloat16, bnb_4bit_use_double_quant=True)

trials = [
    ('quant + device_map cuda:0',
     dict(quantization_config=DiffBnB(**q), torch_dtype=torch.bfloat16, device_map='cuda:0')),
    ('quant + device_map auto',
     dict(quantization_config=DiffBnB(**q), torch_dtype=torch.bfloat16, device_map='auto')),
    ('quant only, no dtype',
     dict(quantization_config=DiffBnB(**q))),
    ('quant + low_cpu_mem_usage False',
     dict(quantization_config=DiffBnB(**q), torch_dtype=torch.bfloat16, low_cpu_mem_usage=False)),
]
for name, kw in trials:
    print('=' * 60, flush=True)
    print('TRY:', name, flush=True)
    try:
        m = Krea2Transformer2DModel.from_pretrained(REPO, subfolder='transformer', **kw)
        dev = {str(p.device) for p in m.parameters()}
        meta = sum(1 for p in m.parameters() if p.is_meta)
        free, tot = torch.cuda.mem_get_info()
        print(f'  OK devices={dev} meta_params={meta} vram={(tot-free)/2**30:.1f}GiB', flush=True)
        del m; torch.cuda.empty_cache()
        print('  >>> WINNER:', name, flush=True)
        break
    except Exception as e:
        print('  FAIL:', type(e).__name__, str(e)[:160], flush=True)
        torch.cuda.empty_cache()
