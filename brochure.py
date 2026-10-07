"""ReportLab PDF generators for branded brochures and 16:9 proposal pages."""

import argparse
from pathlib import Path

from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import inch, mm
from reportlab.pdfgen import canvas
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import Paragraph
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT
import math

W, H = A4

def _hex(h):
    return colors.HexColor(h)

# ── colour palettes ─────────────────────────────────────────────────
_CLUSTER_COLORS = {
    'navy': _hex('#0D1B3E'), 'navyLight': _hex('#1A2F5E'),
    'cyan': _hex('#00C2CB'), 'cyanSoft': _hex('#E0F9FA'),
    'white': colors.white, 'offwhite': _hex('#F5F7FA'),
    'mid': _hex('#8A9AB5'), 'darkText': _hex('#1C2B4A'),
    'lightText': _hex('#4A5A78'), 'rule': _hex('#D0D8E8'),
    'greenDot': _hex('#00D26A'), 'darkBgText': _hex('#A8B8D0'),
}
_PLAYPROUK_COLORS = {
    'navy': _hex('#0F2255'), 'navyLight': _hex('#1E3A7A'),
    'cyan': _hex('#00C8D8'), 'cyanSoft': _hex('#E0F7FA'),
    'white': colors.white, 'offwhite': _hex('#F0F4F8'),
    'mid': _hex('#7A8AA5'), 'darkText': _hex('#152040'),
    'lightText': _hex('#3A4A68'), 'rule': _hex('#C8D0DC'),
    'greenDot': _hex('#00CC5A'), 'darkBgText': _hex('#98A8C8'),
}
_SMARTMETER_COLORS = {
    'navy': _hex('#0D1B3E'), 'navyLight': _hex('#142850'),
    'cyan': _hex('#00A0B8'), 'cyanSoft': _hex('#DCEFF5'),
    'white': colors.white, 'offwhite': _hex('#F2F5F8'),
    'mid': _hex('#8090A8'), 'darkText': _hex('#182848'),
    'lightText': _hex('#485878'), 'rule': _hex('#CCD4E0'),
    'greenDot': _hex('#00C850'), 'darkBgText': _hex('#A0B0C8'),
}

# ── shared content ──────────────────────────────────────────────────
_SHARED_DIFF_ITEMS = [
    ('End-to-end stack', 'From Azure-hosted .NET portals down to ESP32 firmware — contracted to a single specialist, not a fragmented team.'),
    ('Smart metering focus', 'Hands-on experience with Industry 4.0 protocols, energy asset monitoring, and data-driven O&M platforms.'),
    ('Lean & accountable', 'No agency overhead, no handoff risk. One contract, one point of accountability, senior-level delivery from day one.'),
    ('Insured & compliant', 'Covered under professional indemnity insurance for bespoke software. SIC 62012. IR35 status available on request.'),
]
_SHARED_SERVICES_CORE = [
    ('Enterprise .NET\nWeb Development',
     'MVVM architecture, Blazor / ASP.NET portals, EF Core, SQL Server, Identity Framework, CI/CD via Azure DevOps.',
     ['.NET / C#', 'Blazor', 'Azure DevOps']),
    ('Client Onboarding\nPortal & CMS',
     'Bespoke back-end portals with role-based access, dashboard analytics, and CMS for energy asset data management.',
     ['IdentityFramework', 'Dashboard', 'CMS']),
    ('IoT & Embedded\nSystems Integration',
     'ESP32 / ESP8266 firmware, I\\u00b2C master-slave, MQTT telemetry, Blues Notecard / Notehub cellular connectivity.',
     ['ESP32', 'MQTT', 'Blues IoT']),
]
_SHARED_SERVICES_EXTRAS = [
    ('High-Level Design & Wireframing',
     'Information architecture, UX wireframes, and design strategy for connected industrial products. Delivered via workshopped priority guidelines aligned to your team.',
     'Design'),
    ('Baremetal Firmware & Electronics',
     'HTML over TCP/IP, register-level peripheral configuration, brushless motor ESC control via MQTT, Arduino rapid prototyping — for teams needing device-level expertise.',
     'Firmware'),
    ('PHP / WordPress Custom Themes',
     'Custom theme development, CPT registration, REST API integration, and performance-optimised deployments on Nginx / Apache2 Linux servers with MySQL and phpMyAdmin.',
     'Web'),
    ('Audio DSP & VST Plugin Development',
     'JUCE-based audio plugin engineering (VST3 / AU) running natively on embedded Linux or RTOS. Real-time DSP pipelines — filters, delay, gain — with no audio-thread allocations.',
     'Audio'),
]
_SHARED_TIMEFRAME_PHASES = [
    ('Weeks 1\\u20134', 'Design & Planning',
     ['Wireframes & information architecture', 'Web application scope definition', 'Engineering sample specification', 'Initial web development framework'],
     None),
    ('Weeks 5\\u201312', 'Development Sprint',
     ['MVVM front-end development', 'C-based embedded firmware', 'Back-end portal & CMS build', 'Azure DevOps CI/CD pipeline'],
     _hex('#00A3AB')),
    ('Weeks 13\\u201324', 'Integration & Delivery',
     ['Board layout & schematic review', 'IoT integration & MQTT wiring', 'Client onboarding & UAT', 'Handover documentation'],
     _hex('#007A80')),
]
_SHARED_TIMEFRAME_MGMT = [
    'Multi-discipline sprint planning & stand-ups',
    'Strategy reviews & stakeholder reporting',
    'Talent acquisition & sub-contractor liaison',
    'ODM & supplier coordination',
]
_SHARED_PORTFOLIO_ITEMS = [
    ('TicketAura \\u2014 Cohesiv', 'Web Platform \\u00b7 Product Ownership',
     'Full product ownership and re-brand for a ticketing web application, taken from initial concept through to a managed, live production platform. Covered architecture, front-end, back-end, and ongoing platform management.',
     ['.NET', 'Blazor', 'Azure', 'Product Mgmt']),
    ('Just Business IT', 'WordPress \\u00b7 Front-end Development',
     'Custom WordPress theme development and front-end engineering for a UK shipping company. Delivered a bespoke, performance-optimised theme on a Linux-hosted Nginx stack with full CMS integration.',
     ['WordPress', 'PHP', 'Nginx', 'Linux']),
    ('Mewline \\u2014 Cohesiv', 'B2B Platform \\u00b7 Business Development',
     'Business development and product management for a B2B jewellery marketplace. Involved platform strategy, stakeholder engagement, and technical oversight of the product roadmap.',
     ['B2B SaaS', 'Product Strategy', 'Stakeholder Mgmt']),
    ('Smart Meter O&M Platform', 'Industry 4.0 \\u00b7 IoT \\u00b7 .NET',
     'Design and development of a renewable energy operations and maintenance monitoring platform. Bridging web-based dashboards with embedded device telemetry to support prevention vs. repair decision-making across an asset fleet.',
     ['IoT', '.NET', 'MQTT', 'Energy Tech', 'Embedded']),
]
_SHARED_STEPS = [
    ('01', 'Get in touch', 'Drop an email or connect via LinkedIn to introduce your project requirements.'),
    ('02', 'Scoping call', 'A 30\\u201360 minute call to understand your stack, timelines, and deliverables.'),
    ('03', 'Proposal & SOW', '{logo} prepares a tailored statement of work and fixed-price or day-rate quote.'),
    ('04', 'Kick-off', 'Contracts signed, IR35 determination agreed, and work commences on your timeline.'),
]

