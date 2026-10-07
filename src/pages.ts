/**
 * pages.ts
 * -----------------------------------------------------------------------
 * One function per slide/page type. Each takes the PDFPage, the theme,
 * the embedded fonts, and the relevant slice of ProposalContent, and
 * draws that single page. generator.ts decides WHICH of these run and
 * in what order, based on the 8-page budget.
 * -----------------------------------------------------------------------
 */

import { PDFPage } from 'pdf-lib';
import { Theme } from './theme';
import { EmbeddedFonts } from './fonts';
import {
  drawParagraph,
  drawBulletList,
  drawLogo,
  drawConfidentialRail,
  drawFooter,
  drawSectionHeader,
  drawTable,
  drawTagChips,
  formatCurrency,
  TableColumn,
} from './draw';
import {
  ProposalContent,
  StaffLine,
  WorkStream,
  CoverTile,
  Differentiator,
  StepItem,
  CommercialTerm,
} from './types';

// ---------------------------------------------------------------------
// 1. COVER
// ---------------------------------------------------------------------
export function drawCoverPage(
  page: PDFPage,
  theme: Theme,
  fonts: EmbeddedFonts,
  content: ProposalContent
): void {
  const { pageWidth, pageHeight } = theme.layout;
  const darkPanelWidth = pageWidth * 0.34;

  page.drawRectangle({
    x: 0,
    y: 0,
    width: pageWidth,
    height: pageHeight,
    color: theme.colors.background,
  });
  // Dark accent panel, left-hand side (stands in for the swoosh artwork
  // in the source deck — swap for a full-bleed brand image if desired)
  page.drawRectangle({
    x: 0,
    y: 0,
    width: darkPanelWidth,
    height: pageHeight,
    color: theme.colors.navyDark,
  });
  page.drawRectangle({
    x: darkPanelWidth - 6,
    y: 0,
    width: 6,
    height: pageHeight,
    color: theme.colors.cyan,
  });

  drawLogo(page, pageWidth - 210, pageHeight - 46, theme, fonts.headingBold, {
    size: 13,
  });

  const textX = darkPanelWidth + 56;
  let y = pageHeight - 170;

  page.drawText(content.cover.projectTitle, {
    x: textX,
    y,
    size: theme.type.coverTitle,
    font: fonts.headingBold,
    color: theme.colors.navy,
  });
  y -= theme.type.coverTitle + 14;

  y = drawParagraph(page, content.cover.strapline, textX, y, {
    font: fonts.subheading,
    size: theme.type.coverSubtitle,
    color: theme.colors.navy,
    maxWidth: pageWidth - textX - 60,
    lineHeight: 1.5,
  });

  if (content.about) {
    y -= 26;
    page.drawText(content.about.heading.toUpperCase(), {
      x: textX,
      y,
      size: theme.type.caption,
      font: fonts.subheading,
      color: theme.colors.slateBlue,
    });
    y = drawParagraph(page, content.about.body, textX, y - 16, {
      font: fonts.paragraph,
      size: theme.type.body,
      color: theme.colors.text,
      maxWidth: pageWidth - textX - 100,
      lineHeight: 1.5,
    });
  }

  if (content.cover.dayRate) {
    y -= 30;
    page.drawText(
      `${formatCurrency(content.cover.dayRate, content.currencySymbol)} day-rate`,
      {
        x: textX,
        y,
        size: theme.type.coverStat,
        font: fonts.headingBold,
        color: theme.colors.navy,
      }
    );
  }

  // Footer block on the dark panel
  page.drawText(`Prepared for: ${content.cover.preparedFor}`, {
    x: 40,
    y: 56,
    size: 9,
    font: fonts.paragraph,
    color: theme.colors.textOnDark,
  });
  page.drawText(`Contact: ${content.cover.contactEmail}`, {
    x: 40,
    y: 40,
    size: 9,
    font: fonts.paragraph,
    color: theme.colors.textOnDark,
  });

  // Cover tiles (SIC, insured, operates, trading entity, etc.)
  if (content.coverTiles && content.coverTiles.length) {
    const tileStartY = 130;
    const tileGap = 9;
    let tileY = tileStartY;
    for (const tile of content.coverTiles) {
      const labelW = fonts.paragraph.widthOfTextAtSize(tile.label.toUpperCase(), 7.5);
      const detailW = fonts.paragraph.widthOfTextAtSize(tile.detail, 9);
      const tileW = Math.max(labelW, detailW) + 24;
      page.drawRectangle({
        x: 40,
        y: tileY - 22,
        width: tileW,
        height: 22,
        color: theme.colors.cyan,
        borderColor: theme.colors.navy,
        borderWidth: 0.5,
      });
      page.drawText(tile.label.toUpperCase(), {
        x: 40 + 6,
        y: tileY - 17,
        size: 7.5,
        font: fonts.subheading,
        color: theme.colors.navy,
      });
      page.drawText(tile.detail, {
        x: 40 + 6,
        y: tileY - 28,
        size: 9,
        font: fonts.paragraph,
        color: theme.colors.white,
      });
      tileY -= 26;
    }
  }
}

