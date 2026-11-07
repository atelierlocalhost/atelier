# Atelier design system

Source of truth: `app/src/design/tokens.css`. Live reference: run the app and open `/#design`.

## Brand
- Logo: `app/public/logo.png` (lime wordmark, transparent). Use it only on purple.
- Favicon: `app/public/ellipse.png` (the purple ellipse).
- Originals in `logo_inspo/`.

## Color
| Token | Value | Use |
|---|---|---|
| `--purple-700` | #3c204f | Brand purple: header band, buttons, slides |
| `--lime-200` | #ebf2ca | Brand lime: text on purple, highlights |
| `--bg` / `--surface` | lime-100 / white | Page and card backgrounds (dark mode: purple-900 / purple-800) |
| `--ink` / `--muted` | #2b1838 / #6f6479 | Text and helper text |
| `--good` / `--bad` / `--hl` | green / mauve / yellow-lime tints | Callouts, memory highlights |
| `--danger` | #b3261e | Errors only |

Never hardcode a hex in a component. Use a token. Dark mode swaps the semantic tokens only.

## Type
Georgia everywhere. Scale: xs .75, sm .85, md 1, lg 1.3, xl 2 rem. Headings are regular weight, not bold.

## Space and shape
4px base: `--space-1` to `--space-6` (4, 8, 12, 16, 24, 48). Radii: sm 8 (buttons), md 12 (cards), lg 16 (header), pill.

## Components (classes in `src/index.css`)
- `.btn`, `.btn.primary`: one primary button per view.
- `.card` (+ `.good`, `.bad`, `.memory`): all panels.
- `.pill` (+ `.alt`, `.ok`): tags and status.
- `.tab` / `.tab.active`: top navigation.
- `.slide`: 4:5 social carousel card, purple with lime text.
- `.brandbar`: purple header with logo.

## Rules
- Contrast: lime on purple and ink on lime-100 both pass AA. Do not put the lime wordmark on light backgrounds.
- Mobile first: 16px side gutter, no horizontal page scroll. Grids use `auto-fill` / `auto-fit`.
- Store and card templates (`templates/*.html`) are standalone, so they copy the hex values. Update them when tokens change.
