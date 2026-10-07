/**
 * types.ts
 * -----------------------------------------------------------------------
 * The shape of the JSON a person (or an LLM, following PROMPT_TEMPLATE
 * in prompt.ts) hands to the generator. Keeping this separate from
 * theme.ts means the SAME theme can render many different proposals,
 * and the same content shape could later be rendered with a different
 * theme for a different brand.
 * -----------------------------------------------------------------------
 */

export type StaffTier = 'Junior' | 'Senior';

/** The disciplines this generator knows how to bucket staffing under.
 *  Extend this list if a new agency adds a capability. */
export type WorkStream =
  | 'Design'
  | 'Development'
  | 'Manufacturing'
  | 'Manufacturing & Electronics'
  | 'Liaison'
  | 'Liaison & Management'
  | 'Test & Compliance';

/** The specific roles that roll up into a WorkStream. */
export type RoleTitle =
  | 'Project Manager'
  | 'UX / Product Designer'
  | 'Front-end Developer'
  | 'Back-end Developer'
  | 'Embedded Systems Engineer'
  | 'PCB Designer'
  | 'Manufacturing / Prototyping Engineer'
  | 'ODM / Supplier Liaison';

export interface StaffLine {
  role: RoleTitle;
  tier: StaffTier;
  workStream: WorkStream;
  dayRate: number;
  days: number;
  /** Optional one-line justification, e.g. "Firmware for the sensor node" */
  note?: string;
}

export interface PortfolioItem {
  title: string;
  client?: string;
  description: string;
  /** Absolute or relative path to a local image file (optional) */
  imagePath?: string;
}

export interface ServiceCard {
  title: string;
  body: string;
  /** Optional local image path shown above the card copy */
  imagePath?: string;
  /** Short tech tags rendered as chips, e.g. ["C# .NET", "Azure DevOps"] */
  tags?: string[];
}

export interface TimelinePhase {
  weeks: string; // e.g. "1 - 4"
  summary: string;
}

export interface TimelineTrack {
  trackTitle: string; // e.g. "Design & Firmware"
  rows: { label: string; detail: string }[];
  weeksLabel?: string; // e.g. "Weeks 1 - 6"
}

export interface CostingPhase {
  phase: string;
  manDays: number;
  fee: number; // excl. VAT, in the chosen currency
}

export interface CoverTile {
  label: string;
  detail: string;
}

export interface Differentiator {
  title: string;
  body: string;
}

export interface StepItem {
  number: string;
  title: string;
  body: string;
}

export interface CommercialTerm {
  label: string;
  value: string;
}

export interface ProposalContent {
  currencySymbol: '£' | '€' | '$';
  vatRate: number; // e.g. 0.20 for 20%

  /** Optional short "who we are" blurb, rendered on the cover beneath
   *  the strapline. Keep to 2-3 sentences — the cover has limited room. */
  about?: {
    heading: string; // about-section heading text
    body: string;
  };
  /** Optional tile strip on the cover (SIC, insured, operates, trading entity). */
  coverTiles?: CoverTile[];

  cover: {
    clientName: string;
    projectTitle: string;
    strapline: string; // e.g. "Software consultants | Industry 4.0 | ..."
    /** If a day-rate headline exists, it goes on the cover and the
     *  Value & Costing section becomes optional / can be dropped to
     *  save a page. Leave undefined to force a dedicated Costing page. */
    dayRate?: number;
    preparedFor: string; // e.g. "Steve, David, Fraser"
    contactEmail: string;
  };

  brief: {
    heading: string; // usually "Brief"
    body: string;
    mission?: string;
    vision?: string;
    purpose?: string;
    /** Optional "What makes us different" cards rendered below the
     *  Mission/Vision/Purpose strip. */
    differentiators?: Differentiator[];
  };

  response: {
    heading: string; // usually "Our Services" / "Response"
    intro: string;
    cards: ServiceCard[];
    /** Optional second-tier specialist services shown in a 2×2 grid
     *  below the main card grid. */
    optionalCards?: ServiceCard[];
  };

  /** Optional — omit to save a page inside the 8-page budget */
  portfolio?: {
    heading: string;
    items: PortfolioItem[];
    /** Tech pills rendered as badges on each portfolio item. */
    showTags?: boolean;
  };

  timeframe: {
    heading: string; // usually "Timescales" / "Timeframe"
    indicativeDuration: string; // e.g. "Indicative 16 Week Timeframe"
    phases: TimelinePhase[];
    tracks: TimelineTrack[];
    /** Optional management activities track rendered as a summary row
     *  at the foot of the phase table. */
    managementActivities?: string[];
  };

  /** Staffing / work-item breakdown by discipline and seniority.
   *  Rendered as its own page if it doesn't fit alongside Costing. */
  staffing: {
    heading: string; // usually "Team & Work Items"
    lines: StaffLine[];
    /** When true, renders in a 2-column layout (left: Design +
     *  Development, right: Liaison + Manufacturing). */
    twoColumn?: boolean;
  };

  /** Only required if cover.dayRate is not set. If both are present,
   *  the generator still renders it (useful for a detailed breakdown)
   *  but will warn if the 8-page budget is exceeded. */
  costing?: {
    heading: string;
    phases: CostingPhase[];
  };

  closing: {
    heading: string; // usually "Next Steps" / "Thank You"
    body: string;
    contactEmail: string;
    /** Optional 4-step process shown as numbered tiles. */
    steps?: StepItem[];
    /** Optional commercial-terms summary card. */
    commercialTerms?: CommercialTerm[];
  };
}
