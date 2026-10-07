/**
 * generator.ts
 * -----------------------------------------------------------------------
 * Orchestrates theme + fonts + content -> finished PDF bytes.
 *
 * Page budget rule (per brief): proposals must be <= 8 pages, and must
 * open with Brief -> Response -> Timeframe. Value & Costing only gets
 * its own page if a day-rate was NOT already headlined on the cover.
 * Portfolio and the staffing/work-item breakdown are included when
 * there's room; if the content would blow the budget, the lowest
 * priority optional sections are dropped and a warning is returned
 * alongside the PDF so the caller knows what was cut.
 * -----------------------------------------------------------------------
 */

import { PDFDocument } from 'pdf-lib';
import { Theme, CLUSTER_THEME } from './theme';
import { ProposalContent } from './types';
import { embedThemeFonts } from './fonts';
import {
  drawCoverPage,
  drawBriefPage,
  drawResponsePage,
  drawPortfolioPage,
  drawTimeframePage,
  drawStaffingPage,
  drawCostingPage,
  drawClosingPage,
} from './pages';

export const MAX_PAGES = 8;

type PageKind =
  | 'cover'
  | 'brief'
  | 'response'
  | 'portfolio'
  | 'timeframe'
  | 'staffing'
  | 'costing'
  | 'closing';

interface PlannedPage {
  kind: PageKind;
  /** Required pages are never dropped; only 'optional' ones are cut
   *  under budget pressure, in the order listed here (last cut first). */
  required: boolean;
}

export interface PlanResult {
  pages: PlannedPage[];
  dropped: PageKind[];
}

/** Decides which pages to render, enforcing the 8-page ceiling. */
export function planPages(content: ProposalContent): PlanResult {
  const plan: PlannedPage[] = [
    { kind: 'cover', required: true },
    { kind: 'brief', required: true },
    { kind: 'response', required: true },
    { kind: 'timeframe', required: true },
  ];

  // Costing gets a dedicated page only when the cover didn't already
  // headline a day-rate.
  const needsCostingPage = !content.cover.dayRate && !!content.costing;
  if (needsCostingPage) plan.push({ kind: 'costing', required: true });

  if (content.staffing?.lines?.length) {
    plan.push({ kind: 'staffing', required: false });
  }
  if (content.portfolio?.items?.length) {
    plan.push({ kind: 'portfolio', required: false });
  }
  plan.push({ kind: 'closing', required: false });

  // Drop optional pages, lowest priority first, until we fit the budget.
  // Priority (keep longest): closing > staffing > portfolio
  const dropOrder: PageKind[] = ['portfolio', 'staffing', 'closing'];
  const dropped: PageKind[] = [];
  let ordered = plan;

  for (const candidate of dropOrder) {
    if (ordered.length <= MAX_PAGES) break;
    const idx = ordered.findIndex((p) => p.kind === candidate && !p.required);
    if (idx >= 0) {
      dropped.push(ordered[idx].kind);
      ordered = ordered.filter((_, i) => i !== idx);
    }
  }

  return { pages: ordered, dropped };
}

export interface GenerateResult {
  pdfBytes: Uint8Array;
  pageCount: number;
  droppedSections: PageKind[];
}

export async function generateProposalPdf(
  content: ProposalContent,
  theme: Theme = CLUSTER_THEME
): Promise<GenerateResult> {
  const { pages: plan, dropped } = planPages(content);

  const doc = await PDFDocument.create();
  doc.setTitle(`${content.cover.projectTitle} — ${theme.name} Proposal`);
  doc.setSubject(content.cover.strapline);
  doc.setProducer(`${theme.name} Proposal Generator`);

  const fonts = await embedThemeFonts(doc, theme);

  // Section numbering only counts the numbered "N. Title" pages
  // (cover and closing aren't numbered, matching the source deck).
  const numberedKinds: PageKind[] = [
    'brief',
    'response',
    'portfolio',
    'timeframe',
    'staffing',
    'costing',
  ];
  let sectionCounter = 0;
  const totalPages = plan.length;

  plan.forEach((planned, index) => {
    const page = doc.addPage([theme.layout.pageWidth, theme.layout.pageHeight]);
    const pageNumber = index + 1;
    if (numberedKinds.includes(planned.kind)) sectionCounter += 1;

    switch (planned.kind) {
      case 'cover':
        drawCoverPage(page, theme, fonts, content);
        break;
      case 'brief':
        drawBriefPage(page, theme, fonts, content, sectionCounter, pageNumber, totalPages);
        break;
      case 'response':
        drawResponsePage(page, theme, fonts, content, sectionCounter, pageNumber, totalPages);
        break;
      case 'portfolio':
        drawPortfolioPage(page, theme, fonts, content, sectionCounter, pageNumber, totalPages);
        break;
      case 'timeframe':
        drawTimeframePage(page, theme, fonts, content, sectionCounter, pageNumber, totalPages);
        break;
      case 'staffing':
        drawStaffingPage(page, theme, fonts, content, sectionCounter, pageNumber, totalPages);
        break;
      case 'costing':
        drawCostingPage(page, theme, fonts, content, sectionCounter, pageNumber, totalPages);
        break;
      case 'closing':
        drawClosingPage(page, theme, fonts, content, sectionCounter, pageNumber, totalPages);
        break;
    }
  });

  const pdfBytes = await doc.save();
  return { pdfBytes, pageCount: plan.length, droppedSections: dropped };
}
