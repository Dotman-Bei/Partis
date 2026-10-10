# Partis logo

**The idea: the admitted pass.** A heavy **P**, for Partis and pass. Its counter is a round
**punch hole**, because the pass was checked. Beneath the bowl sits a detached square
**stub**, the part torn off when you're let in. The stub also fills the P's empty corner, so
the mark holds together as one square glyph even at 16px.

The wordmark is "partis" in Inter Black (outlined), tracked tight, with the dot of the "i"
replaced by the same square stub, so the mark and the wordmark share one detail.

## Files

All SVGs are pure vector paths: no fonts, gradients, filters or effects.

| Asset | Colour (dark backgrounds) | Black | White |
|---|---|---|---|
| Mark | `partis-mark.svg` | `partis-mark-black.svg` | `partis-mark-white.svg` |
| Wordmark | `partis-wordmark.svg` | `partis-wordmark-black.svg` | `partis-wordmark-white.svg` |
| Lockup (mark + wordmark) | `partis-lockup.svg` | `partis-lockup-black.svg` | `partis-lockup-white.svg` |
| App icon / favicon | `partis-icon.svg` (yellow on black) | `partis-icon-yellow.svg` (black on yellow) | — |

- `favicon.ico`: 16, 32 and 48px in one file.
- `png/`: transparent PNG exports. Icons at 16–512px, marks at 512px, lockups 240px tall.
- `build_brand.py`: regenerates every SVG from the source geometry and Inter Black.

On light backgrounds use the **black** versions. Yellow on white is too low-contrast.

## Colour

| Name | Hex | Use |
|---|---|---|
| Signal yellow | `#ffd400` | the mark, the stub, primary actions |
| Ink | `#080808` | backgrounds, the mark on yellow |
| Paper | `#f7f7f2` | the wordmark on dark backgrounds |

These are the same tokens as the app (`web/src/app/globals.css`).

## Spacing and size

- **Clear space:** keep at least one **stem width** (the width of the P's upright, 14 of the
  mark's 64 units) empty on every side.
- **Minimum size:** mark 16px; lockup 20px tall; wordmark alone 14px tall.
- Below 24px, use the icon tile (`partis-icon.svg`) rather than the bare mark, so it reads on
  both light and dark browser tabs.

## Don't

- Don't reattach the stub to the P or move it. Its gap is the idea.
- Don't fill the punch hole or swap it for another shape.
- Don't add gradients, outlines, shadows or glows, and don't recolour beyond the table above.
- Don't retype the wordmark in a live font. Use the outlined files.
- Don't stretch, rotate or set the mark inside other shapes than the rounded square tile.

## Pass art

Pass images are drawn on-chain by `PartisPassRenderer`, which embeds this mark and the outlined
wordmark (`_brand()` in `contracts/src/PartisPassRenderer.sol`). The current testnet renderer is
`0x17411D09105d3276B75a5423ecE3494814050f87`. The first testnet deployment (`0x0405b784346330f690c85A559ba4C2B05e610650`) predates the logo and is retired.

Inter is © The Inter Project Authors, SIL Open Font License 1.1.
