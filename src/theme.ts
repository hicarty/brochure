/**
 * Theme registry + helpers. Visual tokens live under src/themes/;
 * brands (src/brands/registry.ts) map company slugs to theme ids.
 */

export type { FontTrio, CustomFontFiles, Theme } from './themes/types';
export type { ThemeArchetype, ThemeGlyphs } from './themes/archetypes';
export { ARCHETYPE_LABELS, INTEGRATE_GLYPHS } from './themes/archetypes';

import { Theme } from './themes/types';
import { CLUSTER_THEME } from './themes/cluster';
import { INTEGRATE_THEME } from './themes/integrate';
import { PLAYPROUK_THEME } from './themes/playprouk';
import { SMARTMETER_THEME } from './themes/smart-meter';
import { SPINE_BLOB_THEME } from './themes/spine-blob';
import { BRANDS_BY_ID, BrandDefinition } from './brands/registry';

export const THEMES: Record<string, Theme> = {
  cluster: CLUSTER_THEME,
  integrate: INTEGRATE_THEME,
  playprouk: PLAYPROUK_THEME,
  'smart-meter': SMARTMETER_THEME,
  'spine-blob': SPINE_BLOB_THEME,
};

/** @deprecated Use THEMES — kept for CLI compatibility */
export const BRANDS: Record<string, Theme> = Object.fromEntries(
  Object.entries(BRANDS_BY_ID).map(([slug, brand]) => [
    slug,
    THEMES[brand.themeId] ?? CLUSTER_THEME,
  ])
);

export { CLUSTER_THEME } from './themes/cluster';
export { INTEGRATE_THEME } from './themes/integrate';
export { PLAYPROUK_THEME } from './themes/playprouk';
export { SMARTMETER_THEME } from './themes/smart-meter';
export { SPINE_BLOB_THEME } from './themes/spine-blob';

export function getTheme(themeId: string): Theme {
  return THEMES[themeId] ?? CLUSTER_THEME;
}

export function getThemeForBrand(brandSlug: string): Theme {
  const brand = BRANDS_BY_ID[brandSlug];
  if (!brand) return CLUSTER_THEME;
  return getTheme(brand.themeId);
}

export function listBrandDefinitions(): BrandDefinition[] {
  return Object.values(BRANDS_BY_ID);
}
