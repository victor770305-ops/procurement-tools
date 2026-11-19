"""從「天穹龍帝・埃爾德拉」宣傳圖切出 4 個階段。

輸出：creatures/sp-{n}-card.jpg  帶原畫背景的卡片版（遊戲正式使用）
加 --cutout 會另外輸出實驗性的去背版 sp-{n}.png（第 3、4 階段品質不足，不建議使用）
"""
import os
import numpy as np
from PIL import Image, ImageFilter
from extract_sprites import dilate, erode, grow, components

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, '..', 'source', 'store-dragon.png')
OUT = os.path.join(HERE, '..', 'creatures')

# (裁切框, 種子框[相對], 亮度門檻)
STAGES = [
    ((30, 520, 232, 712), (60, 40, 150, 160), 168),
    ((240, 430, 572, 712), (60, 60, 250, 260), 168),
    ((532, 262, 1000, 702), (60, 60, 380, 400), 172),
    ((690, 0, 1672, 800), (300, 100, 900, 700), 176),
]
CARDS = [(14, 470, 236, 728), (226, 400, 586, 728), (516, 220, 1000, 728), (790, 0, 1672, 728)]


def extract(im, box, seed_box, thr):
    a = np.asarray(im.crop(box)).astype(float)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    L = r * .3 + g * .59 + b * .11
    mx, mn = a.max(-1), a.min(-1)
    sat = (mx - mn) / np.maximum(mx, 1)
    bright = L > thr
    gold = (r > 150) & (r > b + 45) & (g > 110) & (sat > .3)
    gem = (b > 150) & (b > r + 40) & (L > 90)
    lilac = (L > thr - 28) & (b > g + 8) & (r > g - 5)          # 半透明紫色翼膜
    cand = bright | gold | gem | lilac
    cand = erode(dilate(cand, 3), 3)
    seed = np.zeros_like(cand)
    x0, y0, x1, y1 = seed_box
    seed[y0:y1, x0:x1] = True
    core = dilate(erode(cand, 5), 5)
    main = grow(core & seed & (L > thr + 20), core)
    main = grow(main, cand)
    # 補洞
    h, w = main.shape
    border = np.zeros_like(main); border[0, :] = border[-1, :] = border[:, 0] = border[:, -1] = True
    outside = grow(border & ~main, ~main)
    for ys, xs in components(~outside & ~main):
        if len(ys) < 900:
            main[ys, xs] = True
    alpha = np.asarray(Image.fromarray((main * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.2))).astype(float) / 255
    ys, xs = np.where(alpha > .05)
    t, bt, l, rt = max(ys.min() - 4, 0), min(ys.max() + 4, h), max(xs.min() - 4, 0), min(xs.max() + 4, w)
    out = np.dstack([a, alpha * 255]).astype(np.uint8)[t:bt, l:rt]
    return Image.fromarray(out, 'RGBA')


# 原圖中階段之間的金色箭頭位置（修補掉，避免出現在卡片邊緣）
ARROWS = [(200, 612, 266, 688), (512, 572, 586, 648), (884, 612, 956, 692)]


def remove_arrows(im):
    a = np.asarray(im).astype(float)
    for x0, y0, x1, y1 in ARROWS:
        reg = a[y0:y1, x0:x1]
        r, g, b = reg[..., 0], reg[..., 1], reg[..., 2]
        m = (r > 150) & (r > b + 40) & (g > 100)
        m = dilate(m, 7)
        fill = reg.copy()
        for _ in range(60):  # 擴散修補：反覆模糊，只覆蓋箭頭像素
            blur = np.asarray(Image.fromarray(fill.astype(np.uint8)).filter(ImageFilter.GaussianBlur(3))).astype(float)
            fill[m] = blur[m]
        a[y0:y1, x0:x1] = fill
    return Image.fromarray(a.astype(np.uint8))


def card(im, box):
    c = im.crop(box).convert('RGB')
    w, h = c.size
    s = 640 / max(w, h)
    return c.resize((round(w * s), round(h * s)), Image.LANCZOS) if s < 1 else c


def main():
    im = Image.open(SRC).convert('RGB')
    clean = remove_arrows(im)
    # 去背版只在 --cutout 時輸出：第 3、4 階段翅膀和紫色雲層混在一起，自動去背品質不足
    import sys
    for i, (box, seed, thr) in enumerate(STAGES):
        if '--cutout' in sys.argv:
            extract(im, box, seed, thr).save(os.path.join(OUT, f'sp-{i + 1}.png'))
        card(clean, CARDS[i]).save(os.path.join(OUT, f'sp-{i + 1}-card.jpg'), quality=88)
    print('ok')


if __name__ == '__main__':
    main()