// ---------------------------------------------------------------------
// Shared content-page chrome: rail + footer + numbered header.
// Returns the y coordinate where body content should start.
// ---------------------------------------------------------------------
function drawContentChrome(
  page: PDFPage,
  theme: Theme,
  fonts: EmbeddedFonts,
  sectionNumber: number,
  title: string,
  pageNumber: number,
  totalPages: number,
  contactEmail: string
): { bodyX: number; bodyY: number; bodyWidth: number } {
  const { pageWidth, pageHeight, margin, railWidth } = theme.layout;
  page.drawRectangle({
    x: 0,
    y: 0,
    width: pageWidth,
    height: pageHeight,
    color: theme.colors.background,
  });
  drawConfidentialRail(page, theme, fonts.paragraph);
  drawLogo(page, pageWidth - 190, pageHeight - 40, theme, fonts.headingBold, {
    size: 11,
  });

  const startX = railWidth + margin - 8;
  const bodyY = drawSectionHeader(
    page,
    sectionNumber,
    title,
    startX,
    pageHeight - 70,
    theme,
    { number: fonts.headingRegular, title: fonts.headingBold }
  );

  drawFooter(page, pageNumber, totalPages, theme, fonts.paragraph, contactEmail);

  return {
    bodyX: startX,
    bodyY,
    bodyWidth: pageWidth - startX - margin,
  };
}

// ---------------------------------------------------------------------
// 2. BRIEF
// ---------------------------------------------------------------------
export function drawBriefPage(
  page: PDFPage,
  theme: Theme,
  fonts: EmbeddedFonts,
  content: ProposalContent,
  sectionNumber: number,
  pageNumber: number,
  totalPages: number
): void {
  const { bodyX, bodyY, bodyWidth } = drawContentChrome(
    page,
    theme,
    fonts,
    sectionNumber,
    content.brief.heading,
    pageNumber,
    totalPages,
    content.cover.contactEmail
  );

  let y = drawParagraph(page, content.brief.body, bodyX, bodyY, {
    font: fonts.paragraph,
    size: theme.type.body + 2,
    color: theme.colors.text,
    maxWidth: bodyWidth * 0.6,
    lineHeight: 1.5,
  });

  // Mission / Vision / Purpose strip, mirroring the source deck's
  // stacked light-blue statement blocks.
  const strip = [
    { label: 'Mission', value: content.brief.mission },
    { label: 'Vision', value: content.brief.vision },
    { label: 'Purpose', value: content.brief.purpose },
  ].filter((s) => !!s.value) as { label: string; value: string }[];

  // Flow the strip beneath the main brief paragraph, using the actual
  // end-of-paragraph position each time rather than a fixed jump, so
  // three items never run off the bottom of the page.
  let stripY = y - 26;
  for (const item of strip) {
    page.drawText(item.label.toUpperCase(), {
      x: bodyX,
      y: stripY,
      size: theme.type.caption,
      font: fonts.subheading,
      color: theme.colors.slateBlue,
    });
    stripY = drawParagraph(page, item.value, bodyX, stripY - 14, {
      font: fonts.headingRegular,
      size: 13,
      color: theme.colors.slateBlue,
      maxWidth: bodyWidth * 0.55,
      lineHeight: 1.3,
    });
    stripY -= 16;
  }

  // "What makes us different" cards
  if (content.brief.differentiators && content.brief.differentiators.length) {
    const diffGap = 12;
    const diffCardW = (bodyWidth - diffGap) / 2;
    for (let i = 0; i < content.brief.differentiators.length; i++) {
      const d = content.brief.differentiators[i];
      const col = i % 2;
      const cx = bodyX + col * (diffCardW + diffGap);
      const cardH = 52;
      page.drawRectangle({
        x: cx,
        y: stripY - cardH,
        width: diffCardW,
        height: cardH,
        color: theme.colors.panel,
        borderColor: theme.colors.cyan,
        borderWidth: 0.75,
      });
      page.drawRectangle({
        x: cx,
        y: stripY - 4,
        width: 3,
        height: cardH,
        color: theme.colors.cyan,
      });
      page.drawText(d.title.toUpperCase(), {
        x: cx + 10,
        y: stripY - 16,
        size: theme.type.caption,
        font: fonts.subheading,
        color: theme.colors.navy,
      });
      drawParagraph(page, d.body, cx + 10, stripY - 28, {
        font: fonts.paragraph,
        size: theme.type.body - 2,
        color: theme.colors.text,
        maxWidth: diffCardW - 20,
        lineHeight: 1.3,
      });
      stripY -= cardH + diffGap;
    }
  }
}

