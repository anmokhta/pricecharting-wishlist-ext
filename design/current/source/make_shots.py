# Crops the UI images used in the store art from the original retina captures
# in captures/ (browser window and toolbar excluded) and writes them to crops/.
# Run from this folder:  python3 make_shots.py
from PIL import Image
import os

HERE = os.path.dirname(os.path.abspath(__file__))
CAPTURE = os.path.join(HERE, 'captures', '{}.png')
OUT = os.path.join(HERE, 'crops', '{}.jpg')

# x0 = 116 everywhere: the browser window's dark frame occupies x 104-111 in the captures.
# name: (capture, x0, y0, width, height, output width in px)
CROPS = {
    # Store screenshots (each fills a 1120 px slot; saved at 2x).
    'shot-grid':         ('s4', 116, 330, 2828, 1414, 2240),
    'shot-totals':       ('s1', 116, 330, 1988, 994, 2240),
    'shot-search':       ('s5', 116, 410, 2748, 1195, 2240),
    # Screenshot 3: two half-width panels starting at the yellow pick bar.
    'shot-select-tall':  ('s2', 116, 590, 1844, 1360, 1100),
    'shot-exclude-tall': ('s3', 116, 590, 1844, 1360, 1100),
    # Marquee promo tile: the two tilted screenshots.
    'promo-grid':        ('s4', 116, 320, 2726, 1640, 1600),
    'promo-list':        ('s1', 116, 320, 2726, 1640, 1600),
}

for name, (src, x, y, w, h, out_w) in CROPS.items():
    im = Image.open(CAPTURE.format(src)).convert('RGB').crop((x, y, x + w, y + h))
    im.resize((out_w, round(out_w * h / w)), Image.LANCZOS).save(OUT.format(name), quality=92)
    print(name, im.size)
