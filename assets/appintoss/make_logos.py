import cairosvg

FONT = "Noto Sans CJK KR"
G1, G2, G3 = "#FFC453", "#FF6A88", "#6541F2"
INK = "#1a1b23"

def mark(cx, cy, s, fill, sw=30):
    return f'''<g transform="translate({cx},{cy}) scale({s})">
  <circle cx="-60" cy="-41" r="40" fill="{fill}"/>
  <circle cx="60" cy="-41" r="40" fill="{fill}"/>
  <path d="M -60 -26 Q 0 68 60 -26" fill="none" stroke="{fill}" stroke-width="{sw}" stroke-linecap="round"/>
</g>'''

app = f'''<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
<stop offset="0" stop-color="{G1}"/><stop offset="0.5" stop-color="{G2}"/><stop offset="1" stop-color="{G3}"/>
</linearGradient></defs>
<rect width="600" height="600" fill="url(#g)"/>
{mark(300,300,1.6,"#ffffff",30)}
</svg>'''

# dark: horizontal gradient across the mark so left dot=gold, mid=pink, right dot=purple
dark = f'''<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600">
<defs><linearGradient id="gm" gradientUnits="userSpaceOnUse" x1="150" y1="300" x2="450" y2="300">
<stop offset="0" stop-color="{G1}"/><stop offset="0.5" stop-color="{G2}"/><stop offset="1" stop-color="{G3}"/>
</linearGradient></defs>
<rect width="600" height="600" fill="{INK}"/>
{mark(300,300,1.6,"url(#gm)",30)}
</svg>'''

# thumbnail: centered lockup (mark + wordmark + tagline)
thumb = f'''<svg xmlns="http://www.w3.org/2000/svg" width="1932" height="828" viewBox="0 0 1932 828">
<defs><linearGradient id="gt" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="1932" y2="828">
<stop offset="0" stop-color="{G1}"/><stop offset="0.5" stop-color="{G2}"/><stop offset="1" stop-color="{G3}"/>
</linearGradient></defs>
<rect width="1932" height="828" fill="url(#gt)"/>
{mark(510,414,1.6,"#ffffff",30)}
<text x="742" y="430" font-family="{FONT}" font-weight="700" font-size="210" fill="#ffffff">오늘케미</text>
<text x="748" y="548" font-family="{FONT}" font-weight="400" font-size="76" fill="#ffffff" fill-opacity="0.92">오늘, 우리 사이의 케미</text>
</svg>'''

out = "/sessions/eloquent-nice-turing/mnt/outputs/"
for svg, w, h, fn in [
    (app, 600, 600, "twoday_app_logo_600.png"),
    (dark, 600, 600, "twoday_app_logo_dark_600.png"),
    (thumb, 1932, 828, "twoday_thumbnail_1932x828.png"),
]:
    open(out + fn.replace(".png", ".svg"), "w").write(svg)
    cairosvg.svg2png(bytestring=svg.encode("utf-8"), write_to=out + fn, output_width=w, output_height=h)
from PIL import Image
Image.open(out+'twoday_thumbnail_1932x828.png').resize((772,331)).save(out+'_preview_thumb.png')
Image.open(out+'twoday_app_logo_dark_600.png').save(out+'_preview_dark.png')
print("done")