// ---------------------------------------------------------------------
// 3. RESPONSE / OUR SERVICES (card grid)
// ---------------------------------------------------------------------
export function drawResponsePage(
  page: PDFPage,
  theme: Theme,
  fonts: EmbeddedFonts,
  content: ProposalContent,
  sectionNumber: number,
  pageNumber: number,
  totalPages: number
): void {
  const { bodyX, bodyY, bodyWidth } = drawContentChrome(
    page,
    theme,
    fonts,
    sectionNumber,
    content.response.heading,
    pageNumber,
    totalPages,
    content.cover.contactEmail
  );

  let y = drawParagraph(page, content.response.intro, bodyX, bodyY, {
    font: fonts.paragraph,
    size: theme.type.body,
    color: theme.colors.text,
    maxWidth: bodyWidth,
    lineHeight: 1.4,
  });
  y -= 16;

  const cards = content.response.cards.slice(0, 6); // 3x2 grid ceiling
  const columns = Math.min(3, cards.length) || 1;
  const rows = Math.ceil(cards.length / columns);
  const colGap = 20;
  const rowGap = 16;
  const cardWidth = (bodyWidth - colGap * (columns - 1)) / columns;
  // Fill remaining space down to the footer, split evenly across rows.
  const availableHeight = y - 40;
  const cardHeight = (availableHeight - rowGap * (rows - 1)) / rows;
  const gridTop = y;

  cards.forEach((card, i) => {
    const col = i % columns;
    const row = Math.floor(i / columns);
    const cx = bodyX + col * (cardWidth + colGap);
    const cyTop = gridTop - row * (cardHeight + rowGap);

    page.drawRectangle({
      x: cx,
      y: cyTop - cardHeight,
      width: cardWidth,
      height: cardHeight,
      color: theme.colors.panel,
      borderColor: theme.colors.line,
      borderWidth: 1,
    });
    page.drawRectangle({
      x: cx,
      y: cyTop - 5,
      width: cardWidth,
      height: 5,
      color: theme.colors.cyan,
    });
    page.drawText(card.title, {
      x: cx + 12,
      y: cyTop - 26,
      size: theme.type.cardTitle,
      font: fonts.headingRegular,
      color: theme.colors.navy,
    });
    const afterBodyY = drawParagraph(page, card.body, cx + 12, cyTop - 44, {
      font: fonts.paragraph,
      size: theme.type.body - 2,
      color: theme.colors.text,
      maxWidth: cardWidth - 24,
      lineHeight: 1.3,
    });
    if (card.tags && card.tags.length) {
      drawTagChips(
        page,
        card.tags,
        cx + 12,
        Math.max(afterBodyY - 4, cyTop - cardHeight + 22),
        cardWidth - 24,
        theme,
        fonts.paragraph
      );
    }
  });

  // Optional specialist services in a 2×2 grid below the main grid
  if (content.response.optionalCards && content.response.optionalCards.length) {
    y -= 20;
    const optCards = content.response.optionalCards.slice(0, 4);
    const optCols = 2;
    const optRows = Math.ceil(optCards.length / optCols);
    const optGap = 16;
    const optCardW = (bodyWidth - optGap) / optCols;
    const optAvailable = y - 40;
    const optCardH = (optAvailable - optGap * (optRows - 1)) / optRows;
    const optGridTop = y;

    optCards.forEach((card, i) => {
      const col = i % optCols;
      const row = Math.floor(i / optCols);
      const cx = bodyX + col * (optCardW + optGap);
      const cyTop = optGridTop - row * (optCardH + optGap);

      page.drawRectangle({
        x: cx,
        y: cyTop - optCardH,
        width: optCardW,
        height: optCardH,
        color: theme.colors.background,
        borderColor: theme.colors.cyan,
        borderWidth: 1.25,
      });
      page.drawRectangle({
        x: cx,
        y: cyTop - optCardH,
        width: optCardW,
        height: 4,
        color: theme.colors.cyan,
      });
      page.drawText(card.title, {
        x: cx + 10,
        y: cyTop - 20,
        size: theme.type.cardTitle,
        font: fonts.headingRegular,
        color: theme.colors.navy,
      });
      const afterBodyY = drawParagraph(page, card.body, cx + 10, cyTop - 36, {
        font: fonts.paragraph,
        size: theme.type.body - 2,
        color: theme.colors.text,
        maxWidth: optCardW - 20,
        lineHeight: 1.3,
      });
      if (card.tags && card.tags.length) {
        drawTagChips(
          page,
          card.tags,
          cx + 10,
          Math.max(afterBodyY - 2, cyTop - optCardH + 18),
          optCardW - 20,
          theme,
          fonts.paragraph
        );
      }
    });
  }
}