# ── per-brand team rows ─────────────────────────────────────────────
_CLUSTER_TEAM_ROWS = {
    'Design': [
        ["UX / Product Designer", "Senior", "\u00a3440.00", "3", "\u00a31,320.00"],
        ["UX / Product Designer", "Junior", "\u00a3250.00", "5", "\u00a31,250.00"],
    ],
    'Development': [
        ["Front-end Developer (.NET / Blazor)", "Senior", "\u00a3450.00", "8", "\u00a33,600.00"],
        ["Front-end Developer", "Junior", "\u00a3280.00", "10", "\u00a32,800.00"],
        ["Back-end Developer", "Senior", "\u00a3460.00", "9", "\u00a34,140.00"],
        ["Embedded Systems Engineer", "Senior", "\u00a3480.00", "12", "\u00a35,760.00"],
    ],
    'Manufacturing & Electronics': [
        ["PCB Designer", "Senior", "\u00a3470.00", "6", "\u00a32,820.00"],
        ["Manufacturing / Prototyping Engineer", "Junior", "\u00a3260.00", "4", "\u00a31,040.00"],
    ],
    'Liaison & Management': [
        ["Project Manager", "Senior", "\u00a3400.00", "6", "\u00a32,400.00"],
        ["ODM / Supplier Liaison", "Senior", "\u00a3400.00", "3", "\u00a31,200.00"],
    ],
}
_PLAYPROUK_TEAM_ROWS = {
    'Design': [
        ["UX / Product Designer", "Senior", "\u00a3420.00", "3", "\u00a31,260.00"],
        ["UX / Product Designer", "Junior", "\u00a3240.00", "5", "\u00a31,200.00"],
    ],
    'Development': [
        ["Mobile Developer (React Native)", "Senior", "\u00a3440.00", "8", "\u00a33,520.00"],
        ["Mobile Developer", "Junior", "\u00a3270.00", "10", "\u00a32,700.00"],
        ["Back-end Developer (.NET 8)", "Senior", "\u00a3450.00", "9", "\u00a34,050.00"],
        ["Computer Vision Engineer", "Senior", "\u00a3500.00", "12", "\u00a36,000.00"],
    ],
    'Liaison & Management': [
        ["Project Manager", "Senior", "\u00a3390.00", "6", "\u00a32,340.00"],
        ["Academy / Club Liaison", "Senior", "\u00a3390.00", "3", "\u00a31,170.00"],
    ],
    'Test & Compliance': [
        ["QA / Test Engineer", "Junior", "\u00a3250.00", "4", "\u00a31,000.00"],
        ["Safeguarding / GDPR Officer", "Senior", "\u00a3400.00", "3", "\u00a31,200.00"],
    ],
}
_SMARTMETER_TEAM_ROWS = {
    'Design': [
        ["UX / Product Designer", "Senior", "\u00a3450.00", "3", "\u00a31,350.00"],
        ["UX / Product Designer", "Junior", "\u00a3260.00", "5", "\u00a31,300.00"],
    ],
    'Development': [
        ["Front-end Developer (Blazor / .NET)", "Senior", "\u00a3460.00", "8", "\u00a33,680.00"],
        ["Front-end Developer", "Junior", "\u00a3290.00", "10", "\u00a32,900.00"],
        ["Back-end Developer (Azure)", "Senior", "\u00a3470.00", "9", "\u00a34,230.00"],
        ["Embedded Systems / Firmware Engineer", "Senior", "\u00a3490.00", "12", "\u00a35,880.00"],
    ],
    'Manufacturing & Electronics': [
        ["PCB Designer", "Senior", "\u00a3480.00", "6", "\u00a32,880.00"],
        ["Manufacturing / Prototyping Engineer", "Junior", "\u00a3270.00", "4", "\u00a31,080.00"],
    ],
    'Liaison & Management': [
        ["Project Manager", "Senior", "\u00a3410.00", "6", "\u00a32,460.00"],
        ["ODM / Supplier Liaison", "Senior", "\u00a3410.00", "3", "\u00a31,230.00"],
    ],
}  # ── Active brand toggle ─────────────────────────────────────────────

