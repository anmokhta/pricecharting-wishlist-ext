# Builds a preview sheet for one batch of icon concepts:
# each row shows 128/48/16 px on a light and a dark toolbar color, plus 16 px zoomed 4x.
import sys, glob, os
from PIL import Image, ImageDraw, ImageFont
batch = sys.argv[1]
names = sorted(os.path.basename(f)[:-4] for f in glob.glob(f'{batch}/*.svg'))
W, RH = 980, 190
sheet = Image.new('RGB', (W, 40 + RH * len(names)), '#ffffff')
d = ImageDraw.Draw(sheet)
try: font = ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc', 18)
except Exception: font = ImageFont.load_default()
heads = [(30, 'concept'), (190, '128 light'), (340, '128 dark'), (490, '48 light / dark'), (650, '16 light / dark'), (800, '16 zoomed 4x')]
for x, t in heads: d.text((x, 10), t, fill='#666', font=font)
for i, n in enumerate(names):
    y = 40 + i * RH
    d.text((30, y + 80), n, fill='#222', font=font)
    for x, bg in ((180, '#f1f3f4'), (330, '#202124')):
        d.rectangle([x, y, x + 140, y + 160], fill=bg)
        im = Image.open(f'{batch}/{n}-128.png'); sheet.paste(im, (x + 6, y + 16), im)
    for k, bg in enumerate(('#f1f3f4', '#202124')):
        x = 480 + k * 70; d.rectangle([x, y + 50, x + 64, y + 114], fill=bg)
        im = Image.open(f'{batch}/{n}-48.png'); sheet.paste(im, (x + 8, y + 58), im)
        x = 640 + k * 60; d.rectangle([x, y + 66, x + 50, y + 98], fill=bg)
        im = Image.open(f'{batch}/{n}-16.png'); sheet.paste(im, (x + 17, y + 74), im)
    im = Image.open(f'{batch}/{n}-16.png').resize((64, 64), Image.NEAREST)
    d.rectangle([790, y + 46, 870, y + 126], fill='#f1f3f4'); sheet.paste(im, (798, y + 54), im)
sheet.save(f'{batch}/sheet.png'); print(f'{batch}/sheet.png')
