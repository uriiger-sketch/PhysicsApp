"""Every app icon, launch image and favicon, from one picture: the icon design
in resources/icon-source.jpg (a rounded tile on a light mock-up background).

    python3 scripts/icon.py          (Python 3 with Pillow and numpy)

The stores want a full-bleed square -- iOS and Google Play round the corners
themselves -- so the tile's background gradient is fitted (a cubic in x and y,
from the band just inside its edge, where there is no artwork) and painted
into the corners and over the tile's thin bevel. The artwork is untouched.

Writes:
  ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png   1024, no alpha
  ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732*.png    launch image
  android/app/src/main/res/mipmap-*/ic_launcher_background.png         adaptive icon (Android 8+)
  android/app/src/main/res/mipmap-*/ic_launcher{,_round}.png           Android 7.x icons
  android/app/src/main/res/drawable-nodpi/splash_logo.png              Android 7-11 launch
  store/app-store/icon-1024.png, store/google-play/icon-512.png        listing icons
  resources/icon-rounded-512.png                                       for the store graphics
  resources/favicon-64.png                                             the pages' favicon
"""
import os
import sys
import numpy as np
from PIL import Image, ImageFilter

APP = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(APP, 'resources', 'icon-source.jpg')
GROUND = (7, 16, 31)      # #07101f, the course's own background

def out(rel):
    p = os.path.join(APP, rel)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    return p

src = np.asarray(Image.open(SRC).convert('RGB')).astype(np.float64)
H, W, _ = src.shape
dark = src.sum(axis=2) < 560                      # the tile; the mock-up around it is light grey

# the tile's silhouette: per row, from its outermost dark pixels (bright artwork inside is no hole)
rows = np.where(dark.sum(axis=1) > 20)[0]
cols = np.where(dark.sum(axis=0) > 20)[0]
y0, y1, x0, x1 = rows[0], rows[-1] + 1, cols[0], cols[-1] + 1
tile = np.zeros((H, W), bool)
for y in range(y0, y1):
    xs = np.where(dark[y, x0:x1])[0]
    if len(xs):
        tile[y, x0 + xs[0]:x0 + xs[-1] + 1] = True

def erode(m, n):
    r = m.copy()
    for _ in range(n):
        r[1:, :] &= m[:-1, :]; r[:-1, :] &= m[1:, :]; r[:, 1:] &= m[:, :-1]; r[:, :-1] &= m[:, 1:]
        m = r.copy()
    return r

inner10, inner60 = erode(tile, 10), erode(tile, 60)
band = inner10 & ~inner60                          # background only: the artwork starts ~80 px in

# the gradient: a cubic in normalised coordinates, fitted on the band
side = max(x1 - x0, y1 - y0)
cx, cy = (x0 + x1 - 1) / 2, (y0 + y1 - 1) / 2
def terms(xx, yy):
    u, v = (xx - cx) / (side / 2), (yy - cy) / (side / 2)
    return np.stack([np.ones_like(u), u, v, u * u, u * v, v * v, u ** 3, u * u * v, u * v * v, v ** 3], axis=-1)
by, bx = np.nonzero(band)
A = terms(bx.astype(float), by.astype(float))
coef = np.linalg.lstsq(A, src[by, bx], rcond=None)[0]
resid = np.sqrt(((A @ coef - src[by, bx]) ** 2).mean())
if resid > 6:
    sys.exit(f'icon.py: the background does not look like a smooth gradient (rms {resid:.1f}); check the source picture')

# the full-bleed square: the picture inside the tile (past its bevel), the gradient elsewhere
sx0, sy0 = int(round(cx - side / 2 + 0.5)), int(round(cy - side / 2 + 0.5))
yy, xx = np.mgrid[sy0:sy0 + side, sx0:sx0 + side].astype(float)
model = np.clip(terms(xx, yy) @ coef, 0, 255)
inside = np.zeros((side, side), float)
for d, w in ((8, 0.25), (10, 0.5), (12, 0.75), (14, 1.0)):   # a soft 6 px seam
    m = erode(tile, d)[sy0:sy0 + side, sx0:sx0 + side] if (sy0 >= 0 and sx0 >= 0) else None
    inside = np.maximum(inside, m * w)