BRANDS = {
    'cluster': {
        'name': 'Cluster Technology',
        'tagline': 'Bespoke Business & Leisure Software',
        'sic_code': '62012',
        'insured_for': 'Bespoke Software',
        'operates': 'UK / Remote',
        'author': 'Haven Carty',
        'owner': 'Haven Carty',
        'industry': 'smart metering, renewable energy, and energy manufacturing supply chain',
        'cover_title_lines': ['Smart Meter &', 'Energy Technology'],
        'cover_title_accent': 'Software Consultancy',
        'strapline': 'provides specialist software consultancy to the {industry}. We bridge the gap between cloud platforms and connected hardware \u2014 delivering {tech} under a single, accountable contract.',
        'strapline_technology': 'robust .NET portals, embedded firmware, and IoT integrations',
        'tags': ['Software Consultants', 'Industry 4.0', 'IoT & Embedded', '.NET / Blazor', 'Smart Metering'],
        'mv_mission': 'To establish a seamless fusion of digital and tangible elements within connected products \u2014 delivering exceptional user experiences across industrial IoT and enterprise platforms.',
        'mv_vision': 'To become the trusted technical partner for energy and smart metering companies that require both cloud-side engineering and device-level firmware expertise under one contract.',
        'mv_purpose': 'To solve hard problems in cyber-physical systems and human-computer interaction \u2014 bringing clarity and precision to the complex boundary between hardware and software.',
        'diff_items': _SHARED_DIFF_ITEMS,
        'services_intro': 'offers a focused core consultancy service tailored to {industry}, with a suite of optional specialist services available as project extensions.',
        'services_core_title': 'Core Consultancy Services',
        'services_optional_title': 'Optional Specialist Services',
        'services_optional_note': 'Available as project extensions \u2014 quoted separately',
        'services_core': _SHARED_SERVICES_CORE,
        'services_extras': _SHARED_SERVICES_EXTRAS,
        'timeframe_intro': 'The typical engagement follows a structured three-phase delivery model. Timescales are indicative and will be agreed at scoping stage.',
        'timeframe_mgmt_title': 'Management Activities (Ongoing)',
        'timeframe_indicative': 'Indicative 24-week engagement timeframe  \u00b7  Scope and phases agreed at kick-off  \u00b7  Weekly status reporting included as standard',
        'timeframe_phases': _SHARED_TIMEFRAME_PHASES,
        'timeframe_mgmt_items': _SHARED_TIMEFRAME_MGMT,
        'team_title': 'Team & Day Rates',
        'team_intro': '{logo} operates as a specialist individual contractor. The rates below reflect {owner}\'s cross-disciplinary expertise and represent strong value against the cost of equivalent agency teams. Sub-contracted specialists can be introduced where project scope requires, quoted separately and transparently.',
        'portfolio_intro': 'A selection of recent engagements demonstrating {logo}\'s breadth across web platforms, embedded systems, and product development.',
        'portfolio_items': _SHARED_PORTFOLIO_ITEMS,
        'steps': _SHARED_STEPS,
        'colors': _CLUSTER_COLORS,
        'logo_text': 'Cluster Technology',
        'footer_confidential': 'Proprietary & Confidential',
        'contact_email': 'havencarty@outlook.com',
        'day_rate': '\u00a3450.00 / day',
        'day_rate_sub': 'Standard day-rate  \u00b7  excl. VAT  \u00b7  IR35 status negotiable',
        'team_rows': _CLUSTER_TEAM_ROWS,
        'total_row': '\u00a326,330.00',
    },
    'playprouk': {
        'name': 'PlayProUK',
        'tagline': 'Bespoke Business & Leisure Software',
        'sic_code': '62012',
        'insured_for': 'Bespoke Software',
        'operates': 'UK / Remote',
        'author': 'Haven Carty',
        'owner': 'Haven Carty',
        'industry': 'sports analytics, mobile applications, and data intelligence platforms',
        'cover_title_lines': ['PlayPro', '\u2014 Grassroots Football'],
        'cover_title_accent': 'Data & Analytics Platform',
        'strapline': 'provides specialist software consultancy to the {industry}. We bridge the gap between match footage and player insights \u2014 delivering {tech} under a single, accountable contract.',
        'strapline_technology': 'cross-platform mobile apps, cloud backends, and AI-powered analytics',
        'tags': ['Software Consultants', 'Sports Analytics', 'Mobile App', 'Data Intelligence', 'Grassroots to Pro'],
        'mv_mission': 'To democratise access to professional-grade performance data for grassroots football, giving every player the opportunity to be discovered.',
        'mv_vision': "To become the UK's leading platform bridging grassroots talent with professional clubs through data-driven scouting and analytics.",
        'mv_purpose': 'To solve the visibility gap between grassroots football and professional recruitment by making match data accessible, affordable, and actionable.',
        'diff_items': [
            ('End-to-end stack', 'From cloud-hosted analytics pipelines down to mobile apps \u2014 contracted to a single specialist, not a fragmented team.'),
            ('Sports data focus', 'Hands-on experience with match footage ingestion, player tracking, and performance metrics for grassroots and non-league football.'),
            ('Lean & accountable', 'No agency overhead, no handoff risk. One contract, one point of accountability, senior-level delivery from day one.'),
            ('Insured & compliant', 'Covered under professional indemnity insurance for bespoke software. SIC 62012. IR35 status available on request.'),
        ],
        'services_intro': 'offers a focused core consultancy service tailored to {industry}, with a suite of optional specialist services available as project extensions.',
        'services_core_title': 'Core Consultancy Services',
        'services_optional_title': 'Optional Specialist Services',
        'services_optional_note': 'Available as project extensions \u2014 quoted separately',
        'services_core': [
            ('Mobile App\n(Cross-Platform)',
             'React Native or Flutter apps for iOS and Android, delivering player profiles, league dashboards, and match analytics in a clean, performant interface.',
             ['React Native', 'Flutter', 'iOS', 'Android']),
            ('Video Ingestion\n& CV Pipeline',
             'Automated pipeline to process Veo match recordings, extract player tracking data, and compute per-player metrics using computer vision and ML models.',
             ['Python', 'OpenCV', 'ML Pipeline', 'Veo API']),
            ('Cloud Backend\n& APIs',
             'Scalable .NET 8 / Azure backend with REST APIs, real-time data sync, authentication, and multi-tenant league management.',
             ['.NET 8', 'Azure', 'REST API', 'Cosmos DB']),
        ],
        'services_extras': [
            ('Player Analytics Dashboard',
             'Web-based admin and league dashboard showing player rankings, positional comparisons, physical benchmarks, and club recruitment tools.',
             'Analytics'),
            ('Player Profiling & AI',
             'Positional role matching, performance scoring against benchmarks, and personality profiling to give clubs a holistic view of each player.',
             'AI/ML'),
            ('Safeguarding & Compliance',
             'Built-in safeguarding protocols for under-18 players, automated parent/guardian routing, and GDPR-compliant data handling throughout.',
             'Compliance'),
            ('League Administration',
             'Multi-tenant league management, scheduling tools, and club portal integration for grassroots football organisations.',
             'Platform'),
        ],
        'timeframe_intro': 'The typical engagement follows a structured three-phase delivery model. Timescales are indicative and will be agreed at scoping stage.',
        'timeframe_mgmt_title': 'Management Activities (Ongoing)',
        'timeframe_indicative': 'Indicative 20-week engagement timeframe  \u00b7  Scope and phases agreed at kick-off  \u00b7  Weekly status reporting included as standard',
        'timeframe_phases': [
            ('Weeks 1\u20134', 'Discovery & Design',
             ['User research with partner clubs', 'UI/UX wireframes and interaction design', 'Data model design for players and leagues', 'API contract mapping (Veo)'],
             None),
            ('Weeks 5\u201310', 'Core MVP Development',
             ['Cross-platform mobile app (player profiles)', '.NET 8 backend, auth, league management', 'Computer vision pipeline for match footage', 'Player analytics scoring engine'],
             _hex('#00A3AB')),
            ('Weeks 11\u201320', 'Pipeline, UAT & Launch',
             ['Video ingestion pipeline integration', 'Player analytics and benchmarking', 'Admin/league web dashboard (Blazor)', 'UAT and launch preparation'],
             _hex('#007A80')),
        ],
        'timeframe_mgmt_items': [
            'Sprint planning and stakeholder demos',
            'Safeguarding compliance and GDPR review',
            'UAT with partner clubs and academies',
            'App Store submission and launch preparation',
        ],
        'team_title': 'Team & Day Rates',
        'team_intro': '{logo} operates as a specialist individual contractor. The rates below reflect {owner}\'s cross-disciplinary expertise and represent strong value against the cost of equivalent agency teams. Sub-contracted specialists can be introduced where project scope requires, quoted separately and transparently.',
        'portfolio_intro': "A selection of recent engagements demonstrating {logo}'s breadth across mobile, cloud, analytics, and data platforms.",
        'portfolio_items': [
            ('PlayPro \u2014 Grassroots Football', 'Mobile App \u00b7 Data Analytics',
             'Cross-platform mobile app and analytics platform for grassroots football, ingesting match footage and delivering player performance metrics to clubs and leagues.',
             ['React Native', 'Flutter', 'Azure', 'Data Viz']),
            ('Smart Meter O&M Platform', 'Industry 4.0 \u00b7 IoT \u00b7 .NET',
             'IoT-driven operations and maintenance monitoring platform bridging embedded device telemetry with .NET web dashboards for renewable energy assets.',
             ['IoT', '.NET', 'MQTT', 'Energy Tech']),
            ('TicketAura \u2014 Cohesiv', 'Web Platform \u00b7 Product Ownership',
             'Full product ownership and re-brand for a ticketing web application, delivered from concept through to managed production.',
             ['.NET', 'Blazor', 'Azure', 'Product Mgmt']),
        ],
        'steps': _SHARED_STEPS,
        'colors': _PLAYPROUK_COLORS,
        'logo_text': 'PlayProUK',
        'footer_confidential': 'Confidential \u2014 PlayProUK',
        'contact_email': 'havencarty@outlook.com',
        'day_rate': '\u00a3425.00 / day',
        'day_rate_sub': 'Sports analytics day-rate  \u00b7  excl. VAT',
        'team_rows': _PLAYPROUK_TEAM_ROWS,
        'total_row': '\u00a324,770.00',
    },
    'smart-meter': {
        'name': 'Smart Meter & Energy Technology',
        'tagline': 'Bespoke Business & Leisure Software',
        'sic_code': '62012',
        'insured_for': 'Bespoke Software',
        'operates': 'UK / Remote',
        'author': 'Haven Carty',
        'owner': 'Haven Carty',
        'industry': 'smart metering, renewable energy, and energy manufacturing supply chain',
        'cover_title_lines': ['Smart Meter &', 'Energy Technology'],
        'cover_title_accent': 'Software Consultancy',
        'strapline': 'provides specialist software consultancy to the {industry}. We bridge the gap between cloud platforms and connected hardware \u2014 delivering {tech} under a single, accountable contract.',
        'strapline_technology': 'robust .NET portals, embedded firmware, and IoT integrations',
        'tags': ['Software Consultants', 'Industry 4.0', 'IoT & Embedded', '.NET / Blazor', 'Smart Metering'],
        'mv_mission': 'To establish a seamless fusion of digital and tangible elements within connected products \u2014 delivering exceptional user experiences across industrial IoT and enterprise platforms.',
        'mv_vision': 'To become the trusted technical partner for energy and smart metering companies that require both cloud-side engineering and device-level firmware expertise under one contract.',
        'mv_purpose': 'To solve hard problems in cyber-physical systems and human-computer interaction \u2014 bringing clarity and precision to the complex boundary between hardware and software.',
        'diff_items': _SHARED_DIFF_ITEMS,
        'services_intro': 'offers a focused core consultancy service tailored to {industry}, with a suite of optional specialist services available as project extensions.',
        'services_core_title': 'Core Consultancy Services',
        'services_optional_title': 'Optional Specialist Services',
        'services_optional_note': 'Available as project extensions \u2014 quoted separately',
        'services_core': _SHARED_SERVICES_CORE,
        'services_extras': _SHARED_SERVICES_EXTRAS,
        'timeframe_intro': 'The typical engagement follows a structured three-phase delivery model. Timescales are indicative and will be agreed at scoping stage.',
        'timeframe_mgmt_title': 'Management Activities (Ongoing)',
        'timeframe_indicative': 'Indicative 24-week engagement timeframe  \u00b7  Scope and phases agreed at kick-off  \u00b7  Weekly status reporting included as standard',
        'timeframe_phases': _SHARED_TIMEFRAME_PHASES,
        'timeframe_mgmt_items': _SHARED_TIMEFRAME_MGMT,
        'team_title': 'Expert Team & Day Rates',
        'team_intro': '{logo} operates as a specialist individual contractor. The rates below reflect {owner}\'s cross-disciplinary expertise and represent strong value against the cost of equivalent agency teams. Sub-contracted specialists can be introduced where project scope requires, quoted separately and transparently.',
        'portfolio_intro': "A selection of recent engagements demonstrating {logo}'s breadth across web platforms, embedded systems, and product development.",
        'portfolio_items': _SHARED_PORTFOLIO_ITEMS,
        'steps': _SHARED_STEPS,
        'colors': _SMARTMETER_COLORS,
        'logo_text': 'Smart Meter & Energy Technology',
        'footer_confidential': 'Proprietary & Confidential',
        'contact_email': 'havencarty@outlook.com',
        'day_rate': '\u00a3475.00 / day',
        'day_rate_sub': 'Energy technology consultancy  \u00b7  excl. VAT',
        'team_rows': _SMARTMETER_TEAM_ROWS,
        'total_row': '\u00a327,130.00',
    },
}
ACTIVE_BRAND = 'cluster'

