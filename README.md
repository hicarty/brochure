# Cluster Proposal Generator

Turns a JSON content brief into a polished, slide-style client proposal PDF — 16:9 landscape decks with per-brand visual themes, an enforced 8-page budget, and an LLM prompt template for drafting the content in the first place.

Built for UK software consultancies (Cluster Technology and sister brands) working across web and embedded/cyber-physical systems. The repository includes both Node.js and Python PDF generation.

## What it does

- **Renders proposal PDFs from JSON** — cover, brief, response, timeframe, costing, staffing, portfolio and closing pages, laid out with `pdf-lib`.
- **Multi-brand theming** — five brands ship out of the box, each mapped to a colour/type/layout theme with its own page archetype.
- **Enforces an 8-page budget** — the page planner keeps required pages (cover, brief, response, timeframe) and drops optional ones in a defined priority order.
- **Interactive or scripted CLI** — pass `--brand`/`--theme` flags, or omit them and pick from an interactive menu.
- **LLM-ready workflow** — `PROMPT_TEMPLATE` generates strict instructions for an LLM to produce valid `ProposalContent` JSON from a client brief.
- **Usable as a library** — `generateProposalPdf`, `A4BrochureGenerator`, `planPages`, theme helpers and types are exported from `src/index.ts`.
- **A4 brochure generators** — `brochure.py` (Python/ReportLab) and the `A4BrochureGenerator` class in `src/generator.ts` (Node.js/`pdf-lib`) generate seven-page branded brochures.
- **Python PowerPoint helpers** — `python/integrate_theme.py` uses `python-pptx` for 16:9 PowerPoint pages.

## Requirements

- Node.js ≥ 18 (tested on Node 26)
- npm
- Python 3.9+ — for the Python brochure and PowerPoint helpers

## Getting started

```bash
npm install
```

No environment variables, API keys or network access are required.

## Usage

### Render a proposal

```bash
npx tsx src/index.ts <content.json> <output.pdf> [--brand <slug>] [--theme <id>] [--pick-theme]
```

Examples:

```bash
# Explicit brand
npx tsx src/index.ts examples/playprouk.json output/PlayProUK_Brochure.pdf --brand playprouk

# Explicit theme
npx tsx src/index.ts examples/smart-meter.json output/SmartMeter.pdf --theme smart-meter

# No flags — interactive brand menu on stdin (default: cluster)
npx tsx src/index.ts examples/playprouk.json output/Proposal.pdf
```

Running with no arguments prints usage help.

### Render the A4 brochure with Node.js

The object-oriented Node brochure generator is based on the branded A4 brochure in `brochure.py`. The PDF libraries are named:

- **Python:** ReportLab, installed from PyPI as `reportlab` and imported from `reportlab`.
- **Node.js:** `pdf-lib`, installed from npm as `pdf-lib` and imported from `'pdf-lib'`. The repository uses this existing dependency; `pdfgenjs` is not an npm package.

```bash
npm run brochure -- [--brand cluster|playprouk|smart-meter] [--output <path>]
```

Examples:

```bash
# Generate the default Cluster Technology brochure
npm run brochure

# Select a brand and output path
npm run brochure -- --brand playprouk --output output/PlayProUK_Brochure.pdf

# Show CLI options
npm run brochure -- --help
```

By default, PDFs are written to `output/<brand>_Brochure.pdf`. The output directory is created automatically. The Node and Python brochure generators support `cluster`, `playprouk`, and `smart-meter`.

### Brands and themes

| Brand slug (`--brand`) | Theme (`--theme`) |
|---|---|
| `cluster` (default) | `cluster` |
| `playprouk` | `playprouk` |
| `smart-meter` | `smart-meter` |
| `integrate` | `integrate` |
| `spine-blob` | `spine-blob` |

Brands live in `src/brands/registry.ts`; themes live in `src/themes/*.ts`.

### Run the tests

```bash
npm test
```

A smoke test that renders three PDFs from the examples and cleans up after itself.

### Type check

```bash
npx tsc --noEmit
```

### Render the A4 brochure with Python

```bash
pip install reportlab python-pptx
python brochure.py --brand cluster
python brochure.py --brand playprouk --output output/PlayProUK_Brochure.pdf
```

The Python generator uses ReportLab. Python is also required for the `python/` PowerPoint helper scripts, which use `python-pptx`.

## Content file

Content is a single JSON file matching the `ProposalContent` interface in `src/types.ts`:

- `currencySymbol`, `vatRate`
- `cover` — title, strapline, about, optional `dayRate`, cover tiles
- `brief` — 60–90 word summary, mission/vision/purpose, differentiators
- `response` — up to 6 service cards (+ optional secondary cards and tech tag chips)
- `timeframe` — phase table, parallel tracks, management activities
- `staffing` — roles × tier × day-rate × days, grouped by `WorkStream`
- `costing` — phases, man-days, fees (auto-dropped if the cover has a `dayRate`)
- `portfolio?` — up to 4 case-study items (first to be dropped when over budget)
- `closing?` — next steps, contact, numbered steps, commercial terms

Worked examples are in [`examples/`](examples/), and rendered sample PDFs are in [`output/`](output/).

### Drafting content with an LLM

`src/prompt.ts` exports `PROMPT_TEMPLATE(brandName)` — feed the client brief plus this template to an LLM and it will return raw `ProposalContent` JSON ready to render. `BROCHURE_WORKFLOW` and `promptForBrand(slug)` cover the intake step (pick a brand first).

## Page budget

`MAX_PAGES = 8` (see `src/generator.ts`). The cover, brief, response and timeframe pages are always kept; optional pages are dropped in this order when over budget:

1. Portfolio
2. Staffing / work-item breakdown
3. Closing
4. Costing (only if not required)

## Project structure

```
src/
  index.ts            JSON proposal CLI + library exports
  types.ts            ProposalContent schema
  prompt.ts           LLM prompt template + workflow
  generator.ts        Proposal and A4 brochure generators
  pages.ts            One draw function per page type
  draw.ts             Low-level drawing primitives
  fonts.ts            Font embedding (Helvetica fallback)
  theme.ts            Theme registry / brand→theme lookup
  brands/registry.ts  Brand definitions
  themes/             Theme definitions + page archetypes
examples/             Sample content JSON
output/               Rendered sample PDFs
docs/                 Deck theme design-system spec
brochure.py           Python A4 brochure generator (ReportLab)
python/               python-pptx theme helpers
brand-guidelines.md   How to add/rebrand themes
```

## Adding a brand or theme

See [`brand-guidelines.md`](brand-guidelines.md) for the full walkthrough — it covers theme fields (colours, font roles, type scale, layout), logo replacement, and the brand registry. The design system itself is specified in [`docs/deck-theme-spec.md`](docs/deck-theme-spec.md).

## License

ISC