pic = src[sy0:sy0 + side, sx0:sx0 + side]
full = inside[..., None] * pic + (1 - inside[..., None]) * model
master = Image.fromarray(np.uint8(np.clip(full + 0.5, 0, 255)), 'RGB')

def square(n):
    im = master.resize((n, n), Image.LANCZOS)
    if n > side:   # an enlargement: a light sharpening restores the strokes' edges
        im = im.filter(ImageFilter.UnsharpMask(radius=1.6, percent=55, threshold=2))
    return im

def masked(n, shape, inset=0.0):
    """the icon in a rounded square (iOS-like corners) or a circle, transparent around it"""
    k = 4                                          # antialiasing: draw the mask 4x larger
    big = Image.new('L', (n * k, n * k), 0)
    from PIL import ImageDraw
    d = ImageDraw.Draw(big)
    m = inset * n * k
    box = [m, m, n * k - 1 - m, n * k - 1 - m]
    if shape == 'round':
        d.ellipse(box, fill=255)
    else:
        d.rounded_rectangle(box, radius=(n * k - 2 * m) * 0.2237, fill=255)
    mask = big.resize((n, n), Image.LANCZOS)
    im = square(n).convert('RGBA')
    im.putalpha(mask)
    return im

def save(rel, im):
    if im.mode == 'RGB':
        im.save(out(rel), optimize=True)
    else:
        im.save(out(rel), optimize=True)
    print(f'  {rel}  {im.size[0]}x{im.size[1]} {im.mode}')

icon1024 = square(1024)
save('ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png', icon1024)
save('store/app-store/icon-1024.png', icon1024)
save('store/google-play/icon-512.png', square(512).convert('RGBA'))   # Play: 32-bit, opaque
save('resources/icon-rounded-512.png', masked(512, 'rounded'))
save('resources/favicon-64.png', masked(64, 'rounded'))

# launch images: the rounded icon in the middle of the course's dark ground
splash = Image.new('RGB', (2732, 2732), GROUND)
logo = masked(560, 'rounded')
splash.paste(logo, ((2732 - 560) // 2, (2732 - 560) // 2), logo)
for f in ('splash-2732x2732.png', 'splash-2732x2732-1.png', 'splash-2732x2732-2.png'):
    save(f'ios/App/App/Assets.xcassets/Splash.imageset/{f}', splash)
save('android/app/src/main/res/drawable-nodpi/splash_logo.png', masked(420, 'rounded'))

# Android: the adaptive icon's back layer is the picture -- the artwork within
# the 66 dp safe circle of the 108 dp canvas, its own gradient carried to the
# edge for the launchers' masks and motion -- with a transparent front layer
for dpi, s in (('mdpi', 1), ('hdpi', 1.5), ('xhdpi', 2), ('xxhdpi', 3), ('xxxhdpi', 4)):
    n, a = int(108 * s), int(round(66 * s))
    art = np.asarray(square(a))
    pad = (n - a) // 2
    bg = np.pad(art, ((pad, n - a - pad), (pad, n - a - pad), (0, 0)), mode='edge')
    save(f'android/app/src/main/res/mipmap-{dpi}/ic_launcher_background.png', Image.fromarray(bg, 'RGB'))
    legacy = int(48 * s)
    save(f'android/app/src/main/res/mipmap-{dpi}/ic_launcher.png', masked(legacy, 'rounded', inset=1 / 48))
    save(f'android/app/src/main/res/mipmap-{dpi}/ic_launcher_round.png', masked(legacy, 'round', inset=1 / 48))

print(f'icon.py: tile {x1 - x0}x{y1 - y0} px at ({x0},{y0}); background fitted to rms {resid:.2f}')
