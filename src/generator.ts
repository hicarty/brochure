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

import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
  PDFDocument,
  PDFFont,
  PDFPage,
  RGB,
  StandardFonts,
  rgb,
} from 'pdf-lib';
import type { Theme } from './theme';
import type { ProposalContent } from './types';

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
  theme?: Theme
): Promise<GenerateResult> {
  const [{ CLUSTER_THEME }, { embedThemeFonts }, pages] = await Promise.all([
    import('./theme'),
    import('./fonts'),
    import('./pages'),
  ]);
  const activeTheme = theme ?? CLUSTER_THEME;
  const { pages: plan, dropped } = planPages(content);

  const doc = await PDFDocument.create();
  doc.setTitle(`${content.cover.projectTitle} — ${activeTheme.name} Proposal`);
  doc.setSubject(content.cover.strapline);
  doc.setProducer(`${activeTheme.name} Proposal Generator`);

  const fonts = await embedThemeFonts(doc, activeTheme);

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
    const page = doc.addPage([activeTheme.layout.pageWidth, activeTheme.layout.pageHeight]);
    const pageNumber = index + 1;
    if (numberedKinds.includes(planned.kind)) sectionCounter += 1;

    switch (planned.kind) {
      case 'cover':
        pages.drawCoverPage(page, activeTheme, fonts, content);
        break;
      case 'brief':
        pages.drawBriefPage(page, activeTheme, fonts, content, sectionCounter, pageNumber, totalPages);
        break;
      case 'response':
        pages.drawResponsePage(page, activeTheme, fonts, content, sectionCounter, pageNumber, totalPages);
        break;
      case 'portfolio':
        pages.drawPortfolioPage(page, activeTheme, fonts, content, sectionCounter, pageNumber, totalPages);
        break;
      case 'timeframe':
        pages.drawTimeframePage(page, activeTheme, fonts, content, sectionCounter, pageNumber, totalPages);
        break;
      case 'staffing':
        pages.drawStaffingPage(page, activeTheme, fonts, content, sectionCounter, pageNumber, totalPages);
        break;
      case 'costing':
        pages.drawCostingPage(page, activeTheme, fonts, content, sectionCounter, pageNumber, totalPages);
        break;
      case 'closing':
        pages.drawClosingPage(page, activeTheme, fonts, content, sectionCounter, pageNumber, totalPages);
        break;
    }
  });

  const pdfBytes = await doc.save();
  return { pdfBytes, pageCount: plan.length, droppedSections: dropped };
}

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 30;
const FOOTER_HEIGHT = 24;

interface Phase {
  weeks: string;
  title: string;
  items: string[];
  accent?: string;
}

interface TeamRow {
  role: string;
  tier: string;
  rate: string;
  days: string;
  fee: string;
}

interface BrochurePortfolioItem {
  title: string;
  subtitle: string;
  body: string;
  tags: string[];
}

interface BrochureBrand {
  name: string;
  footer: string;
  industry: string;
  coverTitle: string[];
  coverAccent: string;
  strapline: string;
  tags: string[];
  rate: string;
  rateNote: string;
  colors: Record<string, string>;
  mission: string;
  vision: string;
  purpose: string;
  differentiators: [string, string][];
  services: { title: string; body: string; tags: string[] }[];
  extras: { title: string; body: string }[];
  phases: Phase[];
  duration: string;
  management: string[];
  teamIntro: string;
  teamRows: TeamRow[];
  teamTotal: string;
  portfolioIntro: string;
  portfolio: BrochurePortfolioItem[];
}

const sharedDifferentiators: [string, string][] = [
  [
    'End-to-end delivery',
    'From cloud platforms to connected hardware, delivered by one accountable specialist.',
  ],
  [
    'Focused expertise',
    'Practical experience across software, integration, and the real-world systems they support.',
  ],
  [
    'Lean and accountable',
    'No agency overhead or handoff risk; senior-level delivery from day one.',
  ],
  [
    'Insured and compliant',
    'Professional indemnity cover for bespoke software consultancy engagements.',
  ],
];

const sharedServices = [
  {
    title: 'Enterprise web development',
    body: 'Bespoke portals, application architecture, data services, and CI/CD delivery.',
    tags: ['.NET / C#', 'Blazor', 'Azure'],
  },
  {
    title: 'Client portals and CMS',
    body: 'Back-office portals with role-based access, analytics, and managed business data.',
    tags: ['Identity', 'Dashboard', 'CMS'],
  },
  {
    title: 'IoT and embedded systems',
    body: 'Device firmware, communications, telemetry, and integration with cloud services.',
    tags: ['ESP32', 'MQTT', 'Blues IoT'],
  },
];

const sharedExtras = [
  {
    title: 'High-level design and wireframing',
    body: 'Information architecture, UX wireframes, and design strategy.',
  },
  {
    title: 'Firmware and electronics',
    body: 'Embedded firmware, device integration, and rapid prototyping.',
  },
  {
    title: 'PHP and WordPress',
    body: 'Custom themes, REST integrations, and optimised Linux deployments.',
  },
  {
    title: 'Audio DSP and VST plugins',
    body: 'Real-time audio processing and JUCE-based plugin engineering.',
  },
];

const sharedPhases: Phase[] = [
  {
    weeks: 'Weeks 1-4',
    title: 'Design and planning',
    items: [
      'Wireframes and information architecture',
      'Application scope definition',
      'Engineering sample specification',
      'Initial development framework',
    ],
  },
  {
    weeks: 'Weeks 5-12',
    title: 'Development sprint',
    items: [
      'Web application development',
      'Embedded firmware',
      'Back-end portal and CMS',
      'CI/CD pipeline',
    ],
    accent: '#00A3AB',
  },
  {
    weeks: 'Weeks 13-24',
    title: 'Integration and delivery',
    items: [
      'Board and schematic review',
      'IoT integration and MQTT',
      'Client onboarding and UAT',
      'Handover documentation',
    ],
    accent: '#007A80',
  },
];

const sharedManagement = [
  'Multi-discipline sprint planning and stand-ups',
  'Strategy reviews and stakeholder reporting',
  'Talent acquisition and sub-contractor liaison',
  'ODM and supplier coordination',
];