// ---------------------------------------------------------------------
// 4. PORTFOLIO (optional)
// ---------------------------------------------------------------------
export function drawPortfolioPage(
  page: PDFPage,
  theme: Theme,
  fonts: EmbeddedFonts,
  content: ProposalContent,
  sectionNumber: number,
  pageNumber: number,
  totalPages: number
): void {
  if (!content.portfolio) return;
  const { bodyX, bodyY, bodyWidth } = drawContentChrome(
    page,
    theme,
    fonts,
    sectionNumber,
    content.portfolio.heading,
    pageNumber,
    totalPages,
    content.cover.contactEmail
  );

  let y = bodyY;
  const items = content.portfolio.items.slice(0, 4);
  const rowGap = 16;
  const rowHeight = (bodyY - 60) / items.length - rowGap;

  for (const item of items) {
    page.drawRectangle({
      x: bodyX,
      y: y - rowHeight,
      width: 4,
      height: rowHeight,
      color: theme.colors.cyan,
    });
    const label = item.client ? `${item.title} — ${item.client}` : item.title;
    page.drawText(label, {
      x: bodyX + 14,
      y: y - 16,
      size: theme.type.cardTitle,
      font: fonts.headingRegular,
      color: theme.colors.navy,
    });
    const afterDescY = drawParagraph(page, item.description, bodyX + 14, y - 34, {
      font: fonts.paragraph,
      size: theme.type.body - 1,
      color: theme.colors.textMuted,
      maxWidth: bodyWidth - 30,
      lineHeight: 1.35,
    });
    if (item.tags && item.tags.length && content.portfolio.showTags !== false) {
      drawTagChips(
        page,
        item.tags,
        bodyX + 14,
        Math.max(afterDescY - 2, y - rowHeight + 22),
        bodyWidth - 30,
        theme,
        fonts.paragraph
      );
    }
    y -= rowHeight + rowGap;
  }
}

