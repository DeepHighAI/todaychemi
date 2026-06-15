import cairosvg
from PIL import Image
FONT="Noto Sans CJK KR"; G1,G2,G3="#FFC453","#FF6A88","#6541F2"; INK="#1a1b23"
out="/sessions/eloquent-nice-turing/mnt/outputs/"

def bg_grad(id):
    return f'<linearGradient id="{id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="{G1}"/><stop offset="0.5" stop-color="{G2}"/><stop offset="1" stop-color="{G3}"/></linearGradient>'

# ---- marks (centered at origin local space) ----
def rings(cx,cy,s,stroke,sw=26):
    return f'<g transform="translate({cx},{cy}) scale({s})"><circle cx="-34" cy="0" r="58" fill="none" stroke="{stroke}" stroke-width="{sw}"/><circle cx="34" cy="0" r="58" fill="none" stroke="{stroke}" stroke-width="{sw}"/></g>'

HEART="M16 29 C 16 29 2 19 2 10 C 2 5 6 2 10 2 C 13 2 15 4 16 6 C 17 4 19 2 22 2 C 26 2 30 5 30 10 C 30 19 16 29 16 29 Z"
def heart(cx,cy,s,fill):
    return f'<g transform="translate({cx},{cy}) scale({s})"><g transform="translate(-16,-15.5)"><path d="{HEART}" fill="{fill}"/></g></g>'

def render(name,svg,w,h):
    open(out+name+".svg","w").write(svg)
    cairosvg.svg2png(bytestring=svg.encode(),write_to=out+name+".png",output_width=w,output_height=h)

# ===== Concept A : 겹침 / interlocking rings =====
appA=f'''<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600">
<defs>{bg_grad("g")}</defs><rect width="600" height="600" fill="url(#g)"/>{rings(300,300,1.5,"#ffffff",30)}</svg>'''

darkA=f'''<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600">
<defs><linearGradient id="gm" gradientUnits="userSpaceOnUse" x1="-105" y1="-71" x2="105" y2="71">
<stop offset="0" stop-color="{G1}"/><stop offset="0.5" stop-color="{G2}"/><stop offset="1" stop-color="{G3}"/></linearGradient></defs>
<rect width="600" height="600" fill="{INK}"/>{rings(300,300,1.5,"url(#gm)",30)}</svg>'''

thumbA=f'''<svg xmlns="http://www.w3.org/2000/svg" width="1932" height="828" viewBox="0 0 1932 828">
<defs><linearGradient id="gt" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="1932" y2="828">
<stop offset="0" stop-color="{G1}"/><stop offset="0.5" stop-color="{G2}"/><stop offset="1" stop-color="{G3}"/></linearGradient></defs>
<rect width="1932" height="828" fill="url(#gt)"/>{rings(500,414,1.7,"#ffffff",30)}
<text x="742" y="430" font-family="{FONT}" font-weight="700" font-size="210" fill="#ffffff">오늘케미</text>
<text x="748" y="548" font-family="{FONT}" font-weight="400" font-size="76" fill="#ffffff" fill-opacity="0.92">오늘, 우리 사이의 케미</text></svg>'''

# ===== Concept B : 하트 / heart =====
appB=f'''<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600">
<defs>{bg_grad("g")}</defs><rect width="600" height="600" fill="url(#g)"/>{heart(300,308,10.5,"#ffffff")}</svg>'''

darkB=f'''<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600">
<defs><linearGradient id="gh" x1="0" y1="0" x2="1" y2="1">
<stop offset="0" stop-color="{G1}"/><stop offset="0.5" stop-color="{G2}"/><stop offset="1" stop-color="{G3}"/></linearGradient></defs>
<rect width="600" height="600" fill="{INK}"/>{heart(300,308,10.5,"url(#gh)")}</svg>'''

thumbB=f'''<svg xmlns="http://www.w3.org/2000/svg" width="1932" height="828" viewBox="0 0 1932 828">
<defs><linearGradient id="gt" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="1932" y2="828">
<stop offset="0" stop-color="{G1}"/><stop offset="0.5" stop-color="{G2}"/><stop offset="1" stop-color="{G3}"/></linearGradient></defs>
<rect width="1932" height="828" fill="url(#gt)"/>{heart(505,414,11.0,"#ffffff")}
<text x="742" y="430" font-family="{FONT}" font-weight="700" font-size="210" fill="#ffffff">오늘케미</text>
<text x="748" y="548" font-family="{FONT}" font-weight="400" font-size="76" fill="#ffffff" fill-opacity="0.92">오늘, 우리 사이의 케미</text></svg>'''

jobs=[("twoday_A_app_logo_600",appA,600,600),("twoday_A_app_logo_dark_600",darkA,600,600),("twoday_A_thumbnail_1932x828",thumbA,1932,828),
      ("twoday_B_app_logo_600",appB,600,600),("twoday_B_app_logo_dark_600",darkB,600,600),("twoday_B_thumbnail_1932x828",thumbB,1932,828)]
for n,s,w,h in jobs:
    render(n,s,w,h); print("rendered",n,Image.open(out+n+".png").size)
# previews
for n in ["twoday_A_thumbnail_1932x828","twoday_B_thumbnail_1932x828"]:
    Image.open(out+n+".png").resize((772,331)).save(out+"_prev_"+n+".png")
for n in ["twoday_A_app_logo_600","twoday_A_app_logo_dark_600","twoday_B_app_logo_600","twoday_B_app_logo_dark_600"]:
    Image.open(out+n+".png").save(out+"_prev_"+n+".png")
print("done")
