"""把裁好的角色排成檢查用總表（深色底容易看出殘留的背景）。"""
import os, sys
from PIL import Image, ImageDraw
HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, '..', 'creatures', sys.argv[1] if len(sys.argv) > 1 else 'raw')
out = sys.argv[2] if len(sys.argv) > 2 else os.path.join(HERE, 'contact.png')
sheets = [int(x) for x in sys.argv[3].split(',')] if len(sys.argv) > 3 else [1, 2, 3, 4]
CW, CH = 260, 170
img = Image.new('RGB', (CW * 3, CH * 5 * len(sheets)), (46, 52, 70))
d = ImageDraw.Draw(img)
for si, s in enumerate(sheets):
    for r in range(5):
        for c in range(3):
            p = os.path.join(RAW, f's{s}r{r + 1}c{c + 1}.png')
            if not os.path.exists(p):
                continue
            sp = Image.open(p)
            sp.thumbnail((CW - 10, CH - 10))
            x, y = c * CW + (CW - sp.width) // 2, (si * 5 + r) * CH + (CH - sp.height) // 2
            bg = (46, 52, 70) if (r + c) % 2 else (70, 110, 80)
            d.rectangle([c * CW, (si * 5 + r) * CH, (c + 1) * CW - 1, (si * 5 + r + 1) * CH - 1], fill=bg)
            img.paste(sp, (x, y), sp)
            d.text((c * CW + 4, (si * 5 + r) * CH + 2), f's{s}r{r + 1}c{c + 1}', fill=(255, 255, 255))
img.save(out)
print(out, img.size)