// ---------------------------------------------------------------------
// 5. TIMEFRAME (dark slide, matches the source deck's Timescales page)
// ---------------------------------------------------------------------
export function drawTimeframePage(
  page: PDFPage,
  theme: Theme,
  fonts: EmbeddedFonts,
  content: ProposalContent,
  sectionNumber: number,
  pageNumber: number,
  totalPages: number
): void {
  const { pageWidth, pageHeight, margin } = theme.layout;
  page.drawRectangle({
    x: 0,
    y: 0,
    width: pageWidth,
    height: pageHeight,
    color: theme.colors.navyDark,
  });

  const railWidth = 260;
  drawLogo(page, pageWidth - 190, pageHeight - 40, theme, fonts.headingBold, {
    size: 11,
    textColor: theme.colors.textOnDark,
  });

  // Left rail: numbered header + track summaries, magenta accent bar
  page.drawRectangle({
    x: 40,
    y: pageHeight - 330,
    width: 3,
    height: 220,
    color: theme.colors.magenta,
  });
  page.drawText(`${sectionNumber}.`, {
    x: 40,
    y: pageHeight - 90,
    size: theme.type.sectionNumber,
    font: fonts.headingRegular,
    color: theme.colors.white,
  });
  page.drawText(content.timeframe.heading, {
    x: 40,
    y: pageHeight - 118,
    size: theme.type.sectionTitle,
    font: fonts.headingBold,
    color: theme.colors.magenta,
  });

  let trackY = pageHeight - 170;
  for (const track of content.timeframe.tracks) {
    page.drawText(track.trackTitle, {
      x: 62,
      y: trackY,
      size: 12,
      font: fonts.headingRegular,
      color: theme.colors.cyan,
    });
    trackY -= 20;
    for (const row of track.rows) {
      page.drawText(row.label, {
        x: 62,
        y: trackY,
        size: theme.type.body - 1,
        font: fonts.paragraph,
        color: theme.colors.textOnDark,
      });
      trackY -= 15;
    }
    trackY -= 12;
  }

  // Right panel: phase / week table
  const tableX = railWidth + 40;
  const columns: TableColumn[] = [
    { header: 'Week', width: 110 },
    { header: 'Summary', width: pageWidth - railWidth - 40 - margin - 110 },
  ];
  const rows = content.timeframe.phases.map((p) => [p.weeks, p.summary]);
  drawTable(page, {
    x: tableX,
    y: pageHeight - 90,
    columns,
    rows,
    theme,
    headerFont: fonts.subheading,
    cellFont: fonts.paragraph,
  });

  page.drawText(content.timeframe.indicativeDuration, {
    x: tableX,
    y: pageHeight - 90 - 22 * (content.timeframe.phases.length + 1) - 16,
    size: theme.type.caption + 1,
    font: fonts.subheading,
    color: theme.colors.cyan,
  });

  drawFooter(page, pageNumber, totalPages, theme, fonts.paragraph, content.cover.contactEmail);
}

// ---------------------------------------------------------------------
// 6. STAFFING / WORK-ITEM BREAKDOWN
//    Groups StaffLine[] by WorkStream, shows Junior vs Senior, day-rate
//    and allocated days per role.
// ---------------------------------------------------------------------
const WORK_STREAM_ORDER: WorkStream[] = [
  'Design',
  'Development',
  'Manufacturing',
  'Manufacturing & Electronics',
  'Liaison',
  'Liaison & Management',
  'Test & Compliance',
];

function drawStreamColumn(
  page: PDFPage,
  theme: Theme,
  fonts: EmbeddedFonts,
  stream: WorkStream,
  lines: StaffLine[],
  content: ProposalContent,
  bodyX: number,
  y: number,
  colW: number,
  bodyWidth: number,
  columns: TableColumn[],
  addToTotal: (fee: number) => void
): number {
  page.drawText(stream, {
    x: bodyX,
    y: y - 4,
    size: theme.type.cardTitle,
    font: fonts.subheading,
    color: theme.colors.navy,
  });
  y -= 22;

  const rows = lines.map((l) => {
    const fee = l.dayRate * l.days;
    addToTotal(fee);
    return [
      l.role,
      l.tier,
      formatCurrency(l.dayRate, content.currencySymbol),
      String(l.days),
      formatCurrency(fee, content.currencySymbol),
    ];
  });

  const adjCols: TableColumn[] = columns.map((c) => ({
    ...c,
    width: c.width * (colW / bodyWidth),
  }));

  return drawTable(page, {
    x: bodyX,
    y,
    columns: adjCols,
    rows,
    theme,
    headerFont: fonts.subheading,
    cellFont: fonts.paragraph,
    rowHeight: 18,
  });
}

