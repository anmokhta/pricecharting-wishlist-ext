# Crops the store-screenshot UI images from the original retina screencaps
# (browser chrome excluded). Each crop is 2:1 and saved 2240 px wide (2x of its 1120 px slot).
from PIL import Image
import sys
SRC = '../../../screencaps/{}.png'
# name: (source, x0, y0, width, height)
CROPS = {
    # x0 = 116: the browser window's dark frame occupies x 104-111 in the originals.
    'grid':    ('s4', 116, 520, 2828, 1414),
    'totals':  ('s1', 116, 330, 1988, 994),
    'search':  ('s5', 116, 410, 2748, 1195),
    # Combined Select/Exclude image: crops start at the yellow pick bar.
    'select-short':  ('s2', 116, 590, 1844, 950),
    'exclude-short': ('s3', 116, 590, 1844, 950),
    'select-tall':   ('s2', 116, 590, 1844, 1360),
    'exclude-tall':  ('s3', 116, 590, 1844, 1360),
}
for name, (src, x, y, w, h) in CROPS.items():
    im = Image.open(SRC.format(src)).convert('RGB').crop((x, y, x + w, y + h))
    width = 1100 if '-' in name else 2240
    im.resize((width, round(width * h / w)), Image.LANCZOS).save(f'shots/{name}.jpg', quality=92)
    print(name, im.size)
