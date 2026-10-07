/**
 * fonts.ts
 * -----------------------------------------------------------------------
 * Embeds the three brand type roles — heading / subheading / paragraph —
 * plus bold variants for table headers and emphasis. If theme.fontFiles
 * points at real .ttf/.otf files (e.g. Poppins + Inter, to match the
 * source deck's geometric sans), those are embedded via fontkit. If not,
 * everything falls back to the 14 built-in PDF Standard Fonts, which
 * need no embedding and render identically on every viewer.
 * -----------------------------------------------------------------------
 */

import * as fs from 'fs';
import fontkit from '@pdf-lib/fontkit';
import { PDFDocument, PDFFont, StandardFonts } from 'pdf-lib';
import { Theme } from './theme';

export interface EmbeddedFonts {
  headingBold: PDFFont;
  headingRegular: PDFFont;
  subheading: PDFFont;
  paragraph: PDFFont;
  paragraphBold: PDFFont;
}

export async function embedThemeFonts(
  doc: PDFDocument,
  theme: Theme
): Promise<EmbeddedFonts> {
  const files = theme.fontFiles;
  const hasCustomFonts =
    files &&
    (files.headingBold || files.headingRegular || files.subheadingRegular || files.paragraphRegular);

  if (hasCustomFonts) {
    doc.registerFontkit(fontkit);
  }

  const embedCustomOrFallback = async (
    path: string | undefined,
    fallback: StandardFonts
  ): Promise<PDFFont> => {
    if (path && fs.existsSync(path)) {
      const bytes = fs.readFileSync(path);
      return doc.embedFont(bytes, { subset: true });
    }
    return doc.embedFont(fallback);
  };

  const [headingBold, headingRegular, subheading, paragraph, paragraphBold] =
    await Promise.all([
      embedCustomOrFallback(files?.headingBold, StandardFonts.HelveticaBold),
      embedCustomOrFallback(files?.headingRegular, StandardFonts.HelveticaBold),
      embedCustomOrFallback(files?.subheadingRegular, StandardFonts.Helvetica),
      embedCustomOrFallback(files?.paragraphRegular, StandardFonts.Helvetica),
      embedCustomOrFallback(files?.paragraphBold, StandardFonts.HelveticaBold),
    ]);

  return { headingBold, headingRegular, subheading, paragraph, paragraphBold };
}