BRAND = BRANDS[ACTIVE_BRAND]
C = BRAND['colors']
LOGO_TEXT    = BRAND['logo_text']
FOOTER_CONF  = BRAND['footer_confidential']
CONTACT_EMAIL = BRAND['contact_email']
DAY_RATE     = BRAND['day_rate']
DAY_RATE_SUB = BRAND['day_rate_sub']
OUTPUT = Path(__file__).resolve().parent / "output" / f"{LOGO_TEXT.replace(' & ', '_').replace(' ', '')}_Brochure.pdf"

# ── Drawing helpers ──────────────────────────────────────────────────
INTEGRATE_ORANGE = colors.HexColor('#F05539')
INTEGRATE_DARK = colors.HexColor('#242328')
INTEGRATE_CARD_DARK = colors.HexColor('#1B1A1F')
INTEGRATE_BLUE = colors.HexColor('#286FBF')
INTEGRATE_TEAL = colors.HexColor('#2A6C86')
INTEGRATE_GREEN = colors.HexColor('#8FBF5C')
INTEGRATE_WHITE = colors.white
INTEGRATE_GREY = colors.HexColor('#C9C7C5')
INTEGRATE_GREY_DARK = colors.HexColor('#9A9793')
INTEGRATE_DIVIDER = colors.HexColor('#3A3940')
INTEGRATE_COLORS = {
    'orange': INTEGRATE_ORANGE,
    'dark': INTEGRATE_DARK,
    'card_dark': INTEGRATE_CARD_DARK,
    'blue': INTEGRATE_BLUE,
    'teal': INTEGRATE_TEAL,
    'green': INTEGRATE_GREEN,
    'white': INTEGRATE_WHITE,
    'grey': INTEGRATE_GREY,
    'grey_dark': INTEGRATE_GREY_DARK,
    'divider': INTEGRATE_DIVIDER,
}
INTEGRATE_FONT_HEAD = 'Helvetica-Bold'
INTEGRATE_FONT_BODY = 'Helvetica'
INTEGRATE_PAGE_W = 13.333 * inch
INTEGRATE_PAGE_H = 7.5 * inch


def new_integrate_pdf(path):
    """Create a blank 16:9 PDF canvas for Integrate-themed pages."""
    pdf = canvas.Canvas(str(path), pagesize=(INTEGRATE_PAGE_W, INTEGRATE_PAGE_H))
    pdf.setTitle('Integrate Proposal')
    return pdf


def integrate_add_page(pdf, bg_color=INTEGRATE_ORANGE):
    """Fill the current 16:9 PDF page with a solid background."""
    pdf.saveState()
    pdf.setFillColor(bg_color)
    pdf.rect(0, 0, INTEGRATE_PAGE_W, INTEGRATE_PAGE_H, fill=1, stroke=0)
    pdf.restoreState()


def _integrate_paragraph(pdf, text, x, y, w, h, size, color, font,
                         bold=False, italic=False, align=TA_LEFT,
                         line_spacing=1.25):
    if bold and italic:
        font = 'Helvetica-BoldOblique'
    elif bold:
        font = 'Helvetica-Bold'
    elif italic:
        font = 'Helvetica-Oblique'
    style = ParagraphStyle(
        'integrate_text', fontName=font, fontSize=size, textColor=color,
        leading=size * line_spacing, alignment=align,
    )
    paragraph = Paragraph(text.replace('\n', '<br/>'), style)
    _, height = paragraph.wrap(w * inch, h * inch)
    paragraph.drawOn(pdf, x * inch, INTEGRATE_PAGE_H - y * inch - height)
    return height


def integrate_page_num(pdf, number, color=INTEGRATE_WHITE):
    _integrate_paragraph(pdf, f'{number:02d}', 0.4, 0.28, 0.8, 0.35,
                         12, color, INTEGRATE_FONT_BODY, bold=True)


def integrate_eyebrow(pdf, text, x=0.55, y=0.35, w=9, color=INTEGRATE_WHITE):
    _integrate_paragraph(pdf, text.upper(), x, y, w, 0.35, 12, color,
                         INTEGRATE_FONT_BODY, bold=True)


def integrate_title(pdf, text, x=0.55, y=0.65, w=10.8, h=0.95,
                    size=32, color=INTEGRATE_WHITE):
    _integrate_paragraph(pdf, text, x, y, w, h, size, color,
                         INTEGRATE_FONT_HEAD, bold=True)


def integrate_subtitle(pdf, text, x=0.55, y=1.55, w=10.8, h=0.6,
                       size=14, color=INTEGRATE_GREY):
    _integrate_paragraph(pdf, text, x, y, w, h, size, color,
                         INTEGRATE_FONT_BODY)


def integrate_body_text(pdf, text, x, y, w, h, size=12, color=INTEGRATE_GREY,
                        bold=False, italic=False, align=TA_LEFT,
                        line_spacing=1.25):
    return _integrate_paragraph(pdf, text, x, y, w, h, size, color,
                                INTEGRATE_FONT_BODY, bold, italic, align,
                                line_spacing)


def integrate_footer_logo(pdf, path, x=11.55, y=6.95, w=1.35, h=0.293):
    pdf.drawImage(path, x * inch, INTEGRATE_PAGE_H - (y + h) * inch,
                  w * inch, h * inch, preserveAspectRatio=True, mask='auto')


def integrate_rounded_rect(pdf, x, y, w, h, fill=INTEGRATE_CARD_DARK,
                           radius=0.08):
    pdf.saveState()
    pdf.setFillColor(fill)
    pdf.roundRect(x * inch, INTEGRATE_PAGE_H - (y + h) * inch,
                  w * inch, h * inch, radius * inch, fill=1, stroke=0)
    pdf.restoreState()


def integrate_circle(pdf, x, y, diameter, fill=INTEGRATE_ORANGE):
    pdf.saveState()
    pdf.setFillColor(fill)
    pdf.circle((x + diameter / 2) * inch,
               INTEGRATE_PAGE_H - (y + diameter / 2) * inch,
               diameter * inch / 2, fill=1, stroke=0)
    pdf.restoreState()


