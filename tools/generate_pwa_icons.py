#!/usr/bin/env python3
"""
tools/generate_pwa_icons.py
Generates professional PWA and browser icons for Apex Grand Prix: Uncapped Next-Gen Edition.
Outputs:
  - public/assets/icons/icon-192.png
  - public/assets/icons/icon-512.png
  - public/assets/icons/icon-maskable-512.png
  - public/assets/icons/apple-touch-icon.png
  - public/assets/icons/favicon.ico
"""

import os
import math
from PIL import Image, ImageDraw, ImageFilter

def draw_apex_icon(size: int, maskable: bool = False) -> Image.Image:
    # High-resolution supersampling for smooth anti-aliased vector edges
    ss_factor = 4
    w = size * ss_factor
    h = size * ss_factor

    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    cx, cy = w / 2, h / 2

    # Background
    if maskable:
        # Maskable icon requires solid edge-to-edge background
        draw.rectangle([0, 0, w, h], fill=(2, 6, 23, 255)) # #020617
    else:
        # Rounded squircle for standard icons
        corner_r = int(w * 0.22)
        draw.rounded_rectangle([0, 0, w, h], radius=corner_r, fill=(2, 6, 23, 255))

    # Subtle carbon grid / speed lines in background
    line_color = (15, 23, 42, 160)
    for i in range(-w, w * 2, int(w * 0.08)):
        draw.line([i, 0, i + h, h], fill=line_color, width=int(w * 0.015))

    # Scale factor for graphics (maskable needs ~78% safe area margin)
    scale = 0.72 if maskable else 0.88

    # Outer Neon Halo Ring / Hexagon
    ring_radius = (w * 0.42) * scale
    draw.ellipse(
        [cx - ring_radius, cy - ring_radius, cx + ring_radius, cy + ring_radius],
        outline=(0, 240, 255, 90),
        width=int(w * 0.012)
    )

    # Dynamic angled racing stripes
    stripe_w = int(w * 0.035 * scale)
    # Cyan stripe
    draw.polygon([
        (cx - w * 0.25 * scale, cy + h * 0.38 * scale),
        (cx - w * 0.18 * scale, cy + h * 0.38 * scale),
        (cx + w * 0.28 * scale, cy - h * 0.38 * scale),
        (cx + w * 0.21 * scale, cy - h * 0.38 * scale),
    ], fill=(0, 240, 255, 220))

    # Red/Crimson stripe
    draw.polygon([
        (cx - w * 0.15 * scale, cy + h * 0.38 * scale),
        (cx - w * 0.08 * scale, cy + h * 0.38 * scale),
        (cx + w * 0.38 * scale, cy - h * 0.38 * scale),
        (cx + w * 0.31 * scale, cy - h * 0.38 * scale),
    ], fill=(239, 68, 68, 220))

    # High-contrast Racing "A" / Apex Chevron Emblem
    # Central triangular aerodynamic wedge
    tip_y = cy - (h * 0.26 * scale)
    base_y = cy + (h * 0.24 * scale)
    left_x = cx - (w * 0.28 * scale)
    right_x = cx + (w * 0.28 * scale)
    inner_tip_y = cy - (h * 0.08 * scale)
    inner_base_y = cy + (h * 0.24 * scale)

    # Stylized left wing
    draw.polygon([
        (cx, tip_y),
        (left_x, base_y),
        (left_x + w * 0.12 * scale, base_y),
        (cx, tip_y + h * 0.18 * scale),
    ], fill=(255, 255, 255, 255))

    # Stylized right wing
    draw.polygon([
        (cx, tip_y),
        (right_x, base_y),
        (right_x - w * 0.12 * scale, base_y),
        (cx, tip_y + h * 0.18 * scale),
    ], fill=(0, 240, 255, 255))

    # Crossbar aerodynamic wing
    bar_y = cy + (h * 0.06 * scale)
    bar_h = h * 0.07 * scale
    draw.polygon([
        (cx - w * 0.20 * scale, bar_y + bar_h),
        (cx + w * 0.20 * scale, bar_y + bar_h),
        (cx + w * 0.16 * scale, bar_y),
        (cx - w * 0.16 * scale, bar_y),
    ], fill=(245, 158, 11, 255)) # amber/gold accent

    # Center glowing jewel / cockpit core
    core_r = w * 0.04 * scale
    draw.ellipse(
        [cx - core_r, cy - core_r, cx + core_r, cy + core_r],
        fill=(255, 255, 255, 255)
    )

    # Downsample with Lanczos filtering for crisp edges
    resampled = img.resize((size, size), Image.Resampling.LANCZOS)
    return resampled

def main():
    repo_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    icons_dir = os.path.join(repo_root, "public", "assets", "icons")
    os.makedirs(icons_dir, exist_ok=True)
    print(f"🏎️ Generating PWA Icons in: {icons_dir}")

    # 1. 192x192 Standard Icon
    icon192 = draw_apex_icon(192, maskable=False)
    icon192.save(os.path.join(icons_dir, "icon-192.png"), "PNG")
    print("  ✓ Created icon-192.png")

    # 2. 512x512 Standard Icon
    icon512 = draw_apex_icon(512, maskable=False)
    icon512.save(os.path.join(icons_dir, "icon-512.png"), "PNG")
    print("  ✓ Created icon-512.png")

    # 3. 512x512 Maskable Icon (safe zone padded)
    icon_maskable = draw_apex_icon(512, maskable=True)
    icon_maskable.save(os.path.join(icons_dir, "icon-maskable-512.png"), "PNG")
    print("  ✓ Created icon-maskable-512.png")

    # 4. Apple Touch Icon (180x180)
    apple_icon = draw_apex_icon(180, maskable=False)
    apple_icon.save(os.path.join(icons_dir, "apple-touch-icon.png"), "PNG")
    print("  ✓ Created apple-touch-icon.png")

    # 5. Multi-size favicon.ico (16, 32, 48)
    ico_16 = draw_apex_icon(16, maskable=False)
    ico_32 = draw_apex_icon(32, maskable=False)
    ico_48 = draw_apex_icon(48, maskable=False)
    ico_path = os.path.join(icons_dir, "favicon.ico")
    ico_32.save(ico_path, format="ICO", sizes=[(16, 16), (32, 32), (48, 48)])
    # Also place a copy at public/favicon.ico for standard browser queries
    public_ico = os.path.join(repo_root, "public", "favicon.ico")
    ico_32.save(public_ico, format="ICO", sizes=[(16, 16), (32, 32), (48, 48)])
    print("  ✓ Created favicon.ico (multi-resolution 16/32/48)")

    print("🎉 All PWA icons generated successfully!")

if __name__ == "__main__":
    main()