const sharedPortfolio: BrochurePortfolioItem[] = [
  {
    title: 'TicketAura - Cohesiv',
    subtitle: 'Web platform / Product ownership',
    body: 'Full product ownership and re-brand for a ticketing web application, from initial concept to a managed production platform.',
    tags: ['.NET', 'Blazor', 'Azure', 'Product Mgmt'],
  },
  {
    title: 'Just Business IT',
    subtitle: 'WordPress / Front-end development',
    body: 'Custom WordPress theme development and front-end engineering for a UK shipping company on a Linux-hosted Nginx stack.',
    tags: ['WordPress', 'PHP', 'Nginx', 'Linux'],
  },
  {
    title: 'Mewline - Cohesiv',
    subtitle: 'B2B platform / Business development',
    body: 'Business development and product management for a B2B jewellery marketplace, including platform strategy and technical oversight.',
    tags: ['B2B SaaS', 'Product Strategy'],
  },
  {
    title: 'Smart Meter O&M Platform',
    subtitle: 'Industry 4.0 / IoT / .NET',
    body: 'An operations and maintenance monitoring platform connecting web dashboards with embedded device telemetry across an asset fleet.',
    tags: ['IoT', '.NET', 'MQTT', 'Energy Tech'],
  },
];

const clusterColors = {
  navy: '#0D1B3E',
  navyLight: '#1A2F5E',
  cyan: '#00C2CB',
  cyanSoft: '#E0F9FA',
  white: '#FFFFFF',
  offwhite: '#F5F7FA',
  mid: '#8A9AB5',
  darkText: '#1C2B4A',
  lightText: '#4A5A78',
  rule: '#D0D8E8',
  greenDot: '#00D26A',
  darkBgText: '#A8B8D0',
};