def integrate_divider_line(pdf, x, y, w, color=INTEGRATE_DIVIDER,
                           weight_pt=0.75):
    pdf.saveState()
    pdf.setStrokeColor(color)
    pdf.setLineWidth(weight_pt)
    pdf.line(x * inch, INTEGRATE_PAGE_H - y * inch,
             (x + w) * inch, INTEGRATE_PAGE_H - y * inch)
    pdf.restoreState()


def integrate_mission_blob(pdf, x=7.15, y=0.55, w=5.6, h=6.4,
                           fill=INTEGRATE_BLUE, radius=0.35):
    return integrate_rounded_rect(pdf, x, y, w, h, fill=fill, radius=radius)


def integrate_card(pdf, x, y, w, h, glyph, card_title, card_body,
                   icon_color=INTEGRATE_ORANGE,
                   card_fill=INTEGRATE_CARD_DARK):
    integrate_rounded_rect(pdf, x, y, w, h, fill=card_fill)
    diameter = 0.58
    circle_x = x + w / 2 - diameter / 2
    integrate_circle(pdf, circle_x, y + 0.3, diameter, fill=icon_color)
    integrate_body_text(pdf, glyph, circle_x, y + 0.37, diameter, 0.4,
                        size=18, color=INTEGRATE_WHITE, bold=True,
                        align=TA_CENTER)
    integrate_body_text(pdf, card_title, x + 0.18, y + 1.05,
                        w - 0.36, 0.6, size=14, color=INTEGRATE_WHITE,
                        bold=True, align=TA_CENTER, line_spacing=1.05)
    integrate_body_text(pdf, card_body, x + 0.2, y + 1.7,
                        w - 0.4, h - 1.9, size=10.5, color=INTEGRATE_GREY,
                        align=TA_CENTER, line_spacing=1.18)


def integrate_stat_chip(pdf, x, y, w, h, value, label,
                        value_color=INTEGRATE_GREEN):
    integrate_rounded_rect(pdf, x, y, w, h, fill=INTEGRATE_CARD_DARK,
                           radius=0.06)
    integrate_body_text(pdf, value, x + 0.1, y + 0.12, w - 0.2,
                        h * 0.55, size=24, color=value_color, bold=True,
                        align=TA_CENTER)
    integrate_body_text(pdf, label, x + 0.1, y + h * 0.62, w - 0.2,
                        h * 0.35, size=10.5, color=INTEGRATE_GREY,
                        align=TA_CENTER)


# Glyph shorthand used across Integrate-themed pages.
GLYPH_ARROW = '\u2192'
GLYPH_SQUARE = '\u25A0'
GLYPH_DOT = '\u25CF'
GLYPH_TRI = '\u25B2'
GLYPH_RING = '\u25CE'
GLYPH_STAR = '\u2726'


def logo(c, x, y, size=22):
    c.saveState()
    c.setFillColor(C['cyan'])
    c.circle(x + size*0.35, y + size*0.6, size*0.38, fill=1, stroke=0)
    c.setFillColor(C['greenDot'])
    c.circle(x + size*0.72, y + size*0.55, size*0.28, fill=1, stroke=0)
    c.restoreState()

def draw_para(c, text, x, y, width, size=9.5, color=None,
              font="Helvetica", leading=14, align=TA_LEFT):
    if color is None:
        color = C['darkText']
    style = ParagraphStyle("s", fontName=font, fontSize=size,
                           textColor=color, leading=leading, alignment=align)
    p = Paragraph(text, style)
    w, h = p.wrap(width, 9999)
    p.drawOn(c, x, y - h)
    return h

def rule(c, x, y, w, color=None, thickness=0.5):
    if color is None:
        color = C['rule']
    c.saveState()
    c.setStrokeColor(color)
    c.setLineWidth(thickness)
    c.line(x, y, x+w, y)
    c.restoreState()

def accent_bar(c, x, y, w=3, h=18, color=None):
    if color is None:
        color = C['cyan']
    c.saveState()
    c.setFillColor(color)
    c.rect(x, y, w, h, fill=1, stroke=0)
    c.restoreState()

def tag_pill(c, text, x, y, font_size=7.5, bg=None, fg=None):
    if bg is None:
        bg = C['cyanSoft']
    if fg is None:
        fg = C['navy']
    tw = len(text) * font_size * 0.55 + 10
    th = font_size + 7
    c.saveState()
    c.setFillColor(bg)
    c.roundRect(x, y - th + 3, tw, th, 3, fill=1, stroke=0)
    c.setFillColor(fg)
    c.setFont("Helvetica-Bold", font_size)
    c.drawString(x + 5, y - th + 3 + (th - font_size)/2 + 1, text)
    c.restoreState()
    return tw + 5

def section_heading(c, text, x, y, size=13, color=None):
    if color is None:
        color = C['navy']
    c.saveState()
    c.setFont("Helvetica-Bold", size)
    c.setFillColor(color)
    c.drawString(x, y, text)
    c.restoreState()

def _page_section(c, title, subtitle):
    c.setFillColor(C['navy'])
    c.rect(0, H - 56, W, 56, fill=1, stroke=0)
    logo(c, 20, H - 44, size=18)
    c.setFont("Helvetica-Bold", 11)
    c.setFillColor(C['white'])
    c.drawString(46, H - 36, LOGO_TEXT)
    c.setFont("Helvetica-Bold", 13)
    c.setFillColor(C['cyan'])
    c.drawRightString(W - 20, H - 36, title)
    c.setFont("Helvetica", 8)
    c.setFillColor(C['mid'])
    c.drawRightString(W - 20, H - 48, subtitle)

def _footer(c, page):
    c.setFillColor(C['navy'])
    c.rect(0, 0, W, 24, fill=1, stroke=0)
    c.setFont("Helvetica", 7.5)
    c.setFillColor(C['mid'])
    c.drawString(28, 8, f"{LOGO_TEXT} Limited  \u00b7  {FOOTER_CONF}  \u00b7  {CONTACT_EMAIL}")
    c.drawRightString(W - 20, 8, f"{page} / 7")

def _footer_dark(c, page):
    c.setFont("Helvetica", 7.5)
    c.setFillColor(C['mid'])
    c.drawString(28, 10, f"{LOGO_TEXT} Limited  \u00b7  {FOOTER_CONF}  \u00b7  {CONTACT_EMAIL}")
    c.drawRightString(W - 20, 10, f"{page} / 7")

def _table_section(c, title, rows, cy):
    section_heading(c, title, 28, cy, size=10)
    cy -= 14
    mw = W - 56
    cols = [28, 148, 238, 298, 28 + mw - 60]
    hdrs = ["Role", "Tier", "Day-rate", "Days", "Fee (excl. VAT)"]
    c.setFillColor(C['navy'])
    c.rect(28, cy - 16, mw, 16, fill=1, stroke=0)
    for ci, (hdr, cx2) in enumerate(zip(hdrs, cols)):
        c.setFont("Helvetica-Bold", 8)
        c.setFillColor(C['white'])
        if ci == 4:
            c.drawRightString(cx2 + 55, cy - 11, hdr)
        else:
            c.drawString(cx2 + 4, cy - 11, hdr)
    cy -= 16
    for ri, row in enumerate(rows):
        bg = C['white'] if ri % 2 == 0 else C['offwhite']
        c.setFillColor(bg)
        c.rect(28, cy - 15, mw, 15, fill=1, stroke=0)
        for ci, (val, cx2) in enumerate(zip(row, cols)):
            c.setFont("Helvetica", 8.5)
            c.setFillColor(C['darkText'] if ci != 4 else C['navy'])
            if ci == 4:
                c.setFont("Helvetica-Bold", 8.5)
                c.drawRightString(cx2 + 55, cy - 10, val)
            else:
                c.drawString(cx2 + 4, cy - 10, val)
        cy -= 15
    return cy - 8