export function drawStaffingPage(
  page: PDFPage,
  theme: Theme,
  fonts: EmbeddedFonts,
  content: ProposalContent,
  sectionNumber: number,
  pageNumber: number,
  totalPages: number
): void {
  const { bodyX, bodyY, bodyWidth } = drawContentChrome(
    page,
    theme,
    fonts,
    sectionNumber,
    content.staffing.heading,
    pageNumber,
    totalPages,
    content.cover.contactEmail
  );

  const grouped: Record<string, StaffLine[]> = {};
  for (const line of content.staffing.lines) {
    grouped[line.workStream] = grouped[line.workStream] ?? [];
    grouped[line.workStream].push(line);
  }

  const columns: TableColumn[] = [
    { header: 'Role', width: bodyWidth * 0.34 },
    { header: 'Tier', width: bodyWidth * 0.14 },
    { header: 'Day-rate', width: bodyWidth * 0.16, align: 'right' },
    { header: 'Days', width: bodyWidth * 0.1, align: 'right' },
    { header: 'Fee (excl. VAT)', width: bodyWidth * 0.26, align: 'right' },
  ];

  if (content.staffing.twoColumn) {
    // Two-column layout: left col = first half of streams, right = second half
    const half = Math.ceil(WORK_STREAM_ORDER.length / 2);
    const leftStreams = WORK_STREAM_ORDER.slice(0, half);
    const rightStreams = WORK_STREAM_ORDER.slice(half);
    const colW = (bodyWidth - 24) / 2;

    // Left column
    let leftY = bodyY;
    let rightY = bodyY;
    let grandTotal = 0;

    for (const stream of leftStreams) {
      const lines = grouped[stream];
      if (!lines || lines.length === 0) continue;
      leftY = drawStreamColumn(
        page,
        theme,
        fonts,
        stream,
        lines,
        content,
        bodyX,
        leftY,
        colW,
        bodyWidth,
        columns,
        (fee) => {
          grandTotal += fee;
        }
      );
      leftY -= 10;
    }

    // Right column
    for (const stream of rightStreams) {
      const lines = grouped[stream];
      if (!lines || lines.length === 0) continue;
      rightY = drawStreamColumn(
        page,
        theme,
        fonts,
        stream,
        lines,
        content,
        bodyX + colW + 24,
        rightY,
        colW,
        bodyWidth,
        columns,
        (fee) => {
          grandTotal += fee;
        }
      );
      rightY -= 10;
    }

    const minY = Math.min(leftY, rightY);
    page.drawText(
      `Total (excl. VAT): ${formatCurrency(grandTotal, content.currencySymbol)}`,
      {
        x: bodyX,
        y: minY - 4,
        size: theme.type.body + 1,
        font: fonts.paragraphBold,
        color: theme.colors.navy,
      }
    );
  } else {
    // Single-column fallback
    let y = bodyY;
    let grandTotal = 0;

    for (const stream of WORK_STREAM_ORDER) {
      const lines = grouped[stream];
      if (!lines || lines.length === 0) continue;

      y = drawStreamColumn(
        page,
        theme,
        fonts,
        stream,
        lines,
        content,
        bodyX,
        y,
        bodyWidth,
        bodyWidth,
        columns,
        (fee) => {
          grandTotal += fee;
        }
      );
      y -= 14;
    }

    page.drawText(
      `Total (excl. VAT): ${formatCurrency(grandTotal, content.currencySymbol)}`,
      {
        x: bodyX,
        y: y - 4,
        size: theme.type.body + 1,
        font: fonts.paragraphBold,
        color: theme.colors.navy,
      }
    );
  }
}

// ---------------------------------------------------------------------
// 7. VALUE & COSTING (only rendered if content.costing is present)
// ---------------------------------------------------------------------
export function drawCostingPage(
  page: PDFPage,
  theme: Theme,
  fonts: EmbeddedFonts,
  content: ProposalContent,
  sectionNumber: number,
  pageNumber: number,
  totalPages: number
): void {
  if (!content.costing) return;
  const { bodyX, bodyY, bodyWidth } = drawContentChrome(
    page,
    theme,
    fonts,
    sectionNumber,
    content.costing.heading,
    pageNumber,
    totalPages,
    content.cover.contactEmail
  );

  const columns: TableColumn[] = [
    { header: 'Phase', width: bodyWidth * 0.5 },
    { header: 'Man-days', width: bodyWidth * 0.2, align: 'right' },
    { header: 'Fee (excl. VAT)', width: bodyWidth * 0.3, align: 'right' },
  ];

  const subtotal = content.costing.phases.reduce((s, p) => s + p.fee, 0);
  const vat = subtotal * content.vatRate;
  const total = subtotal + vat;

  const rows = content.costing.phases.map((p) => [
    p.phase,
    String(p.manDays),
    formatCurrency(p.fee, content.currencySymbol),
  ]);
  rows.push(['', '', formatCurrency(subtotal, content.currencySymbol)]);
  rows.push([
    `VAT (${Math.round(content.vatRate * 100)}%)`,
    '',
    formatCurrency(vat, content.currencySymbol),
  ]);
  rows.push(['TOTAL', '', formatCurrency(total, content.currencySymbol)]);

  drawTable(page, {
    x: bodyX,
    y: bodyY,
    columns,
    rows,
    theme,
    headerFont: fonts.subheading,
    cellFont: fonts.paragraph,
    highlightRowIndexes: [rows.length - 1],
  });
}

