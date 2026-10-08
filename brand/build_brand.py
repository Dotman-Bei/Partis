"""Generates the Partis logo files in this folder.

The mark is hand-drawn geometry (below). The wordmark is "partis" set in Inter Black
(SIL Open Font License), converted to outlines, tracked tight, with the dot of the "i"
replaced by the same square stub used in the mark.

    pip install fonttools
    python brand/build_brand.py /path/to/Inter-Black.ttf   # from github.com/rsms/inter releases

Every SVG is pure paths: no fonts, gradients, filters or effects.
"""

import sys
from pathlib import Path

from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont

OUT = Path(__file__).parent

YELLOW = "#ffd400"
INK = "#080808"
PAPER = "#f7f7f2"

# ---------------------------------------------------------------------------- mark
# 64-unit grid. A heavy P (stem 14u, bowl r16) whose counter is a round punch hole,
# with the detached square "stub" — the part torn off when a pass is admitted.
MARK_BOX = (13, 8, 38, 48)  # x, y, w, h of the drawn mark inside the 64 grid
MARK_P = (
    "M16 8H35a16 16 0 0 1 0 32h-8v13a3 3 0 0 1-3 3h-8a3 3 0 0 1-3-3V11a3 3 0 0 1 3-3Z"
    "M28 24a7 7 0 1 0 14 0a7 7 0 1 0-14 0Z"  # punch hole (even-odd)
)
MARK_STUB = "M40 46h8a3 3 0 0 1 3 3v4a3 3 0 0 1-3 3h-8a3 3 0 0 1-3-3v-4a3 3 0 0 1 3-3Z"


def mark_paths(p_fill: str, stub_fill: str) -> str:
    return (
        f'<path fill="{p_fill}" fill-rule="evenodd" d="{MARK_P}"/>'
        f'<path fill="{stub_fill}" d="{MARK_STUB}"/>'
    )


def svg(view_w: float, view_h: float, body: str, title: str) -> str:
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {_num(view_w)} {_num(view_h)}" '
        f'role="img" aria-label="{title}"><title>{title}</title>{body}</svg>\n'
    )


# ------------------------------------------------------------------------ wordmark
TRACKING_EM = -0.04  # same tight tracking the UI uses for headings


def wordmark(font_path: str):
    """Returns (path_d_letters, stub_rect, width, height) in a y-down box with 0 at cap top."""
    font = TTFont(font_path)
    gs = font.getGlyphSet()
    cmap = font.getBestCmap()
    upm = font["head"].unitsPerEm
    hmtx = font["hmtx"]

    # Size so that the x-height is 100 units; everything else scales from that.
    x_height = font["OS/2"].sxHeight
    scale = 100 / x_height
    track = TRACKING_EM * upm

    # Where Inter puts the dot of "i", so our square sits at the same height.
    i_bounds = BoundsPen(gs)
    gs[cmap[ord("i")]].draw(i_bounds)
    dotless = BoundsPen(gs)
    gs["dotlessi"].draw(dotless)
    _, _, _, dot_top = i_bounds.bounds
    stem_l, _, stem_r, _ = dotless.bounds
    stem_w = stem_r - stem_l

    ascent = dot_top  # top of the box = top of the i-dot
    descent = -_glyph_bounds(gs, cmap[ord("p")])[1]  # bottom of the box = "p" descender

    pen = SVGPathPen(gs, ntos=_num)
    x = 0.0
    stub = None
    for ch in "partis":
        name = "dotlessi" if ch == "i" else cmap[ord(ch)]
        # font units (y-up) -> logo units (y-down, origin at dot top)
        t = TransformPen(pen, (scale, 0, 0, -scale, x * scale, ascent * scale))
        gs[name].draw(t)
        if ch == "i":
            side = stem_w  # square as wide as the stem
            stub = ((x + stem_l) * scale, 0.0, side * scale, side * scale)
        x += hmtx[name][0] + track
    width = (x - track) * scale
    height = (ascent + descent) * scale
    return pen.getCommands(), stub, width, height