# ═══════════════════════════════════════════════════════════════════
# PAGE 1 — COVER
# ═══════════════════════════════════════════════════════════════════
def page_cover(c):
    c.setFillColor(C['navy'])
    c.rect(0, 0, W*0.33, H, fill=1, stroke=0)
    c.saveState()
    c.setStrokeColor(C['navyLight'])
    c.setLineWidth(0.4)
    for i in range(-20, 60):
        xi = i * 8
        c.line(xi, 0, xi + H, H)
    c.restoreState()
    c.setFillColor(C['cyan'])
    c.rect(W*0.33, 0, 3, H, fill=1, stroke=0)
    logo(c, W*0.75, H - 52, size=20)
    c.setFont("Helvetica-Bold", 12)
    c.setFillColor(C['navy'])
    c.drawString(W*0.75 + 28, H - 42, LOGO_TEXT)
    rx = W*0.33 + 36
    rw = W - rx - 36
    c.setFont("Helvetica", 8)
    c.setFillColor(C['mid'])
    c.drawString(rx, H - 90, f"{BRAND['tagline']}  \u00b7  SIC {BRAND['sic_code']}  \u00b7  Insured Software Consultancy")
    c.setFont("Helvetica-Bold", 30)
    c.setFillColor(C['navy'])
    for i, line in enumerate(BRAND['cover_title_lines']):
        c.drawString(rx, H - 148 - i*35, line)
    c.setFont("Helvetica-Bold", 30)
    c.setFillColor(C['cyan'])
    c.drawString(rx, H - 148 - len(BRAND['cover_title_lines'])*35, BRAND['cover_title_accent'])
    rule(c, rx, H - 234, rw, color=C['cyan'], thickness=1.5)
    strapline = BRAND['strapline'].format(
        industry=BRAND['industry'],
        tech=BRAND['strapline_technology']
    )
    draw_para(c,
        f"{LOGO_TEXT} Limited {strapline}",
        rx, H - 254, rw, size=10, color=C['lightText'], leading=15)
    c.saveState()
    c.setFillColor(C['cyanSoft'])
    c.roundRect(rx, H - 355, 170, 48, 5, fill=1, stroke=0)
    c.setFillColor(C['cyan'])
    c.setFont("Helvetica-Bold", 22)
    c.drawString(rx + 12, H - 332, DAY_RATE)
    c.setFillColor(C['mid'])
    c.setFont("Helvetica", 8)
    c.drawString(rx + 12, H - 347, DAY_RATE_SUB)
    c.restoreState()
    tags = BRAND['tags']
    tx = rx
    ty = H - 380
    for t in tags:
        tx += tag_pill(c, t, tx, ty) + 2
    lx = 18
    lw = W*0.33 - 36
    c.setFont("Helvetica-Bold", 11)
    c.setFillColor(C['white'])
    c.drawString(lx, H*0.72, "Trading as")
    c.setFont("Helvetica-Bold", 16)
    c.setFillColor(C['cyan'])
    c.drawString(lx, H*0.72 - 22, LOGO_TEXT)
    c.setFont("Helvetica", 8)
    c.setFillColor(C['mid'])
    c.drawString(lx, H*0.72 - 36, "Limited")
    rule(c, lx, H*0.72 - 48, lw, color=C['navyLight'])
    items = [
        ("Contact", CONTACT_EMAIL),
        ("Insured for", BRAND['insured_for']),
        ("SIC Code", BRAND['sic_code']),
        ("Operates", BRAND['operates']),
    ]
    iy = H*0.72 - 68
    for label, val in items:
        c.setFont("Helvetica", 7.5)
        c.setFillColor(C['mid'])
        c.drawString(lx, iy, label.upper())
        c.setFont("Helvetica-Bold", 9)
        c.setFillColor(C['white'])
        c.drawString(lx, iy - 12, val)
        iy -= 34
    c.setFillColor(C['navyLight'])
    c.rect(W*0.33 + 3, 0, W - W*0.33 - 3, 28, fill=1, stroke=0)
    c.setFont("Helvetica", 7.5)
    c.setFillColor(C['mid'])
    c.drawString(rx, 10, f"{LOGO_TEXT} Limited  \u00b7  {FOOTER_CONF}  \u00b7  {CONTACT_EMAIL}")
    c.drawRightString(W - 20, 10, "1 / 7")

# ═══════════════════════════════════════════════════════════════════
# PAGE 2 — WHO WE ARE / BRIEF
# ═══════════════════════════════════════════════════════════════════
def page_brief(c):
    c.setFillColor(C['navy'])
    c.rect(0, H - 56, W, 56, fill=1, stroke=0)
    logo(c, 20, H - 44, size=18)
    c.setFont("Helvetica-Bold", 11)
    c.setFillColor(C['white'])
    c.drawString(46, H - 36, LOGO_TEXT)
    c.setFont("Helvetica-Bold", 13)
    c.setFillColor(C['cyan'])
    c.drawRightString(W - 20, H - 36, "Who We Are")
    c.setFont("Helvetica", 8)
    c.setFillColor(C['mid'])
    c.drawRightString(W - 20, H - 48, "1. Brief")
    c.setFillColor(C['offwhite'])
    c.rect(0, 0, W, H - 56, fill=1, stroke=0)
    mx = 28
    mw = W - 56
    cy = H - 90
    owner = BRAND['owner']
    specialist_fields = BRAND.get('specialist_fields',
        'enterprise .NET web development, embedded systems, IoT connectivity, and audio engineering')
    intro = (f"{LOGO_TEXT} Limited is a one-person software consultancy, "
             f"founded and operated by {owner} — a specialist engineer with deep, cross-disciplinary expertise "
             f"spanning {specialist_fields}. "
             f"We operate under SIC code {BRAND['sic_code']} ({BRAND['tagline']}) and hold professional "
             f"indemnity insurance appropriate for software consultancy engagements.")
    draw_para(c, intro, mx, cy, mw, size=10, color=C['darkText'], leading=15)
    cy -= 72
    cards = [
        ("Mission", C['cyan'], BRAND['mv_mission']),
        ("Vision", C['navy'], BRAND['mv_vision']),
        ("Purpose", _hex('#1A5276'), BRAND['mv_purpose']),
    ]
    card_w = (mw - 16) / 3
    for i, (title, col, body) in enumerate(cards):
        cx2 = mx + i * (card_w + 8)
        c.setFillColor(C['white'])
        c.roundRect(cx2, cy - 108, card_w, 108, 5, fill=1, stroke=0)
        c.setFillColor(col)
        c.roundRect(cx2, cy - 8, card_w, 8, 5, fill=1, stroke=0)
        c.rect(cx2, cy - 14, card_w, 6, fill=1, stroke=0)
        c.setFont("Helvetica-Bold", 9)
        c.setFillColor(col)
        c.drawString(cx2 + 10, cy - 28, title.upper())
        draw_para(c, body, cx2 + 10, cy - 40, card_w - 20, size=8.5,
                  color=C['lightText'], leading=13)
    cy -= 130
    rule(c, mx, cy, mw)
    cy -= 18
    section_heading(c, "What makes us different", mx, cy)
    cy -= 22
    for title, body in BRAND['diff_items']:
        accent_bar(c, mx, cy - 22, w=3, h=22)
        c.setFont("Helvetica-Bold", 9.5)
        c.setFillColor(C['navy'])
        c.drawString(mx + 10, cy - 10, title)
        draw_para(c, body, mx + 10, cy - 20, mw - 14, size=8.5, color=C['lightText'], leading=13)
        cy -= 44
    _footer(c, 2)