const brands: Record<string, BrochureBrand> = {
  cluster: {
    name: 'Cluster Technology',
    footer: 'Proprietary & Confidential',
    industry: 'smart metering, renewable energy, and energy manufacturing supply chain',
    coverTitle: ['Smart Meter &', 'Energy Technology'],
    coverAccent: 'Software Consultancy',
    strapline:
      'We bridge cloud platforms and connected hardware with robust .NET portals, embedded firmware, and IoT integrations.',
    tags: ['Software Consultants', 'Industry 4.0', 'IoT & Embedded', '.NET / Blazor'],
    rate: '\u00a3450.00 / day',
    rateNote: 'Standard day-rate / excl. VAT / IR35 negotiable',
    colors: clusterColors,
    mission:
      'To establish a seamless fusion of digital and tangible elements within connected products, delivering exceptional experiences across industrial IoT and enterprise platforms.',
    vision:
      'To become the trusted technical partner for energy and smart metering companies that need cloud engineering and device-level firmware under one contract.',
    purpose:
      'To solve hard problems in cyber-physical systems and human-computer interaction at the boundary between hardware and software.',
    differentiators: sharedDifferentiators,
    services: sharedServices,
    extras: sharedExtras,
    phases: sharedPhases,
    duration: 'Indicative 24-week engagement',
    management: sharedManagement,
    teamIntro:
      'Cluster Technology operates as a specialist individual contractor. The rates below reflect Haven Carty\'s cross-disciplinary expertise. Sub-contracted specialists can be introduced where scope requires.',
    teamRows: [
      { role: 'UX / Product Designer', tier: 'Senior', rate: '\u00a3440.00', days: '3', fee: '\u00a31,320.00' },
      { role: 'UX / Product Designer', tier: 'Junior', rate: '\u00a3250.00', days: '5', fee: '\u00a31,250.00' },
      { role: 'Front-end Developer (.NET / Blazor)', tier: 'Senior', rate: '\u00a3450.00', days: '8', fee: '\u00a33,600.00' },
      { role: 'Front-end Developer', tier: 'Junior', rate: '\u00a3280.00', days: '10', fee: '\u00a32,800.00' },
      { role: 'Back-end Developer', tier: 'Senior', rate: '\u00a3460.00', days: '9', fee: '\u00a34,140.00' },
      { role: 'Embedded Systems Engineer', tier: 'Senior', rate: '\u00a3480.00', days: '12', fee: '\u00a35,760.00' },
      { role: 'PCB Designer', tier: 'Senior', rate: '\u00a3470.00', days: '6', fee: '\u00a32,820.00' },
      { role: 'Manufacturing / Prototyping Engineer', tier: 'Junior', rate: '\u00a3260.00', days: '4', fee: '\u00a31,040.00' },
      { role: 'Project Manager', tier: 'Senior', rate: '\u00a3400.00', days: '6', fee: '\u00a32,400.00' },
      { role: 'ODM / Supplier Liaison', tier: 'Senior', rate: '\u00a3400.00', days: '3', fee: '\u00a31,200.00' },
    ],
    teamTotal: '\u00a326,330.00',
    portfolioIntro:
      'Selected engagements demonstrating breadth across web platforms, embedded systems, and product development.',
    portfolio: sharedPortfolio,
  },
  playprouk: {
    name: 'PlayProUK',
    footer: 'Confidential - PlayProUK',
    industry: 'sports analytics, mobile applications, and data intelligence platforms',
    coverTitle: ['PlayPro', '- Grassroots Football'],
    coverAccent: 'Data & Analytics Platform',
    strapline:
      'We bridge match footage and player insights with cross-platform mobile apps, cloud backends, and AI-powered analytics.',
    tags: ['Software Consultants', 'Sports Analytics', 'Mobile App', 'Data Intelligence'],
    rate: '\u00a3425.00 / day',
    rateNote: 'Sports analytics day-rate / excl. VAT',
    colors: {
      ...clusterColors,
      navy: '#0F2255',
      navyLight: '#1E3A7A',
      cyan: '#00C8D8',
      cyanSoft: '#E0F7FA',
      offwhite: '#F0F4F8',
    },
    mission:
      'To democratise access to professional-grade performance data for grassroots football, giving every player the opportunity to be discovered.',
    vision:
      'To become the UK\'s leading platform bridging grassroots talent with professional clubs through data-driven scouting and analytics.',
    purpose:
      'To close the visibility gap between grassroots football and professional recruitment by making match data accessible, affordable, and actionable.',
    differentiators: [
      [
        'End-to-end stack',
        'From cloud-hosted analytics pipelines to mobile apps, delivered by one accountable specialist.',
      ],
      [
        'Sports data focus',
        'Hands-on experience with match footage ingestion, player tracking, and performance metrics.',
      ],
      ...sharedDifferentiators.slice(2),
    ],
    services: [
      {
        title: 'Mobile app (cross-platform)',
        body: 'Player profiles, league dashboards, and match analytics for iOS and Android.',
        tags: ['React Native', 'Flutter', 'iOS'],
      },
      {
        title: 'Video ingestion and CV',
        body: 'Process match recordings, extract player tracking data, and compute performance metrics.',
        tags: ['Python', 'OpenCV', 'ML Pipeline'],
      },
      {
        title: 'Cloud backend and APIs',
        body: 'Scalable backend, real-time data sync, authentication, and multi-tenant league management.',
        tags: ['.NET 8', 'Azure', 'REST API'],
      },
    ],
    extras: [
      { title: 'Player analytics dashboard', body: 'Rankings, positional comparisons, and club recruitment tools.' },
      { title: 'Player profiling and AI', body: 'Role matching and performance scoring against benchmarks.' },
      { title: 'Safeguarding and compliance', body: 'Safeguarding protocols and GDPR-compliant data handling.' },
      { title: 'League administration', body: 'Multi-tenant league management, scheduling, and club portals.' },
    ],
    phases: [
      {
        weeks: 'Weeks 1-4',
        title: 'Discovery and design',
        items: ['Partner-club user research', 'UI/UX wireframes', 'Player and league data model', 'Veo API contract mapping'],
      },
      {
        weeks: 'Weeks 5-10',
        title: 'Core MVP development',
        items: ['Cross-platform mobile app', '.NET 8 backend and auth', 'Match-footage CV pipeline', 'Player analytics engine'],
        accent: '#00A3AB',
      },
      {
        weeks: 'Weeks 11-20',
        title: 'Pipeline, UAT and launch',
        items: ['Video ingestion integration', 'Analytics and benchmarking', 'Admin and league dashboard', 'UAT and launch'],
        accent: '#007A80',
      },
    ],
    duration: 'Indicative 20-week engagement',
    management: [
      'Sprint planning and stakeholder demos',
      'Safeguarding and GDPR review',
      'UAT with partner clubs and academies',
      'App Store submission and launch',
    ],
    teamIntro:
      'PlayProUK operates as a specialist individual contractor. Sub-contracted specialists can be introduced where project scope requires, quoted separately and transparently.',
    teamRows: [
      { role: 'Mobile Developer (React Native)', tier: 'Senior', rate: '\u00a3440.00', days: '8', fee: '\u00a33,520.00' },
      { role: 'Computer Vision Engineer', tier: 'Senior', rate: '\u00a3500.00', days: '12', fee: '\u00a36,000.00' },
      { role: 'Back-end Developer (.NET 8)', tier: 'Senior', rate: '\u00a3450.00', days: '9', fee: '\u00a34,050.00' },
      { role: 'Project Manager', tier: 'Senior', rate: '\u00a3390.00', days: '6', fee: '\u00a32,340.00' },
      { role: 'UX / Product Designer', tier: 'Senior', rate: '\u00a3420.00', days: '3', fee: '\u00a31,260.00' },
      { role: 'UX / Product Designer', tier: 'Junior', rate: '\u00a3240.00', days: '5', fee: '\u00a31,200.00' },
      { role: 'Mobile Developer', tier: 'Junior', rate: '\u00a3270.00', days: '10', fee: '\u00a32,700.00' },
      { role: 'Academy / Club Liaison', tier: 'Senior', rate: '\u00a3390.00', days: '3', fee: '\u00a31,170.00' },
      { role: 'QA / Test Engineer', tier: 'Junior', rate: '\u00a3250.00', days: '4', fee: '\u00a31,000.00' },
      { role: 'Safeguarding / GDPR Officer', tier: 'Senior', rate: '\u00a3400.00', days: '3', fee: '\u00a31,200.00' },
    ],
    teamTotal: '\u00a324,770.00',
    portfolioIntro:
      'Selected engagements demonstrating experience across mobile, cloud, analytics, and data platforms.',
    portfolio: [
      {
        title: 'PlayPro - Grassroots Football',
        subtitle: 'Mobile app / Data analytics',
        body: 'Cross-platform mobile app and analytics platform for grassroots football, turning match footage into player performance metrics.',
        tags: ['React Native', 'Flutter', 'Azure', 'Data Viz'],
      },
      ...sharedPortfolio.slice(3, 4),
      ...sharedPortfolio.slice(0, 1),
    ],
  },
  'smart-meter': {
    name: 'Smart Meter & Energy Technology',
    footer: 'Confidential - Smart Meter & Energy Technology',
    industry: 'smart metering, renewable energy, and energy manufacturing supply chain',
    coverTitle: ['Smart Meter &', 'Energy Technology'],
    coverAccent: 'Software Consultancy',
    strapline:
      'We bridge cloud platforms and connected hardware with robust .NET portals, embedded firmware, and IoT integrations.',
    tags: ['Software Consultants', 'Industry 4.0', 'IoT & Embedded', '.NET / Blazor'],
    rate: '\u00a3450.00 / day',
    rateNote: 'Standard day-rate / excl. VAT / IR35 negotiable',
    colors: {
      ...clusterColors,
      cyan: '#00A0B8',
      cyanSoft: '#DCEFF5',
      offwhite: '#F2F5F8',
    },
    mission:
      'To establish a seamless fusion of digital and tangible elements within connected products, delivering exceptional experiences across industrial IoT and enterprise platforms.',
    vision:
      'To become the trusted technical partner for energy and smart metering companies that need cloud engineering and device-level firmware under one contract.',
    purpose:
      'To solve hard problems in cyber-physical systems and human-computer interaction at the boundary between hardware and software.',
    differentiators: sharedDifferentiators,
    services: sharedServices,
    extras: sharedExtras,
    phases: sharedPhases,
    duration: 'Indicative 24-week engagement',
    management: sharedManagement,
    teamIntro:
      'Smart Meter & Energy Technology operates as a specialist individual contractor. The rates below reflect Haven Carty\'s cross-disciplinary expertise. Sub-contracted specialists can be introduced where scope requires.',
    teamRows: [
      { role: 'UX / Product Designer', tier: 'Senior', rate: '\u00a3450.00', days: '3', fee: '\u00a31,350.00' },
      { role: 'UX / Product Designer', tier: 'Junior', rate: '\u00a3260.00', days: '5', fee: '\u00a31,300.00' },
      { role: 'Front-end Developer (Blazor / .NET)', tier: 'Senior', rate: '\u00a3460.00', days: '8', fee: '\u00a33,680.00' },
      { role: 'Front-end Developer', tier: 'Junior', rate: '\u00a3290.00', days: '10', fee: '\u00a32,900.00' },
      { role: 'Back-end Developer (Azure)', tier: 'Senior', rate: '\u00a3470.00', days: '9', fee: '\u00a34,230.00' },
      { role: 'Embedded Systems / Firmware Engineer', tier: 'Senior', rate: '\u00a3490.00', days: '12', fee: '\u00a35,880.00' },
      { role: 'PCB Designer', tier: 'Senior', rate: '\u00a3480.00', days: '6', fee: '\u00a32,880.00' },
      { role: 'Manufacturing / Prototyping Engineer', tier: 'Junior', rate: '\u00a3270.00', days: '4', fee: '\u00a31,080.00' },
      { role: 'Project Manager', tier: 'Senior', rate: '\u00a3410.00', days: '6', fee: '\u00a32,460.00' },
      { role: 'ODM / Supplier Liaison', tier: 'Senior', rate: '\u00a3410.00', days: '3', fee: '\u00a31,230.00' },
    ],
    teamTotal: '\u00a326,330.00',
    portfolioIntro:
      'Selected engagements demonstrating breadth across web platforms, embedded systems, and product development.',
    portfolio: sharedPortfolio,
  },
};