def _num(v: float) -> str:
    return f"{v:.2f}".rstrip("0").rstrip(".")


def _glyph_bounds(gs, name):
    b = BoundsPen(gs)
    gs[name].draw(b)
    return b.bounds


def rounded_rect(x, y, w, h, r):
    return (
        f"M{x + r:.2f} {y:.2f}h{w - 2 * r:.2f}a{r} {r} 0 0 1 {r} {r}v{h - 2 * r:.2f}"
        f"a{r} {r} 0 0 1 -{r} {r}h-{w - 2 * r:.2f}a{r} {r} 0 0 1 -{r} -{r}v-{h - 2 * r:.2f}"
        f"a{r} {r} 0 0 1 {r} -{r}Z"
    )


def main(font_path: str):
    letters, (sx, sy, sw, sh), ww, wh = wordmark(font_path)
    stub_r = round(sw * 3 / 14, 2)  # same corner ratio as the mark's stub (3 on 14)
    stub_d = rounded_rect(sx, sy, sw, sh, stub_r)

    def word(letter_fill, stub_fill, dx=0.0, dy=0.0):
        g = f'<g transform="translate({dx:.2f} {dy:.2f})">' if (dx or dy) else "<g>"
        return (
            f'{g}<path fill="{letter_fill}" d="{letters}"/>'
            f'<path fill="{stub_fill}" d="{stub_d}"/></g>'
        )

    files = {}

    # Mark — colour + monochrome, transparent background.
    files["partis-mark.svg"] = svg(64, 64, mark_paths(YELLOW, YELLOW), "Partis")
    files["partis-mark-black.svg"] = svg(64, 64, mark_paths(INK, INK), "Partis")
    files["partis-mark-white.svg"] = svg(64, 64, mark_paths("#ffffff", "#ffffff"), "Partis")

    # App icon / favicon tiles.
    files["partis-icon.svg"] = svg(
        64, 64, f'<rect width="64" height="64" rx="14" fill="{INK}"/>' + mark_paths(YELLOW, YELLOW), "Partis"
    )
    files["partis-icon-yellow.svg"] = svg(
        64, 64, f'<rect width="64" height="64" rx="14" fill="{YELLOW}"/>' + mark_paths(INK, INK), "Partis"
    )

    # Wordmark.
    files["partis-wordmark.svg"] = svg(ww, wh, word(PAPER, YELLOW), "Partis")  # for dark backgrounds
    files["partis-wordmark-black.svg"] = svg(ww, wh, word(INK, INK), "Partis")
    files["partis-wordmark-white.svg"] = svg(ww, wh, word("#ffffff", "#ffffff"), "Partis")

    # Horizontal lockup: mark height = wordmark box height; gap = one mark stem.
    mark_scale = wh / MARK_BOX[3]
    mark_w = MARK_BOX[2] * mark_scale
    gap = 14 * mark_scale
    lock_w = mark_w + gap + ww
    mark_g = (
        lambda p, s: f'<g transform="translate({-MARK_BOX[0] * mark_scale:.2f} {-MARK_BOX[1] * mark_scale:.2f}) '
        f'scale({mark_scale:.4f})">{mark_paths(p, s)}</g>'
    )
    files["partis-lockup.svg"] = svg(
        lock_w, wh, mark_g(YELLOW, YELLOW) + word(PAPER, YELLOW, mark_w + gap), "Partis"
    )
    files["partis-lockup-black.svg"] = svg(lock_w, wh, mark_g(INK, INK) + word(INK, INK, mark_w + gap), "Partis")
    files["partis-lockup-white.svg"] = svg(
        lock_w, wh, mark_g("#ffffff", "#ffffff") + word("#ffffff", "#ffffff", mark_w + gap), "Partis"
    )

    for name, content in files.items():
        (OUT / name).write_text(content)
        print(f"wrote brand/{name}")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