# ═══════════════════════════════════════════════════════════════════
# PAGE 3 — OUR SERVICES
# ═══════════════════════════════════════════════════════════════════
def page_services(c):
    _page_section(c, "Our Services", "2. Core Offering & Optional Extras")
    c.setFillColor(C['offwhite'])
    c.rect(0, 0, W, H - 56, fill=1, stroke=0)
    mx = 28
    mw = W - 56
    cy = H - 82
    intro = BRAND['services_intro'].format(industry=BRAND['industry'])
    draw_para(c,
        f"{LOGO_TEXT} {intro}",
        mx, cy, mw, size=10, color=C['darkText'], leading=15)
    cy -= 48
    section_heading(c, BRAND['services_core_title'], mx, cy, size=11)
    cy -= 18
    core = BRAND['services_core']
    card_w = (mw - 16) / 3
    ch = 142
    for i, (title, body, pills) in enumerate(core):
        cx2 = mx + i * (card_w + 8)
        c.setFillColor(C['white'])
        c.roundRect(cx2, cy - ch, card_w, ch, 5, fill=1, stroke=0)
        c.setFillColor(C['cyan'])
        c.roundRect(cx2, cy - ch, card_w, ch, 5, fill=1, stroke=0)
        c.setFillColor(C['white'])
        c.roundRect(cx2, cy - ch + 4, card_w, ch - 4, 4, fill=1, stroke=0)
        c.setFillColor(C['cyan'])
        c.rect(cx2, cy - 4, card_w, 4, fill=1, stroke=0)
        c.setFont("Helvetica-Bold", 9)
        c.setFillColor(C['navy'])
        for j, line in enumerate(title.split("\n")):
            c.drawString(cx2 + 10, cy - 16 - j*12, line)
        draw_para(c, body, cx2 + 10, cy - 44, card_w - 20, size=8, color=C['lightText'], leading=12)
        px = cx2 + 10
        py = cy - ch + 12
        for pill in pills:
            pw = len(pill) * 7 + 10
            if px + pw > cx2 + card_w - 5:
                break
            c.setFillColor(C['cyanSoft'])
            c.roundRect(px, py, pw, 12, 2, fill=1, stroke=0)
            c.setFont("Helvetica-Bold", 6.5)
            c.setFillColor(C['navy'])
            c.drawString(px + 4, py + 3, pill)
            px += pw + 4
    cy -= ch + 18
    rule(c, mx, cy, mw)
    cy -= 16
    section_heading(c, BRAND['services_optional_title'], mx, cy, size=11)
    c.setFont("Helvetica", 8.5)
    c.setFillColor(C['mid'])
    c.drawString(mx + 200, cy + 1, BRAND['services_optional_note'])
    cy -= 18
    for title, body, badge in BRAND['services_extras']:
        c.setFillColor(C['white'])
        c.roundRect(mx, cy - 46, mw, 46, 4, fill=1, stroke=0)
        accent_bar(c, mx, cy - 46, w=3, h=46, color=C['cyan'])
        bw = len(badge) * 7 + 12
        c.setFillColor(C['cyanSoft'])
        c.roundRect(W - 28 - bw, cy - 14, bw, 13, 2, fill=1, stroke=0)
        c.setFont("Helvetica-Bold", 7)
        c.setFillColor(C['navy'])
        c.drawString(W - 28 - bw + 5, cy - 11, badge.upper())
        c.setFont("Helvetica-Bold", 9)
        c.setFillColor(C['navy'])
        c.drawString(mx + 10, cy - 14, title)
        draw_para(c, body, mx + 10, cy - 24, mw - bw - 30, size=8, color=C['lightText'], leading=12)
        cy -= 54
    _footer(c, 3)

