# Atelier design system

Source of truth: `app/src/design/tokens.css`. Live reference: run the app and open `/#design`.
Light theme only (the inspo in `logo_inspo/inspo/` is light, and the chart palette is validated for light).

## Brand
- Logo: `app/public/logo.png` (lime wordmark, transparent). Only ever on purple, inside the ellipse logo block.
- Favicon and hero mark: `app/public/ellipse.png`.
- Do not describe the product with a tagline in the UI.

## Color hierarchy
1. **Purple `--purple-700` #3c204f**: primary actions, logo block, slides, email header. One primary button per view.
2. **Ink `--ink` / `--muted`**: all text. Text never wears a pastel or a chart color.
3. **Pastel tints** (`--tint-lavender|sky|mint|peach|pink|butter`): card and tile fills only. Same segment, same tint everywhere.
4. **Chart marks** (`--seg-*`): validated categorical palette, fixed order: Champions purple, Loyal blue, New green, At risk orange, Hibernating magenta.
5. **Page washes** (`--wash-*`) behind the glass.
- Brand lime `--lime-200` is for the wordmark on purple only. UI warmth comes from `--tint-butter` and `--cream-100`, not from lime.
- Use `--border-strong` on inputs and anything that must stand out on glass.

## Glass
`--glass` fill, `--glass-blur`, `--glass-border`, `--shadow`. Cards use `.card`. Tinted cards mix a tint into the glass with `color-mix`.

## Typography
- Sans (Inter/system) for UI and body, Georgia for headings and big numbers (matches the wordmark).
- Scale, ratio 1.25, rem units: xs .75 (12px floor) / sm .875 / md 1 / lg 1.25 / xl 1.5625 / 2xl 1.953 / stat 2.441.
- Body 16px at line-height 1.6. Secondary 14px at 1.5. Headings 1.2. Stat numbers 1.1.
- Weights 400 / 500 / 600 only. Captions are uppercase with +0.04em tracking.
- Prose max width 65ch. Never set a one-off font size: use a token.

## Space and shape
4px base (`--space-1` to `--space-6`). Radii: sm 12, md 20, lg 28, pill. Logo block is an ellipse.

## Layout
Left glass sidebar with icons is the main menu. On narrow screens it becomes a strip above the content. Content max width 1180px.

## Charts
Inline SVG in `components/Charts.jsx`: thin bars with rounded data end, 2px gaps in the donut, value at the bar tip, hover tooltip, legend, and a Table toggle on every chart.
