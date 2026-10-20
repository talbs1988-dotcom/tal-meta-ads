#!/usr/bin/env python3
"""
הדבקת התמונה האמיתית של בעל העסק לתוך אזור שמור בעיצוב שנוצר ב-AI.
הפנים לא עוברות דרך המודל — נשארות מהצילום המקורי.

שימוש:
  circle: python3 composite-photo.py circle <design.png> <photo> <out.png> <cx> <cy> <radius> [ring_width]
  rect:   python3 composite-photo.py rect   <design.png> <photo> <out.png> <x> <y> <w> <h> [corner_radius]

הקואורדינטות קבועות מראש וזהות לאלה שבפרומפט (ברירת מחדל: מעגל 700 520 190 8 בקנבס 1024×1024). לא מודדים.
"""
import sys
from PIL import Image, ImageDraw, ImageOps


def fit_cover(photo, w, h):
    return ImageOps.fit(photo, (w, h), Image.LANCZOS, centering=(0.5, 0.28))


def main():
    mode, design_path, photo_path, out_path = sys.argv[1:5]
    design = Image.open(design_path).convert("RGBA")
    photo = Image.open(photo_path).convert("RGBA")

    if mode == "circle":
        cx, cy, r = map(int, sys.argv[5:8])
        d = 2 * r
        fitted = fit_cover(photo, d, d)
        mask = Image.new("L", (d, d), 0)
        ImageDraw.Draw(mask).ellipse((0, 0, d, d), fill=255)
        design.paste(fitted, (cx - r, cy - r), mask)
    elif mode == "rect":
        x, y, w, h = map(int, sys.argv[5:9])
        cr = int(sys.argv[9]) if len(sys.argv) > 9 else 24
        fitted = fit_cover(photo, w, h)
        mask = Image.new("L", (w, h), 0)
        ImageDraw.Draw(mask).rounded_rectangle((0, 0, w, h), radius=cr, fill=255)
        design.paste(fitted, (x, y), mask)
    else:
        sys.exit(f"mode לא מוכר: {mode}")

    design.convert("RGB").save(out_path, "PNG")
    print(f"✓ נשמר: {out_path}")


if __name__ == "__main__":
    main()
