/**
 * draw.ts
 * -----------------------------------------------------------------------
 * Low-level drawing helpers. Nothing in here knows about "Brief" or
 * "Costing" — it only knows how to wrap text, draw a rounded panel,
 * or lay out a table. Page-specific composition lives in pages.ts.
 * -----------------------------------------------------------------------
 */

import { PDFFont, PDFPage, RGB, rgb } from 'pdf-lib';
import { Theme } from './theme';

export function wrapText(
  text: string,
  font: PDFFont,
  size: number,
  maxWidth: number
): string[] {
  const words = text.replace(/\s+/g, ' ').trim().split(' ');
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

export interface DrawParagraphOptions {
  font: PDFFont;
  size: number;
  color: RGB;
  maxWidth: number;
  lineHeight?: number; // multiplier of size, default 1.4
}

/** Draws wrapped text top-down starting at (x, y) and returns the y
 *  coordinate immediately below the last line (useful for stacking). */
export function drawParagraph(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  opts: DrawParagraphOptions
): number {
  const lineHeight = opts.size * (opts.lineHeight ?? 1.4);
  const lines = wrapText(text, opts.font, opts.size, opts.maxWidth);
  let cursorY = y;
  for (const line of lines) {
    page.drawText(line, {
      x,
      y: cursorY,
      size: opts.size,
      font: opts.font,
      color: opts.color,
    });
    cursorY -= lineHeight;
  }
  return cursorY;
}

/** Draws a bullet list, one wrapped paragraph per bullet, returns the
 *  ending y coordinate. */
export function drawBulletList(
  page: PDFPage,
  items: string[],
  x: number,
  y: number,
  opts: DrawParagraphOptions & { bulletColor?: RGB; gap?: number }
): number {
  let cursorY = y;
  const bulletIndent = 12;
  for (const item of items) {
    page.drawCircle({
      x: x + 2,
      y: cursorY + opts.size * 0.32,
      size: 1.6,
      color: opts.bulletColor ?? opts.color,
    });
    cursorY = drawParagraph(page, item, x + bulletIndent, cursorY, {
      ...opts,
      maxWidth: opts.maxWidth - bulletIndent,
    });
    cursorY -= opts.gap ?? 4;
  }
  return cursorY;
}

/** Simple logo mark: two overlapping circles approximating the Cluster
 *  Technology gradient cloud, plus the wordmark. Purely vector, so it
 *  never needs an external image asset. */
export function drawLogo(
  page: PDFPage,
  x: number,
  y: number,
  theme: Theme,
  font: PDFFont,
  opts: { textColor?: RGB; size?: number } = {}
): void {
  const size = opts.size ?? 12;
  page.drawCircle({ x: x, y: y, size: 7, color: theme.colors.greenDark });
  page.drawCircle({
    x: x + 7,
    y: y + 3,
    size: 6,
    color: theme.colors.greenLight,
  });
  page.drawText(theme.meta.logoText, {
    x: x + 20,
    y: y - size / 3,
    size,
    font,
    color: opts.textColor ?? theme.colors.navy,
  });
}

/** Vertical "Proprietary & Confidential" label running up the left
 *  margin, matching the dark rail on the source deck's inner slides. */
export function drawConfidentialRail(
  page: PDFPage,
  theme: Theme,
  font: PDFFont
): void {
  const { pageHeight, railWidth } = theme.layout;
  page.drawRectangle({
    x: 0,
    y: 0,
    width: railWidth,
    height: pageHeight,
    color: theme.colors.navyDark,
  });
  page.drawText(theme.meta.footerConfidential, {
    x: railWidth / 2 - 5,
    y: 40,
    size: 7.5,
    font,
    color: theme.colors.textOnDark,
    rotate: { type: 'degrees', angle: 90 } as any,
  });
}

/** Page number + contact footer, used on every content page. */
export function drawFooter(
  page: PDFPage,
  pageNumber: number,
  totalPages: number,
  theme: Theme,
  font: PDFFont,
  contactEmail?: string
): void {
  const { pageWidth, margin } = theme.layout;
  if (contactEmail) {
    page.drawText(`Contact: ${contactEmail}`, {
      x: margin,
      y: 20,
      size: 8,
      font,
      color: theme.colors.textMuted,
    });
  }
  const label = `${pageNumber} / ${totalPages}`;
  const w = font.widthOfTextAtSize(label, 8);
  page.drawText(label, {
    x: pageWidth - margin - w,
    y: 20,
    size: 8,
    font,
    color: theme.colors.textMuted,
  });
}

/** Numbered section header, e.g. "3.  Response" — mirrors the source
 *  deck's "1. Brief" / "2. Our Services" pattern. */
export function drawSectionHeader(
  page: PDFPage,
  sectionNumber: number,
  title: string,
  x: number,
  y: number,
  theme: Theme,
  fonts: { number: PDFFont; title: PDFFont }
): number {
  const numText = `${sectionNumber}.`;
  page.drawText(numText, {
    x,
    y,
    size: theme.type.sectionNumber,
    font: fonts.number,
    color: theme.colors.slateBlue,
  });
  const numWidth = fonts.number.widthOfTextAtSize(
    numText,
    theme.type.sectionNumber
  );
  page.drawText(title, {
    x: x + numWidth + 8,
    y,
    size: theme.type.sectionTitle,
    font: fonts.title,
    color: theme.colors.navy,
  });
  return y - theme.type.sectionTitle - 14;
}

export interface TableColumn {
  header: string;
  width: number;
  align?: 'left' | 'right' | 'center';
}

export interface DrawTableOptions {
  x: number;
  y: number;
  columns: TableColumn[];
  rows: string[][];
  theme: Theme;
  headerFont: PDFFont;
  cellFont: PDFFont;
  rowHeight?: number;
  highlightRowIndexes?: number[]; // e.g. the totals row
}

/** Draws a header row + body rows, returns the ending y coordinate. */
export function drawTable(page: PDFPage, opts: DrawTableOptions): number {
  const rowHeight = opts.rowHeight ?? 22;
  const { theme } = opts;
  let cursorX = opts.x;
  let cursorY = opts.y;

  // Header background
  const totalWidth = opts.columns.reduce((s, c) => s + c.width, 0);
  page.drawRectangle({
    x: opts.x,
    y: cursorY - rowHeight + 6,
    width: totalWidth,
    height: rowHeight,
    color: theme.colors.navy,
  });

  cursorX = opts.x;
  for (const col of opts.columns) {
    const tx =
      col.align === 'right'
        ? cursorX + col.width - 8 - opts.headerFont.widthOfTextAtSize(col.header, theme.type.tableHeader)
        : cursorX + 8;
    page.drawText(col.header, {
      x: tx,
      y: cursorY - rowHeight + 6 + rowHeight / 2 - theme.type.tableHeader / 2 + 2,
      size: theme.type.tableHeader,
      font: opts.headerFont,
      color: theme.colors.white,
    });
    cursorX += col.width;
  }
  cursorY -= rowHeight;

  opts.rows.forEach((row, rowIndex) => {
    const isHighlight = opts.highlightRowIndexes?.includes(rowIndex);
    page.drawRectangle({
      x: opts.x,
      y: cursorY - rowHeight + 6,
      width: totalWidth,
      height: rowHeight,
      color: isHighlight ? theme.colors.cyan : rowIndex % 2 === 0 ? theme.colors.panel : theme.colors.background,
    });
    cursorX = opts.x;
    row.forEach((cell, colIndex) => {
      const col = opts.columns[colIndex];
      const cellWidth = opts.cellFont.widthOfTextAtSize(cell, theme.type.tableCell);
      const tx =
        col.align === 'right'
          ? cursorX + col.width - 8 - cellWidth
          : col.align === 'center'
          ? cursorX + col.width / 2 - cellWidth / 2
          : cursorX + 8;
      page.drawText(cell, {
        x: tx,
        y: cursorY - rowHeight + 6 + rowHeight / 2 - theme.type.tableCell / 2 + 2,
        size: theme.type.tableCell,
        font: opts.cellFont,
        color: isHighlight ? theme.colors.navy : theme.colors.text,
      });
      cursorX += col.width;
    });
    cursorY -= rowHeight;
  });

  // Border
  page.drawRectangle({
    x: opts.x,
    y: cursorY + 6,
    width: totalWidth,
    height: opts.y - cursorY,
    borderColor: theme.colors.line,
    borderWidth: 0.75,
    color: undefined,
  });

  return cursorY;
}

export function formatCurrency(amount: number, symbol: string): string {
  return `${symbol}${amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** Draws a wrapping row of small rounded tag chips (e.g. tech-stack
 *  labels on a service card). Returns the y coordinate below the last
 *  chip row so callers can keep stacking content beneath it. */
export function drawTagChips(
  page: PDFPage,
  tags: string[],
  x: number,
  y: number,
  maxWidth: number,
  theme: Theme,
  font: PDFFont
): number {
  const size = 7;
  const paddingX = 6;
  const chipHeight = 14;
  const gap = 5;
  let cursorX = x;
  let cursorY = y;

  for (const tag of tags) {
    const textWidth = font.widthOfTextAtSize(tag, size);
    const chipWidth = textWidth + paddingX * 2;

    if (cursorX + chipWidth > x + maxWidth) {
      cursorX = x;
      cursorY -= chipHeight + gap;
    }

    page.drawRectangle({
      x: cursorX,
      y: cursorY - chipHeight,
      width: chipWidth,
      height: chipHeight,
      color: theme.colors.background,
      borderColor: theme.colors.cyan,
      borderWidth: 0.75,
    });
    page.drawText(tag, {
      x: cursorX + paddingX,
      y: cursorY - chipHeight + 4,
      size,
      font,
      color: theme.colors.navy,
    });

    cursorX += chipWidth + gap;
  }

  return cursorY - chipHeight;
}
