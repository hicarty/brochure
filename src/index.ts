/**
 * index.ts
 * -----------------------------------------------------------------------
 * Public exports + a small CLI:
 *
 *   npx tsx src/index.ts <content.json> <output.pdf> [--brand <slug>]
 *
 * content.json must match the ProposalContent interface in types.ts
 * (see prompt.ts for the instructions to hand an LLM, and
 * examples/playprouk.json for a worked example).
 *
 * --brand selects a registered brand (uses its linked theme).
 * --theme selects a theme id directly (overrides brand default).
 * If neither is given, the CLI lists options and prompts on stdin.
 * -----------------------------------------------------------------------
 */

import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { generateProposalPdf, MAX_PAGES } from './generator';
import {
  CLUSTER_THEME,
  THEMES,
  getTheme,
  getThemeForBrand,
  listBrandDefinitions,
} from './theme';
import { ProposalContent } from './types';
import {
  formatBrandMenuForCli,
  resolveBrandOrTheme,
  themeSelectionPrompt,
} from './brochure-intake';

export * from './types';
export * from './theme';
export { generateProposalPdf, planPages, MAX_PAGES } from './generator';
export {
  PROMPT_TEMPLATE,
  promptForBrand,
  BROCHURE_WORKFLOW,
} from './prompt';
export {
  themeSelectionPrompt,
  listThemeChoices,
  resolveBrandOrTheme,
  formatBrandMenuForCli,
} from './brochure-intake';

function parseArgs(args: string[]) {
  const positional = args.filter((a) => !a.startsWith('--'));
  const inputPath = positional[0];
  const outputPath = positional[1];
  const brandIdx = args.indexOf('--brand');
  const themeIdx = args.indexOf('--theme');
  const brand =
    brandIdx >= 0 && args[brandIdx + 1] ? args[brandIdx + 1] : undefined;
  const themeId =
    themeIdx >= 0 && args[themeIdx + 1] ? args[themeIdx + 1] : undefined;
  const pickInteractive = args.includes('--pick-theme');
  return { inputPath, outputPath, brand, themeId, pickInteractive };
}

async function promptBrandSlug(): Promise<string> {
  const brands = listBrandDefinitions();
  console.log('\nSelect a brand for this proposal:\n');
  console.log(formatBrandMenuForCli());
  console.log('');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const answer = await new Promise<string>((resolve) => {
    rl.question(
      `Enter number (1–${brands.length}) or brand slug [cluster]: `,
      (line) => {
        rl.close();
        resolve(line.trim());
      }
    );
  });

  if (!answer) return 'cluster';
  const asNum = parseInt(answer, 10);
  if (!Number.isNaN(asNum) && asNum >= 1 && asNum <= brands.length) {
    return brands[asNum - 1].id;
  }
  return answer;
}

async function main() {
  const rawArgs = process.argv.slice(2);
  let { inputPath, outputPath, brand, themeId, pickInteractive } =
    parseArgs(rawArgs);

  if (!inputPath || !outputPath) {
    console.error(
      'Usage: tsx src/index.ts <content.json> <output.pdf> [--brand <slug>] [--theme <id>] [--pick-theme]\n\n' +
        formatBrandMenuForCli() +
        '\n\nThemes: cluster, integrate, spine-blob, playprouk, smart-meter\n' +
        'Default brand: cluster'
    );
    process.exit(1);
  }

  if (pickInteractive && !brand && !themeId) {
    console.log(themeSelectionPrompt());
  }

  if (!brand && !themeId) {
    brand = await promptBrandSlug();
  }

  if (themeId && !THEMES[themeId]) {
    console.warn(`Unknown theme "${themeId}" — falling back to cluster.`);
  }
  if (brand && !resolveBrandOrTheme(brand).brandId && brand !== 'cluster') {
    console.warn(`Unknown brand "${brand}" — falling back to cluster theme.`);
  }

  const theme = themeId
    ? getTheme(themeId)
    : brand
      ? getThemeForBrand(brand)
      : CLUSTER_THEME;

  const raw = fs.readFileSync(path.resolve(inputPath), 'utf-8');
  const content: ProposalContent = JSON.parse(raw);

  const { pdfBytes, pageCount, droppedSections } = await generateProposalPdf(
    content,
    theme
  );

  fs.writeFileSync(path.resolve(outputPath), pdfBytes);

  const brandLabel = brand ?? theme.id;
  console.log(
    `Wrote ${outputPath} (${pageCount}/${MAX_PAGES} pages, brand/theme: ${brandLabel} → ${theme.name}).`
  );
  if (droppedSections.length) {
    console.warn(
      `Dropped to stay within the ${MAX_PAGES}-page budget: ${droppedSections.join(', ')}`
    );
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