# ═══════════════════════════════════════════════════════════════════
# PAGE 4 — TIMESCALES
# ═══════════════════════════════════════════════════════════════════
def page_timescales(c):
    c.setFillColor(C['navy'])
    c.rect(0, 0, W, H, fill=1, stroke=0)
    c.saveState()
    c.setStrokeColor(C['navyLight'])
    c.setLineWidth(0.3)
    for i in range(0, int(W)+1, 24):
        c.line(i, 0, i, H)
    for j in range(0, int(H)+1, 24):
        c.line(0, j, W, j)
    c.restoreState()
    logo(c, 20, H - 44, size=18)
    c.setFont("Helvetica-Bold", 11)
    c.setFillColor(C['white'])
    c.drawString(46, H - 36, LOGO_TEXT)
    c.setFont("Helvetica-Bold", 13)
    c.setFillColor(C['cyan'])
    c.drawRightString(W - 20, H - 36, "Engagement Timescales")
    c.setFont("Helvetica", 8)
    c.setFillColor(C['mid'])
    c.drawRightString(W - 20, H - 48, "3. Timescales")
    mx = 28
    mw = W - 56
    cy = H - 80
    draw_para(c, BRAND['timeframe_intro'],
        mx, cy, mw, size=10, color=C['darkBgText'], leading=15)
    cy -= 42
    phases = BRAND['timeframe_phases']
    ph_w = (mw - 24) / 3
    for i, (weeks, title, items, col_or_none) in enumerate(phases):
        px = mx + i * (ph_w + 12)
        ph = 190
        c.setFillColor(C['navyLight'])
        c.roundRect(px, cy - ph, ph_w, ph, 6, fill=1, stroke=0)
        col = col_or_none if col_or_none is not None else C['cyan']
        c.setFillColor(col)
        c.roundRect(px, cy - ph, ph_w, ph, 6, fill=1, stroke=0)
        c.setFillColor(C['navyLight'])
        c.roundRect(px, cy - ph + 4, ph_w, ph - 30, 4, fill=1, stroke=0)
        c.setFont("Helvetica-Bold", 8)
        c.setFillColor(C['navy'])
        c.drawString(px + 10, cy - 15, weeks)
        c.setFont("Helvetica-Bold", 11)
        c.setFillColor(col)
        c.drawString(px + 10, cy - 30, title)
        iy = cy - 52
        for item in items:
            c.setFillColor(col)
            c.circle(px + 14, iy + 3, 2, fill=1, stroke=0)
            c.setFont("Helvetica", 8.5)
            c.setFillColor(C['darkBgText'])
            c.drawString(px + 20, iy, item)
            iy -= 16
    cy -= 210
    section_heading(c, BRAND['timeframe_mgmt_title'], mx, cy, size=11, color=C['white'])
    cy -= 20
    col_w = mw / 2
    for i, item in enumerate(BRAND['timeframe_mgmt_items']):
        ix = mx + (i % 2) * col_w
        iy = cy - (i // 2) * 22
        c.setFillColor(C['cyan'])
        c.circle(ix + 6, iy + 3.5, 2.5, fill=1, stroke=0)
        c.setFont("Helvetica", 9)
        c.setFillColor(C['darkBgText'])
        c.drawString(ix + 14, iy, item)
    cy -= 56
    rule(c, mx, cy, mw, color=C['navyLight'])
    cy -= 18
    c.setFillColor(C['cyanSoft'])
    c.roundRect(mx, cy - 28, mw, 28, 4, fill=1, stroke=0)
    c.setFont("Helvetica-Bold", 9)
    c.setFillColor(C['navy'])
    c.drawString(mx + 12, cy - 12, BRAND['timeframe_indicative'])
    _footer_dark(c, 4)

# ═══════════════════════════════════════════════════════════════════
# PAGE 5 — TEAM & WORK ITEMS
# ═══════════════════════════════════════════════════════════════════
def page_team(c):
    _page_section(c, BRAND['team_title'], "4. Work Items")
    c.setFillColor(C['offwhite'])
    c.rect(0, 0, W, H - 56, fill=1, stroke=0)
    mx = 28
    mw = W - 56
    cy = H - 82
    intro = BRAND['team_intro'].format(logo=LOGO_TEXT, owner=BRAND['owner'])
    draw_para(c, intro, mx, cy, mw, size=10, color=C['darkText'], leading=15)
    cy -= 58
    team_rows = BRAND['team_rows']
    for section_name, rows in team_rows.items():
        cy = _table_section(c, section_name, rows, cy)
    cy -= 4
    c.setFillColor(C['navy'])
    c.rect(mx, cy - 20, mw, 20, fill=1, stroke=0)
    c.setFont("Helvetica-Bold", 10)
    c.setFillColor(C['cyan'])
    c.drawString(mx + 10, cy - 13, "Total (excl. VAT)")
    c.setFillColor(C['white'])
    c.drawRightString(mx + mw - 2, cy - 13, BRAND['total_row'])
    _footer(c, 5)

# ═══════════════════════════════════════════════════════════════════
# PAGE 6 — PORTFOLIO
# ═══════════════════════════════════════════════════════════════════
def page_portfolio(c):
    _page_section(c, "Portfolio", "5. Selected Work")
    c.setFillColor(C['offwhite'])
    c.rect(0, 0, W, H - 56, fill=1, stroke=0)
    mx = 28
    mw = W - 56
    cy = H - 82
    intro = BRAND['portfolio_intro'].format(logo=LOGO_TEXT)
    draw_para(c, intro, mx, cy, mw, size=10, color=C['darkText'], leading=15)
    cy -= 42
    for title, subtitle, body, pills in BRAND['portfolio_items']:
        ph = 88
        c.setFillColor(C['white'])
        c.roundRect(mx, cy - ph, mw, ph, 5, fill=1, stroke=0)
        c.setFillColor(C['cyan'])
        c.rect(mx, cy - ph, 4, ph, fill=1, stroke=0)
        c.roundRect(mx, cy - ph, 4, ph, 2, fill=1, stroke=0)
        c.setFont("Helvetica-Bold", 10)
        c.setFillColor(C['navy'])
        c.drawString(mx + 14, cy - 16, title)
        c.setFont("Helvetica", 8)
        c.setFillColor(C['cyan'])
        c.drawString(mx + 14, cy - 27, subtitle)
        draw_para(c, body, mx + 14, cy - 36, mw - 28, size=8.5, color=C['lightText'], leading=13)
        px = mx + 14
        py = cy - ph + 10
        for pill in pills:
            pw = len(pill) * 6.5 + 10
            c.setFillColor(C['cyanSoft'])
            c.roundRect(px, py, pw, 12, 2, fill=1, stroke=0)
            c.setFont("Helvetica-Bold", 6.5)
            c.setFillColor(C['navy'])
            c.drawString(px + 4, py + 3, pill)
            px += pw + 4
        cy -= ph + 10
    _footer(c, 6)

# ═══════════════════════════════════════════════════════════════════
# PAGE 7 — NEXT STEPS / CTA
# ═══════════════════════════════════════════════════════════════════
def page_next_steps(c):
    c.setFillColor(C['navy'])
    c.rect(0, 0, W, H, fill=1, stroke=0)
    c.saveState()
    c.setStrokeColor(C['navyLight'])
    c.setLineWidth(0.4)
    for i in range(-20, 60):
        c.line(i * 10, 0, i * 10 + H, H)
    c.restoreState()
    c.setFillColor(C['cyan'])
    c.rect(0, H - 4, W, 4, fill=1, stroke=0)
    logo(c, 20, H - 44, size=18)
    c.setFont("Helvetica-Bold", 11)
    c.setFillColor(C['white'])
    c.drawString(46, H - 36, LOGO_TEXT)
    c.setFont("Helvetica", 8)
    c.setFillColor(C['mid'])
    c.drawRightString(W - 20, H - 36, CONTACT_EMAIL)
    mx = 28
    mw = W - 56
    cy = H - 90
    c.setFont("Helvetica-Bold", 24)
    c.setFillColor(C['white'])
    c.drawString(mx, cy, "Next Steps")
    c.setFont("Helvetica-Bold", 24)
    c.setFillColor(C['cyan'])
    c.drawString(mx + 116, cy, ".")
    cy -= 12
    rule(c, mx, cy, 80, color=C['cyan'], thickness=2)
    cy -= 24
    cta = (f"We'd welcome the opportunity to walk through this brochure in person or over a call, "
           f"align on scope, and discuss how {LOGO_TEXT} can best support your programme. "
           "No obligation — just a straightforward conversation about what you need and how we can help.")
    draw_para(c, cta, mx, cy, mw, size=10.5, color=C['darkBgText'], leading=16)
    cy -= 68
    step_w = (mw - 24) / 4
    for i, (num, title, body) in enumerate(BRAND['steps']):
        sx = mx + i * (step_w + 8)
        c.setFillColor(C['navyLight'])
        c.roundRect(sx, cy - 108, step_w, 108, 6, fill=1, stroke=0)
        c.setFont("Helvetica-Bold", 22)
        c.setFillColor(C['cyan'])
        c.drawString(sx + 10, cy - 30, num)
        c.setFont("Helvetica-Bold", 9)
        c.setFillColor(C['white'])
        c.drawString(sx + 10, cy - 46, title)
        step_body = body.format(logo=LOGO_TEXT) if '{logo}' in body else body
        draw_para(c, step_body, sx + 10, cy - 58, step_w - 20,
                  size=8, color=C['mid'], leading=12)
    cy -= 128
    c.setFillColor(C['cyan'])
    c.roundRect(mx, cy - 52, mw, 52, 6, fill=1, stroke=0)
    c.setFont("Helvetica-Bold", 14)
    c.setFillColor(C['navy'])
    c.drawString(mx + 16, cy - 20, CONTACT_EMAIL)
    c.setFont("Helvetica", 9)
    c.setFillColor(C['navyLight'])
    c.drawString(mx + 16, cy - 34,
        f"{LOGO_TEXT} Limited  \u00b7  {BRAND['tagline']}  \u00b7  SIC {BRAND['sic_code']}  \u00b7  UK / Remote")
    c.setFont("Helvetica-Bold", 11)
    c.setFillColor(C['navy'])
    c.drawRightString(mx + mw - 16, cy - 24, DAY_RATE.split(' /')[0])
    c.setFont("Helvetica", 8)
    c.setFillColor(C['navyLight'])
    c.drawRightString(mx + mw - 16, cy - 36, "excl. VAT")
    _footer_dark(c, 7)

def generate_pdf(brand=ACTIVE_BRAND, output=None):
    """Generate and return the path to a seven-page A4 brochure PDF."""
    if brand not in BRANDS:
        raise ValueError(f"Unknown brand {brand!r}; choose from: {', '.join(sorted(BRANDS))}")

    global ACTIVE_BRAND, BRAND, C, LOGO_TEXT, FOOTER_CONF
    global CONTACT_EMAIL, DAY_RATE, DAY_RATE_SUB, OUTPUT
    ACTIVE_BRAND = brand
    BRAND = BRANDS[brand]
    C = BRAND['colors']
    LOGO_TEXT = BRAND['logo_text']
    FOOTER_CONF = BRAND['footer_confidential']
    CONTACT_EMAIL = BRAND['contact_email']
    DAY_RATE = BRAND['day_rate']
    DAY_RATE_SUB = BRAND['day_rate_sub']
    default_name = f"{LOGO_TEXT.replace(' & ', '_').replace(' ', '')}_Brochure.pdf"
    OUTPUT = Path(output) if output is not None else Path(__file__).resolve().parent / 'output' / default_name
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)

    pdf = canvas.Canvas(str(OUTPUT), pagesize=A4)
    pdf.setTitle(f"{LOGO_TEXT} — Software Consultancy Brochure")
    pdf.setAuthor(BRAND['author'])
    pdf.setSubject(f"Software Consultancy Brochure — {LOGO_TEXT}")

    pages = (page_cover, page_brief, page_services, page_timescales,
             page_team, page_portfolio, page_next_steps)
    for page in pages:
        page(pdf)
        pdf.showPage()

    pdf.save()
    return OUTPUT


def main(argv=None):
    parser = argparse.ArgumentParser(description='Generate a branded proposal PDF.')
    parser.add_argument('--brand', choices=sorted(BRANDS), default=ACTIVE_BRAND)
    parser.add_argument('--output', help='PDF output path (default: output/<brand>_Brochure.pdf)')
    args = parser.parse_args(argv)
    output = generate_pdf(brand=args.brand, output=args.output)
    print('Done:', output)


if __name__ == '__main__':
    main()