// ---------------------------------------------------------------------
// 8. CLOSING
// ---------------------------------------------------------------------
export function drawClosingPage(
  page: PDFPage,
  theme: Theme,
  fonts: EmbeddedFonts,
  content: ProposalContent,
  sectionNumber: number,
  pageNumber: number,
  totalPages: number
): void {
  let { bodyX, bodyY, bodyWidth } = drawContentChrome(
    page,
    theme,
    fonts,
    sectionNumber,
    content.closing.heading,
    pageNumber,
    totalPages,
    content.cover.contactEmail
  );

  drawParagraph(page, content.closing.body, bodyX, bodyY, {
    font: fonts.paragraph,
    size: theme.type.body + 2,
    color: theme.colors.text,
    maxWidth: bodyWidth * 0.65,
    lineHeight: 1.5,
  });

  // 4-step process tiles
  if (content.closing.steps && content.closing.steps.length) {
    const steps = content.closing.steps;
    const stepCols = Math.min(4, steps.length);
    const stepColW = (bodyWidth - (stepCols - 1) * 12) / stepCols;
    const stepBlockH = 90;
    let stepY = bodyY - stepBlockH - 20;
    for (let i = 0; i < steps.length; i++) {
      const s = steps[i];
      const col = i % stepCols;
      const row = Math.floor(i / stepCols);
      const cx = bodyX + col * (stepColW + 12);
      const cy = stepY - row * (stepBlockH + 12);
      // Number circle
      page.drawCircle({
        x: cx + 18,
        y: cy,
        size: 14,
        color: theme.colors.cyan,
      });
      page.drawText(s.number, {
        x: cx + 18 - 4,
        y: cy - 4,
        size: 11,
        font: fonts.headingBold,
        color: theme.colors.navy,
      });
      page.drawText(s.title, {
        x: cx,
        y: cy + 18,
        size: theme.type.cardTitle,
        font: fonts.headingRegular,
        color: theme.colors.navy,
      });
      drawParagraph(page, s.body, cx, cy + 6, {
        font: fonts.paragraph,
        size: theme.type.body - 2,
        color: theme.colors.text,
        maxWidth: stepColW,
        lineHeight: 1.3,
      });
    }
    bodyY = stepY - Math.ceil(steps.length / stepCols) * (stepBlockH + 12) - 16;
  }

  // Commercial terms card
  if (content.closing.commercialTerms && content.closing.commercialTerms.length) {
    const terms = content.closing.commercialTerms;
    const termsW = Math.min(bodyWidth, 340);
    const termsH = terms.length * 18 + 20;
    const termsX = bodyX;
    const termsY = bodyY - termsH;
    page.drawRectangle({
      x: termsX,
      y: termsY,
      width: termsW,
      height: termsH,
      color: theme.colors.cyanSoft,
      borderColor: theme.colors.cyan,
      borderWidth: 1,
    });
    page.drawText('Commercial Terms', {
      x: termsX + 12,
      y: termsY + termsH - 14,
      size: theme.type.caption,
      font: fonts.subheading,
      color: theme.colors.navy,
    });
    for (let i = 0; i < terms.length; i++) {
      const t = terms[i];
      page.drawText(t.label + ':', {
        x: termsX + 14,
        y: termsY + termsH - 30 - i * 18,
        size: theme.type.body - 1,
        font: fonts.headingRegular,
        color: theme.colors.navy,
      });
      page.drawText(t.value, {
        x: termsX + 14 + 90,
        y: termsY + termsH - 30 - i * 18,
        size: theme.type.body - 1,
        font: fonts.paragraph,
        color: theme.colors.text,
      });
    }
    bodyY = termsY - 16;
  }

  page.drawText(content.closing.contactEmail, {
    x: bodyX,
    y: bodyY - 8,
    size: 16,
    font: fonts.headingRegular,
    color: theme.colors.cyan,
  });
}