function color(hex: string): RGB {
  const value = hex.replace('#', '');
  return rgb(
    parseInt(value.slice(0, 2), 16) / 255,
    parseInt(value.slice(2, 4), 16) / 255,
    parseInt(value.slice(4, 6), 16) / 255
  );
}

function wrapText(text: string, font: PDFFont, size: number, width: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split('\n')) {
    const words = paragraph.trim().split(/\s+/).filter(Boolean);
    let line = '';
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (line && font.widthOfTextAtSize(candidate, size) > width) {
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}

function paragraph(
  page: PDFPage,
  text: string,
  x: number,
  top: number,
  width: number,
  font: PDFFont,
  size: number,
  fill: RGB,
  lineHeight = size * 1.4,
  maxLines = Number.POSITIVE_INFINITY
): number {
  const lines = wrapText(text, font, size, width).slice(0, maxLines);
  let y = top;
  for (const line of lines) {
    page.drawText(line, {
      x,
      y: PAGE_HEIGHT - y - size,
      size,
      font,
      color: fill,
    });
    y += lineHeight;
  }
  return y;
}

function rect(
  page: PDFPage,
  x: number,
  top: number,
  width: number,
  height: number,
  fill: RGB
): void {
  page.drawRectangle({
    x,
    y: PAGE_HEIGHT - top - height,
    width,
    height,
    color: fill,
  });
}

function rule(page: PDFPage, x: number, top: number, width: number, fill: RGB, thickness = 1): void {
  page.drawLine({
    start: { x, y: PAGE_HEIGHT - top },
    end: { x: x + width, y: PAGE_HEIGHT - top },
    thickness,
    color: fill,
  });
}

function addLogo(
  page: PDFPage,
  brand: BrochureBrand,
  fonts: { regular: PDFFont; bold: PDFFont },
  x: number,
  top: number,
  size = 18
): void {
  const c = brand.colors;
  const y = PAGE_HEIGHT - top - size;
  page.drawCircle({ x: x + size * 0.35, y: y + size * 0.6, size: size * 0.38, color: color(c.cyan) });
  page.drawCircle({ x: x + size * 0.72, y: y + size * 0.55, size: size * 0.28, color: color(c.greenDot) });
  page.drawText(brand.name, {
    x: x + size + 8,
    y: y + size * 0.25,
    size: 11,
    font: fonts.bold,
    color: color(c.white),
  });
}

function addFooter(
  page: PDFPage,
  brand: BrochureBrand,
  fonts: { regular: PDFFont },
  pageNumber: number,
  dark = false
): void {
  if (!dark) rect(page, 0, PAGE_HEIGHT - FOOTER_HEIGHT, PAGE_WIDTH, FOOTER_HEIGHT, color(brand.colors.navy));
  const fill = color(brand.colors.mid);
  page.drawText(`${brand.name} Limited  |  ${brand.footer}  |  havencarty@outlook.com`, {
    x: MARGIN,
    y: dark ? 10 : FOOTER_HEIGHT / 2 - 3,
    size: 7,
    font: fonts.regular,
    color: fill,
  });
  const label = `${pageNumber} / 7`;
  page.drawText(label, {
    x: PAGE_WIDTH - MARGIN - fonts.regular.widthOfTextAtSize(label, 7),
    y: dark ? 10 : FOOTER_HEIGHT / 2 - 3,
    size: 7,
    font: fonts.regular,
    color: fill,
  });
}

function addHeader(
  page: PDFPage,
  brand: BrochureBrand,
  fonts: { regular: PDFFont; bold: PDFFont },
  title: string,
  subtitle: string
): void {
  rect(page, 0, 0, PAGE_WIDTH, 56, color(brand.colors.navy));
  addLogo(page, brand, fonts, 20, 19);
  const titleWidth = fonts.bold.widthOfTextAtSize(title, 12);
  page.drawText(title, {
    x: PAGE_WIDTH - 20 - titleWidth,
    y: PAGE_HEIGHT - 36 - 12,
    size: 12,
    font: fonts.bold,
    color: color(brand.colors.cyan),
  });
  const subtitleWidth = fonts.regular.widthOfTextAtSize(subtitle, 8);
  page.drawText(subtitle, {
    x: PAGE_WIDTH - 20 - subtitleWidth,
    y: PAGE_HEIGHT - 48 - 8,
    size: 8,
    font: fonts.regular,
    color: color(brand.colors.mid),
  });
}

function drawCover(
  doc: PDFDocument,
  brand: BrochureBrand,
  fonts: { regular: PDFFont; bold: PDFFont }
): void {
  const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const c = brand.colors;
  rect(page, 0, 0, PAGE_WIDTH, PAGE_HEIGHT, color(c.offwhite));
  rect(page, 0, 0, PAGE_WIDTH * 0.33, PAGE_HEIGHT, color(c.navy));
  rect(page, PAGE_WIDTH * 0.33, 0, 3, PAGE_HEIGHT, color(c.cyan));
  const logoSize = 20;
  const coverLogoWidth = fonts.bold.widthOfTextAtSize(brand.name, 11) + logoSize + 8;
  addLogo(page, brand, fonts, PAGE_WIDTH - 20 - coverLogoWidth, 28, logoSize);

  const left = 18;
  let top = PAGE_HEIGHT * 0.28;
  page.drawText('TRADING AS', {
    x: left,
    y: PAGE_HEIGHT - top - 9,
    size: 8,
    font: fonts.regular,
    color: color(c.mid),
  });
  top += 20;
  paragraph(page, brand.name, left, top, PAGE_WIDTH * 0.33 - 36, fonts.bold, 14, color(c.cyan), 17, 3);
  top += 54;
  rule(page, left, top, PAGE_WIDTH * 0.33 - 36, color(c.navyLight));
  top += 18;
  for (const [label, value] of [
    ['CONTACT', 'havencarty@outlook.com'],
    ['INSURED FOR', 'Bespoke Software'],
    ['SIC CODE', '62012'],
    ['OPERATES', 'UK / Remote'],
  ]) {
    page.drawText(label, {
      x: left,
      y: PAGE_HEIGHT - top - 8,
      size: 7,
      font: fonts.regular,
      color: color(c.mid),
    });
    top += 11;
    paragraph(page, value, left, top, PAGE_WIDTH * 0.33 - 36, fonts.bold, 8, color(c.white), 11, 2);
    top += 26;
  }

  const x = PAGE_WIDTH * 0.33 + 34;
  const width = PAGE_WIDTH - x - 28;
  paragraph(page, `${brand.industry} | SIC 62012 | Insured Software Consultancy`, x, 83, width, fonts.regular, 8, color(c.mid), 11, 2);
  let titleTop = 128;
  for (const line of brand.coverTitle) {
    paragraph(page, line, x, titleTop, width, fonts.bold, 27, color(c.navy), 33, 1);
    titleTop += 35;
  }
  paragraph(page, brand.coverAccent, x, titleTop, width, fonts.bold, 20, color(c.cyan), 25, 2);
  rule(page, x, 245, width, color(c.cyan), 1.5);
  paragraph(page, `${brand.name} Limited ${brand.strapline}`, x, 262, width, fonts.regular, 10, color(c.lightText), 15, 5);

  rect(page, x, 348, 188, 50, color(c.cyanSoft));
  paragraph(page, brand.rate, x + 12, 355, 165, fonts.bold, 18, color(c.cyan), 22, 1);
  paragraph(page, brand.rateNote, x + 12, 379, 168, fonts.regular, 7, color(c.mid), 9, 2);

  let tagX = x;
  let tagY = 414;
  for (const tag of brand.tags) {
    const tagWidth = Math.min(150, fonts.bold.widthOfTextAtSize(tag, 7) + 14);
    if (tagX + tagWidth > PAGE_WIDTH - 26) {
      tagX = x;
      tagY += 23;
    }
    rect(page, tagX, tagY, tagWidth, 17, color(c.cyanSoft));
    page.drawText(tag, {
      x: tagX + 7,
      y: PAGE_HEIGHT - tagY - 12,
      size: 7,
      font: fonts.bold,
      color: color(c.navy),
    });
    tagX += tagWidth + 6;
  }
  rect(page, PAGE_WIDTH * 0.33 + 3, PAGE_HEIGHT - 28, PAGE_WIDTH * 0.67 - 3, 28, color(c.navyLight));
  page.drawText(`${brand.name} Limited  |  ${brand.footer}  |  havencarty@outlook.com`, {
    x,
    y: 10,
    size: 7,
    font: fonts.regular,
    color: color(c.mid),
  });
  page.drawText('1 / 7', {
    x: PAGE_WIDTH - 49,
    y: 10,
    size: 7,
    font: fonts.regular,
    color: color(c.mid),
  });
}

function drawBrief(
  doc: PDFDocument,
  brand: BrochureBrand,
  fonts: { regular: PDFFont; bold: PDFFont }
): void {
  const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const c = brand.colors;
  rect(page, 0, 0, PAGE_WIDTH, PAGE_HEIGHT, color(c.offwhite));
  addHeader(page, brand, fonts, 'Who We Are', '1. Brief');
  const x = MARGIN;
  const width = PAGE_WIDTH - MARGIN * 2;
  const intro = `${brand.name} Limited is a one-person software consultancy founded and operated by Haven Carty, a specialist engineer with expertise spanning ${brand.industry}. The consultancy operates under SIC code 62012 and holds professional indemnity insurance appropriate for software engagements.`;
  paragraph(page, intro, x, 84, width, fonts.regular, 9.5, color(c.darkText), 14, 5);

  const cards = [
    ['MISSION', brand.mission, c.cyan],
    ['VISION', brand.vision, c.navy],
    ['PURPOSE', brand.purpose, '#1A5276'],
  ];
  const cardWidth = (width - 16) / 3;
  cards.forEach(([title, body, accent], index) => {
    const left = x + index * (cardWidth + 8);
    rect(page, left, 180, cardWidth, 116, color(c.white));
    rect(page, left, 180, cardWidth, 7, color(accent));
    paragraph(page, title, left + 10, 198, cardWidth - 20, fonts.bold, 8, color(accent), 11, 1);
    paragraph(page, body, left + 10, 218, cardWidth - 20, fonts.regular, 7.5, color(c.lightText), 11, 7);
  });

  rule(page, x, 321, width, color(c.rule));
  paragraph(page, 'WHAT MAKES US DIFFERENT', x, 338, width, fonts.bold, 11, color(c.navy), 14, 1);
  let top = 366;
  brand.differentiators.forEach(([title, body]) => {
    rect(page, x, top + 1, 3, 31, color(c.cyan));
    paragraph(page, title, x + 11, top, width - 14, fonts.bold, 8.5, color(c.navy), 11, 1);
    paragraph(page, body, x + 11, top + 13, width - 14, fonts.regular, 7.5, color(c.lightText), 10, 2);
    top += 45;
  });
  addFooter(page, brand, fonts, 2);
}

function drawServices(
  doc: PDFDocument,
  brand: BrochureBrand,
  fonts: { regular: PDFFont; bold: PDFFont }
): void {
  const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const c = brand.colors;
  rect(page, 0, 0, PAGE_WIDTH, PAGE_HEIGHT, color(c.offwhite));
  addHeader(page, brand, fonts, 'Our Services', '2. Core Offering & Optional Extras');
  const x = MARGIN;
  const width = PAGE_WIDTH - MARGIN * 2;
  paragraph(
    page,
    `${brand.name} provides specialist consultancy to the ${brand.industry}, with optional services available as project extensions.`,
    x,
    81,
    width,
    fonts.regular,
    9,
    color(c.darkText),
    13,
    3
  );
  paragraph(page, 'CORE CONSULTANCY SERVICES', x, 126, width, fonts.bold, 10, color(c.navy), 13, 1);
  const cardWidth = (width - 16) / 3;
  brand.services.forEach((service, index) => {
    const left = x + index * (cardWidth + 8);
    rect(page, left, 150, cardWidth, 194, color(c.white));
    rect(page, left, 150, cardWidth, 5, color(c.cyan));
    paragraph(page, service.title, left + 10, 165, cardWidth - 20, fonts.bold, 9, color(c.navy), 12, 3);
    paragraph(page, service.body, left + 10, 206, cardWidth - 20, fonts.regular, 7.5, color(c.lightText), 11, 8);
    let tagTop = 312;
    for (const tag of service.tags) {
      const tagWidth = Math.min(cardWidth - 20, fonts.bold.widthOfTextAtSize(tag, 6.5) + 12);
      rect(page, left + 10, tagTop, tagWidth, 14, color(c.cyanSoft));
      page.drawText(tag, {
        x: left + 16,
        y: PAGE_HEIGHT - tagTop - 10,
        size: 6.5,
        font: fonts.bold,
        color: color(c.navy),
      });
      tagTop += 17;
    }
  });
  rule(page, x, 366, width, color(c.rule));
  paragraph(page, 'OPTIONAL SPECIALIST SERVICES', x, 384, width, fonts.bold, 10, color(c.navy), 13, 1);
  paragraph(page, 'Available as project extensions - quoted separately', x + 220, 384, width - 220, fonts.regular, 7, color(c.mid), 10, 1);

  brand.extras.forEach((extra, index) => {
    const column = index % 2;
    const row = Math.floor(index / 2);
    const left = x + column * (width / 2);
    const top = 414 + row * 68;
    rect(page, left, top, width / 2 - 12, 56, color(c.white));
    rect(page, left, top, 4, 56, color(c.cyan));
    paragraph(page, extra.title, left + 12, top + 8, width / 2 - 34, fonts.bold, 8, color(c.navy), 11, 2);
    paragraph(page, extra.body, left + 12, top + 25, width / 2 - 34, fonts.regular, 7, color(c.lightText), 10, 3);
  });
  addFooter(page, brand, fonts, 3);
}

function drawTimescales(
  doc: PDFDocument,
  brand: BrochureBrand,
  fonts: { regular: PDFFont; bold: PDFFont }
): void {
  const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const c = brand.colors;
  rect(page, 0, 0, PAGE_WIDTH, PAGE_HEIGHT, color(c.navy));
  for (let x = 0; x < PAGE_WIDTH; x += 24) {
    page.drawLine({
      start: { x, y: 0 },
      end: { x, y: PAGE_HEIGHT },
      thickness: 0.3,
      color: color(c.navyLight),
    });
  }
  for (let y = 0; y < PAGE_HEIGHT; y += 24) {
    page.drawLine({
      start: { x: 0, y: PAGE_HEIGHT - y },
      end: { x: PAGE_WIDTH, y: PAGE_HEIGHT - y },
      thickness: 0.3,
      color: color(c.navyLight),
    });
  }
  addLogo(page, brand, fonts, 20, 19);
  const title = 'Engagement Timescales';
  page.drawText(title, {
    x: PAGE_WIDTH - 20 - fonts.bold.widthOfTextAtSize(title, 12),
    y: PAGE_HEIGHT - 36 - 12,
    size: 12,
    font: fonts.bold,
    color: color(c.cyan),
  });
  paragraph(
    page,
    'A typical engagement follows a structured three-phase delivery model. Timescales are indicative and agreed at scoping.',
    MARGIN,
    80,
    PAGE_WIDTH - MARGIN * 2,
    fonts.regular,
    9,
    color(c.darkBgText),
    13,
    3
  );
  const x = MARGIN;
  const width = PAGE_WIDTH - MARGIN * 2;
  const cardWidth = (width - 24) / 3;
  brand.phases.forEach((phase, index) => {
    const left = x + index * (cardWidth + 12);
    const accent = color(phase.accent ?? c.cyan);
    rect(page, left, 130, cardWidth, 224, accent);
    rect(page, left + 3, 133, cardWidth - 6, 218, color(c.navyLight));
    paragraph(page, phase.weeks, left + 10, 145, cardWidth - 20, fonts.bold, 8, accent, 11, 1);
    paragraph(page, phase.title, left + 10, 166, cardWidth - 20, fonts.bold, 9, accent, 12, 2);
    let top = 201;
    for (const item of phase.items) {
      page.drawCircle({
        x: left + 13,
        y: PAGE_HEIGHT - top - 4,
        size: 2,
        color: accent,
      });
      top = paragraph(page, item, left + 21, top, cardWidth - 31, fonts.regular, 7.5, color(c.darkBgText), 10, 2) + 7;
    }
  });
  paragraph(page, 'MANAGEMENT ACTIVITIES (ONGOING)', x, 380, width, fonts.bold, 10, color(c.white), 13, 1);
  brand.management.forEach((item, index) => {
    const column = index % 2;
    const row = Math.floor(index / 2);
    const left = x + column * (width / 2);
    const top = 408 + row * 24;
    page.drawCircle({
      x: left + 5,
      y: PAGE_HEIGHT - top - 5,
      size: 2.5,
      color: color(c.cyan),
    });
    paragraph(page, item, left + 14, top, width / 2 - 16, fonts.regular, 8, color(c.darkBgText), 11, 2);
  });
  rect(page, x, 476, width, 30, color(c.cyanSoft));
  paragraph(page, `${brand.duration} | Scope and phases agreed at kick-off | Weekly status reporting included`, x + 12, 485, width - 24, fonts.bold, 7.5, color(c.navy), 10, 2);
  addFooter(page, brand, fonts, 4, true);
}

function drawTeam(
  doc: PDFDocument,
  brand: BrochureBrand,
  fonts: { regular: PDFFont; bold: PDFFont }
): void {
  const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const c = brand.colors;
  rect(page, 0, 0, PAGE_WIDTH, PAGE_HEIGHT, color(c.offwhite));
  addHeader(page, brand, fonts, 'Team & Day Rates', '4. Work Items');
  const x = MARGIN;
  const width = PAGE_WIDTH - MARGIN * 2;
  paragraph(page, brand.teamIntro, x, 82, width, fonts.regular, 9, color(c.darkText), 13, 4);
  const columns = [
    { label: 'Role', x, width: 230 },
    { label: 'Tier', x: x + 235, width: 60 },
    { label: 'Day-rate', x: x + 300, width: 72 },
    { label: 'Days', x: x + 378, width: 42 },
    { label: 'Fee (excl. VAT)', x: x + 425, width: width - 425 },
  ];
  let top = 151;
  rect(page, x, top, width, 23, color(c.navy));
  for (const column of columns) {
    page.drawText(column.label, {
      x: column.x + 5,
      y: PAGE_HEIGHT - top - 15,
      size: 7.5,
      font: fonts.bold,
      color: color(c.white),
    });
  }
  top += 23;
  brand.teamRows.forEach((row, index) => {
    const fill = index % 2 === 0 ? c.white : c.offwhite;
    rect(page, x, top, width, 22, color(fill));
    const values = [row.role, row.tier, row.rate, row.days, row.fee];
    values.forEach((value, valueIndex) => {
      const column = columns[valueIndex];
      const size = valueIndex === 0 ? 7 : 7.5;
      page.drawText(value, {
        x: column.x + 5,
        y: PAGE_HEIGHT - top - 14,
        size,
        font: valueIndex === 0 ? fonts.regular : fonts.regular,
        color: color(c.darkText),
      });
    });
    top += 22;
  });
  top += 12;
  rect(page, x, top, width, 31, color(c.navy));
  page.drawText('Total (excl. VAT)', {
    x: x + 10,
    y: PAGE_HEIGHT - top - 20,
    size: 9,
    font: fonts.bold,
    color: color(c.cyan),
  });
  page.drawText(brand.teamTotal, {
    x: PAGE_WIDTH - MARGIN - fonts.bold.widthOfTextAtSize(brand.teamTotal, 9) - 10,
    y: PAGE_HEIGHT - top - 20,
    size: 9,
    font: fonts.bold,
    color: color(c.white),
  });
  paragraph(
    page,
    'Rates and estimated effort are indicative and subject to final project scope.',
    x,
    top + 48,
    width,
    fonts.regular,
    8,
    color(c.mid),
    11,
    2
  );
  addFooter(page, brand, fonts, 5);
}

function drawPortfolio(
  doc: PDFDocument,
  brand: BrochureBrand,
  fonts: { regular: PDFFont; bold: PDFFont }
): void {
  const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const c = brand.colors;
  rect(page, 0, 0, PAGE_WIDTH, PAGE_HEIGHT, color(c.offwhite));
  addHeader(page, brand, fonts, 'Portfolio', '5. Selected Work');
  const x = MARGIN;
  const width = PAGE_WIDTH - MARGIN * 2;
  paragraph(page, brand.portfolioIntro, x, 82, width, fonts.regular, 9, color(c.darkText), 13, 3);
  let top = 126;
  for (const item of brand.portfolio.slice(0, 4)) {
    rect(page, x, top, width, 139, color(c.white));
    rect(page, x, top, 4, 139, color(c.cyan));
    paragraph(page, item.title, x + 14, top + 12, width - 28, fonts.bold, 9.5, color(c.navy), 12, 1);
    paragraph(page, item.subtitle, x + 14, top + 28, width - 28, fonts.regular, 7.5, color(c.cyan), 10, 1);
    paragraph(page, item.body, x + 14, top + 47, width - 28, fonts.regular, 8, color(c.lightText), 12, 4);
    let tagX = x + 14;
    for (const tag of item.tags) {
      const tagWidth = fonts.bold.widthOfTextAtSize(tag, 6.5) + 12;
      if (tagX + tagWidth > x + width - 10) break;
      rect(page, tagX, top + 112, tagWidth, 14, color(c.cyanSoft));
      page.drawText(tag, {
        x: tagX + 6,
        y: PAGE_HEIGHT - top - 122,
        size: 6.5,
        font: fonts.bold,
        color: color(c.navy),
      });
      tagX += tagWidth + 4;
    }
    top += 151;
  }
  addFooter(page, brand, fonts, 6);
}

function drawClosing(
  doc: PDFDocument,
  brand: BrochureBrand,
  fonts: { regular: PDFFont; bold: PDFFont }
): void {
  const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const c = brand.colors;
  rect(page, 0, 0, PAGE_WIDTH, PAGE_HEIGHT, color(c.navy));
  for (let x = -100; x < PAGE_WIDTH; x += 28) {
    page.drawLine({
      start: { x, y: 0 },
      end: { x: x + PAGE_HEIGHT, y: PAGE_HEIGHT },
      thickness: 0.35,
      color: color(c.navyLight),
    });
  }
  rect(page, 0, 0, PAGE_WIDTH, 4, color(c.cyan));
  addLogo(page, brand, fonts, 20, 22);
  const email = 'havencarty@outlook.com';
  page.drawText(email, {
    x: PAGE_WIDTH - 20 - fonts.regular.widthOfTextAtSize(email, 8),
    y: PAGE_HEIGHT - 34,
    size: 8,
    font: fonts.regular,
    color: color(c.mid),
  });
  const x = MARGIN;
  const width = PAGE_WIDTH - MARGIN * 2;
  paragraph(page, 'Next Steps', x, 96, width, fonts.bold, 24, color(c.white), 29, 1);
  rule(page, x, 135, 82, color(c.cyan), 2);
  const closing =
    `We would welcome the opportunity to walk through this brochure, align on scope, and discuss how ${brand.name} can support your programme. No obligation - just a straightforward conversation about what you need and how we can help.`;
  paragraph(page, closing, x, 158, width, fonts.regular, 9.5, color(c.darkBgText), 15, 5);

  const steps = [
    ['01', 'Get in touch', 'Introduce your project requirements by email or LinkedIn.'],
    ['02', 'Scoping call', 'A 30-60 minute call to understand your stack, timelines, and deliverables.'],
    ['03', 'Proposal & SOW', 'Receive a tailored statement of work and quote.'],
    ['04', 'Kick-off', 'Contracts signed and work commences on your timeline.'],
  ];
  const cardWidth = (width - 24) / 4;
  steps.forEach(([number, title, body], index) => {
    const left = x + index * (cardWidth + 8);
    rect(page, left, 265, cardWidth, 112, color(c.navyLight));
    paragraph(page, number, left + 10, 278, cardWidth - 20, fonts.bold, 18, color(c.cyan), 22, 1);
    paragraph(page, title, left + 10, 306, cardWidth - 20, fonts.bold, 8, color(c.white), 11, 2);
    paragraph(page, body, left + 10, 332, cardWidth - 20, fonts.regular, 7, color(c.mid), 10, 4);
  });
  rect(page, x, 406, width, 56, color(c.cyan));
  paragraph(page, email, x + 16, 418, width - 32, fonts.bold, 13, color(c.navy), 17, 1);
  paragraph(
    page,
    `${brand.name} Limited  |  ${brand.industry}  |  SIC 62012  |  UK / Remote`,
    x + 16,
    440,
    width - 32,
    fonts.regular,
    7.5,
    color(c.navyLight),
    10,
    2
  );
  addFooter(page, brand, fonts, 7, true);
}



export class A4BrochureGenerator {
  private readonly brand: BrochureBrand;
  private readonly outputPath?: string;

  constructor(brandSlug = 'cluster', outputPath?: string) {
    const brand = brands[brandSlug];
    if (!brand) {
      throw new Error('Unknown brand "' + brandSlug + '". Choose from: ' + Object.keys(brands).join(', '));
    }
    this.brand = brand;
    this.outputPath = outputPath;
  }

  async generate(): Promise<string> {
    const doc = await PDFDocument.create();
    doc.setTitle(this.brand.name + ' - Software Consultancy Brochure');
    doc.setAuthor('Haven Carty');
    doc.setSubject('Software Consultancy Brochure - ' + this.brand.name);
    doc.setProducer('Cluster Proposal Generator (pdf-lib)');

    const fonts = {
      regular: await doc.embedFont(StandardFonts.Helvetica),
      bold: await doc.embedFont(StandardFonts.HelveticaBold),
    };
    this.renderPages(doc, fonts);

    const defaultName = this.brand.name.replace(/ & /g, '_').replace(/\s/g, '') + '_Brochure.pdf';
    const destination = path.resolve(
      this.outputPath ?? path.join(__dirname, '..', 'output', defaultName)
    );
    mkdirSync(path.dirname(destination), { recursive: true });
    writeFileSync(destination, await doc.save());
    return destination;
  }

  private renderPages(
    doc: PDFDocument,
    fonts: { regular: PDFFont; bold: PDFFont }
  ): void {
    drawCover(doc, this.brand, fonts);
    drawBrief(doc, this.brand, fonts);
    drawServices(doc, this.brand, fonts);
    drawTimescales(doc, this.brand, fonts);
    drawTeam(doc, this.brand, fonts);
    drawPortfolio(doc, this.brand, fonts);
    drawClosing(doc, this.brand, fonts);
  }
}

function parseBrochureArgs(args: string[]): { brand: string; output?: string } {
  let brand = 'cluster';
  let output: string | undefined;
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === '--brand') {
      const value = args[index + 1];
      if (!value || value.startsWith('--')) throw new Error('--brand requires a value.');
      brand = value;
      index += 1;
    } else if (argument === '--output') {
      const value = args[index + 1];
      if (!value || value.startsWith('--')) throw new Error('--output requires a path.');
      output = value;
      index += 1;
    } else if (argument === '--help' || argument === '-h') {
      console.log('Usage: npm run brochure -- [--brand cluster|playprouk|smart-meter] [--output file.pdf]');
      return { brand: '__help__' };
    } else {
      throw new Error('Unknown argument "' + argument + '". Use --help for usage.');
    }
  }
  return { brand, output };
}

async function runBrochureCli(): Promise<void> {
  try {
    const { brand, output } = parseBrochureArgs(process.argv.slice(2));
    if (brand === '__help__') return;
    const destination = await new A4BrochureGenerator(brand, output).generate();
    console.log('Wrote ' + destination + ' (7-page A4 brochure, brand: ' + brand + ').');
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}

if (require.main === module) void runBrochureCli();
