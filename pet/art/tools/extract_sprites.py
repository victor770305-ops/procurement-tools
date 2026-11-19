"""從角色設定稿（4 張，每張 5 系 × 3 階段）裁切並去背出 60 張角色圖。

用法：python3 extract_sprites.py [--debug]
輸入：../source/sheet1.png ~ sheet4.png
輸出：../creatures/raw/s{sheet}r{row}c{col}.png（RGBA）
只用 numpy + Pillow。
"""
import sys, os
import numpy as np
from PIL import Image, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, '..', 'source')
OUT = os.path.join(HERE, '..', 'creatures', 'raw')
os.makedirs(OUT, exist_ok=True)

COLS = [(350, 578, 455), (590, 930, 775), (938, 1436, 1192)]  # x0, x1, 名牌中心 x
BG = np.array([251, 244, 238], float)
# 四張設定稿版面相同：每列名牌下框線的 y 座標
LABEL_BOTTOM = [239, 438, 637, 835, 1051]
# 卡片分隔線所在的 y 區間（線條是低彩度的灰褐色細線）
LINE_BANDS = [(58, 84), (252, 282), (451, 482), (650, 681), (847, 880), (1062, 1086)]


def line_mask(a):
    a = a.astype(float)
    sat = a.max(-1) - a.min(-1)
    L = lum(a)
    m = np.zeros(a.shape[:2], bool)
    for y0, y1 in LINE_BANDS:
        m[y0:y1] = (sat[y0:y1] < 70) & (L[y0:y1] > 80)
    return m


def lum(a):
    return a[..., 0] * .3 + a[..., 1] * .59 + a[..., 2] * .11


def find_labels(a, cx):
    """找出名牌的上框線 y（每欄 5 個）。名牌框線是一條橫跨 ~140px 的中間亮度細線。"""
    band = lum(a[:, cx - 66:cx + 66].astype(float))
    line = ((band > 95) & (band < 205)).mean(1) > .82
    ys = [y for y in range(60, a.shape[0] - 30) if line[y]]
    groups = []
    for y in ys:
        if groups and y - groups[-1][-1] <= 2:
            groups[-1].append(y)
        else:
            groups.append([y])
    tops = [g[0] for g in groups]
    labels = []
    for t in tops:
        for b in tops:
            if 22 <= b - t <= 38 and (band[t + 4:b - 3] > 200).mean() > .55:
                labels.append(t)
                break
    out = []
    for t in labels:
        if not out or t - out[-1] > 80:
            out.append(t)
    return out


def dilate(m, r):
    return np.asarray(Image.fromarray((m * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(r))) > 127


def erode(m, r):
    return np.asarray(Image.fromarray((m * 255).astype(np.uint8)).filter(ImageFilter.MinFilter(r))) > 127


def grow(seed, allowed):
    cur = seed & allowed
    n = cur.sum()
    while True:
        nxt = dilate(cur, 3) & allowed
        m = nxt.sum()
        if m == n:
            return nxt
        cur, n = nxt, m


def components(m):
    """4 連通元件（逐一 flood fill），回傳每塊的 (ys, xs)。"""
    from collections import deque
    seen = np.zeros_like(m)
    H, W = m.shape
    out = []
    for y, x in zip(*np.where(m)):
        if seen[y, x]:
            continue
        q = deque([(y, x)]); seen[y, x] = True; ys, xs = [], []
        while q:
            cy, cx = q.popleft(); ys.append(cy); xs.append(cx)
            for ny, nx in ((cy + 1, cx), (cy - 1, cx), (cy, cx + 1), (cy, cx - 1)):
                if 0 <= ny < H and 0 <= nx < W and m[ny, nx] and not seen[ny, nx]:
                    seen[ny, nx] = True; q.append((ny, nx))
        out.append((np.array(ys), np.array(xs)))
    return out


def extract(img, y0, y1, x0, x1, lines):
    a = np.asarray(img).astype(float)[y0:y1, x0:x1]
    h, w = a.shape[:2]
    dist = np.sqrt(((a - BG) ** 2).sum(-1))
    fg = (dist > 20) & ~lines[y0:y1, x0:x1]
    core = np.zeros_like(fg)
    core[int(h * .3):int(h * .9), int(w * .25):int(w * .75)] = True
    clean = erode(dilate(fg, 3), 3)          # 先閉合小縫
    opened = dilate(erode(clean, 3), 3)      # 去掉 1~2px 細線（卡片框線）
    main = grow(opened & core, opened)
    main = grow(main, clean)
    near = dilate(main, 31)
    mask = main | (clean & near)             # 附近的粒子、光點一起保留
    border = np.zeros_like(mask)
    border[0, :] = border[-1, :] = border[:, 0] = border[:, -1] = True
    outside = grow(border & ~mask, ~mask)
    holes = ~outside & ~mask
    # 補洞：被包圍的區域若是平滑的背景色（藤蔓、星座線圍出的空隙）就保持透明，有紋理的毛髮才補成實心
    for comp in components(holes):
        ys_, xs_ = comp
        d = dist[ys_, xs_].mean()
        if not ((len(ys_) > 250 and d < 6.5) or (len(ys_) > 1200 and d < 9.5)):
            mask[ys_, xs_] = True
    solid = erode(mask, 5)
    soft = dilate(mask, 5) & ~solid
    alpha = np.where(solid, 1.0, 0.0)
    ramp = np.clip((dist - 6) / 34, 0, 1)
    alpha = np.where(soft, np.maximum(alpha, ramp * dilate(mask, 3)), alpha)
    fade = np.ones(h)
    fade[-6:] = np.linspace(1, .2, 6)        # 底部被名牌切掉的地方淡出
    alpha *= fade[:, None]
    # 去除邊緣混到的米白底色
    al = np.clip(alpha, 1e-3, 1)[..., None]
    rgb = np.where(alpha[..., None] > .1, np.clip((a - (1 - al) * BG) / al, 0, 255), a)
    ys, xs = np.where(alpha > .03)
    if len(ys) == 0:
        return None
    pad = 6
    t, b = max(ys.min() - pad, 0), min(ys.max() + pad, h)
    l, r = max(xs.min() - pad, 0), min(xs.max() + pad, w)
    out = np.dstack([rgb, alpha * 255]).astype(np.uint8)[t:b, l:r]
    return Image.fromarray(out, 'RGBA')


def main():
    debug = '--debug' in sys.argv
    for s in range(1, 5):
        img = Image.open(os.path.join(SRC, f'sheet{s}.png')).convert('RGB')
        a = np.asarray(img)
        lines = line_mask(a)
        for c, (x0, x1, _) in enumerate(COLS):
            for r in range(5):
                y0 = (0 if c == 2 else 74) if r == 0 else LABEL_BOTTOM[r - 1] + 24
                y1 = LABEL_BOTTOM[r] - 31
                sp = extract(img, y0, y1, x0, x1, lines)
                sp.save(os.path.join(OUT, f's{s}r{r + 1}c{c + 1}.png'))
                if debug:
                    print(f'  s{s}r{r + 1}c{c + 1}', sp.size)


if __name__ == '__main__':
    main()
