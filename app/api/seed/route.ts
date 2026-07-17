import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { createServiceClient } from '@/lib/supabase/server';

// POST /api/seed
// Body: { "secret": "YOUR_SECRET" }
// Seeds 29 synthetic demo bids — safe to re-run (upserts on id)

// Constant-time secret comparison; the secret is taken from the request BODY
// only (query params leak into access logs, proxies, and browser history).
function secretOk(provided: unknown): boolean {
  const expected = process.env.SEED_SECRET;
  if (!expected || typeof provided !== 'string') return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

type SeedBid = {
  id: string;
  thread_id: string;
  email_received: string;
  project_name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  gc_name: string;
  gc_email: string | null;
  gc_contact_name: string | null;
  gc_contact_phone: string | null;
  bid_due_date: string | null;
  bid_due_time: string | null;
  submit_to: string | null;
  scope: string;
  trades: string[];
  plans_link: string | null;
  source: string;
  status: 'New' | 'Reviewing' | 'Expired';
  our_bid_amount: number | null;
  awarded_amount: number | null;
  notes: string;
};

type BidFixture = Pick<SeedBid, 'project_name' | 'scope' | 'trades'> &
  Partial<Omit<SeedBid, 'id' | 'thread_id' | 'project_name' | 'scope' | 'trades' | 'our_bid_amount' | 'awarded_amount'>>;

const SYNTHETIC_GCS = [
  'Blue Oak Contractors',
  'Copper Star Builders',
  'Pine and Prairie Construction',
  'Horizon Beam Group',
] as const;

const FIXTURES: BidFixture[] = [
  {
    project_name: 'Demo Auto Service Center',
    address: '101 Example Parkway',
    city: 'Example City',
    gc_email: 'estimating@example.com',
    gc_contact_phone: '210-555-0101',
    submit_to: 'estimating@example.com',
    scope: 'New 5,900 SF auto service building with site concrete, earthwork, utilities, landscaping, and striping.',
    trades: ['Concrete', 'Earthwork', 'Utilities', 'Masonry', 'MEP', 'Striping', 'Landscaping'],
    plans_link: 'https://example-planroom.test/projects/demo-001',
    source: 'Direct',
    notes: 'Synthetic example: colored concrete mix and finish requirements are included for estimating practice.',
  },
  {
    project_name: 'Sample Middle School Renovation',
    address: null,
    city: 'Sampleton',
    gc_email: 'bids@example.com',
    gc_contact_name: 'Alex Example / Jordan Sample',
    gc_contact_phone: '512-555-0102',
    submit_to: 'bids@example.com (or via demo portal)',
    scope: 'Middle school renovation with selective demolition and sitework.',
    trades: ['Renovation', 'Sitework'],
    plans_link: 'https://example-planroom.test/projects/demo-002',
    source: 'Procore',
    notes: 'Synthetic contacts only. Plans are available through the example plan room.',
  },
  {
    project_name: 'Commerce Lot 1R Sitework',
    address: '200 Fixture Road',
    city: null,
    gc_email: 'estimating@example.com',
    gc_contact_phone: '214-555-0103',
    bid_due_date: null,
    bid_due_time: null,
    submit_to: 'estimating@example.com',
    scope: 'Site preparation for a commercial pad; final civil details remain pending.',
    trades: ['Sitework'],
    plans_link: 'https://example-planroom.test/projects/demo-003',
    source: 'Direct',
    notes: 'Synthetic fixture with an intentionally missing due date for incomplete-invitation workflows.',
  },
  {
    project_name: 'Fixture Family Restaurant Build-Out',
    address: null,
    city: 'Demo Ridge',
    gc_email: null,
    gc_contact_name: 'Taylor Fixture',
    gc_contact_phone: null,
    bid_due_date: '2026-05-19',
    bid_due_time: '2:00 PM',
    scope: 'Restaurant shell and site package.',
    trades: ['Concrete', 'Sitework'],
    plans_link: null,
    source: 'Procore',
    status: 'Expired',
    notes: 'Synthetic expired opportunity retained to exercise deadline and archive views.',
  },
  {
    project_name: 'Slate Office Park Site Package',
    address: null,
    city: null,
    state: null,
    gc_email: 'notifications@example.com',
    bid_due_date: null,
    bid_due_time: null,
    scope: 'Office development earthwork and sitework package.',
    trades: ['Sitework', 'Earthwork'],
    plans_link: null,
    source: 'Procore',
    notes: 'Synthetic reminder fixture with intentionally incomplete location and schedule data.',
  },
  {
    project_name: 'Example Public Safety Warehouse',
    address: '320 Demonstration Avenue',
    city: 'Fixture Falls',
    gc_email: null,
    bid_due_date: '2026-05-26',
    bid_due_time: '2:00 PM CT',
    submit_to: 'Demo procurement portal',
    scope: 'A 9,000 SF conditioned metal warehouse on a 3.8-acre site under a unit-price contract.',
    trades: ['Concrete', 'Structural Steel', 'Masonry', 'Earthwork', 'Utilities', 'MEP'],
    plans_link: 'https://example-planroom.test/projects/demo-006',
    source: 'PlanHub',
    status: 'Reviewing',
    notes: 'Synthetic public-works example with a $5,400,000 reference budget and 515-calendar-day schedule.',
  },
  {
    project_name: 'The Demo Grove Retail Shell',
    address: '400 Sample Street',
    city: 'Sampleton',
    scope: 'Small commercial shell and associated flatwork.',
    trades: ['Concrete', 'Sitework'],
    notes: 'Synthetic retail invitation for dashboard demonstrations.',
  },
  {
    project_name: 'Parks Maintenance Storage Expansion',
    address: '1701 Example Drive',
    city: 'Example City',
    bid_due_date: '2026-05-31',
    bid_due_time: '8:00 AM',
    scope: 'Municipal parks maintenance storage expansion.',
    trades: ['Concrete', 'Earthwork', 'Sitework'],
    notes: 'Synthetic primary bid package paired with demo bid 009.',
  },
  {
    project_name: 'Parks Maintenance Storage Expansion - Alternate',
    address: '1701 Example Drive',
    city: 'Example City',
    bid_due_date: '2026-06-01',
    bid_due_time: '9:00 AM',
    scope: 'Alternate public storage expansion package at the same synthetic site.',
    trades: ['Concrete', 'Earthwork', 'Sitework'],
    notes: 'Synthetic alternate package retained to exercise possible-duplicate review.',
  },
  {
    project_name: 'Community Park Parking Lot Expansion',
    address: '251 County Demo Road',
    city: 'Fixture Falls',
    bid_due_date: '2026-06-02',
    bid_due_time: '9:00 AM',
    scope: 'Parking expansion with concrete or asphalt paving, earthwork, and striping.',
    trades: ['Concrete', 'Asphalt', 'Paving', 'Earthwork', 'Striping'],
    notes: 'Synthetic high-relevance paving opportunity.',
  },
  {
    project_name: 'Community Pavilion Construction and Renovation',
    address: '15820 Sample Park Road',
    city: 'Demo Ridge',
    bid_due_date: '2026-06-02',
    bid_due_time: '10:00 AM',
    scope: 'Pavilion addition and renovation at a fictional community park.',
    trades: ['Concrete', 'Masonry', 'Sitework'],
    notes: 'Synthetic park facility example.',
  },
  {
    project_name: 'Commercial Pad 3',
    address: '4815 Fixture Vista Drive',
    city: 'Sampleton',
    bid_due_date: '2026-06-03',
    bid_due_time: '8:00 AM',
    scope: 'Commercial pad construction and site preparation.',
    trades: ['Concrete', 'Earthwork', 'Sitework'],
    notes: 'Synthetic commercial-site fixture.',
  },
  {
    project_name: 'Example Thrift Retail Shell',
    address: '1119 Demonstration Street',
    city: 'Fixture Falls',
    bid_due_date: '2026-06-08',
    bid_due_time: '8:00 AM',
    scope: 'Retail shell construction with utilities and site improvements.',
    trades: ['Concrete', 'Earthwork', 'Sitework', 'Utilities'],
    notes: 'Synthetic retail fixture.',
  },
  {
    project_name: 'Covered Parking and Laydown Area',
    address: '300 Example Industrial Avenue',
    city: 'Example City',
    bid_due_date: '2026-06-08',
    bid_due_time: '9:00 AM',
    scope: 'Covered parking structure and construction laydown area.',
    trades: ['Concrete', 'Paving', 'Earthwork', 'Structural Steel'],
    notes: 'Synthetic high-relevance concrete and paving opportunity.',
  },
  {
    project_name: 'Early Learning Classroom Addition',
    address: '608 Sample College Street',
    city: 'Demo Ridge',
    bid_due_date: '2026-06-08',
    bid_due_time: '10:00 AM',
    scope: 'Classroom additions at a fictional early learning center.',
    trades: ['Concrete', 'Masonry', 'Sitework', 'Earthwork'],
    notes: 'Synthetic education project.',
  },
  {
    project_name: 'Demo Auto Parts Store',
    address: '1485 Example Road',
    city: 'Sampleton',
    bid_due_date: '2026-05-27',
    bid_due_time: '11:00 AM',
    scope: 'Standalone auto parts retail store construction.',
    trades: ['Concrete', 'Earthwork', 'Sitework', 'Utilities'],
    notes: 'Synthetic retail construction fixture.',
  },
  {
    project_name: 'Metal Building 115 Reconstruction',
    address: '3600 Demonstration Boulevard',
    city: 'Fixture Falls',
    bid_due_date: '2026-05-28',
    bid_due_time: '12:00 PM',
    scope: 'Reconstruction of a pre-engineered metal storage building.',
    trades: ['Concrete', 'Structural Steel', 'Earthwork', 'MEP'],
    notes: 'Synthetic prevailing-wage example for compliance workflows.',
  },
  {
    project_name: 'North Drive-Through Coffee Kiosk',
    address: '12405 Sample Road',
    city: 'Example City',
    bid_due_date: '2026-06-02',
    bid_due_time: '8:00 AM',
    scope: 'Drive-through coffee kiosk and associated site utilities.',
    trades: ['Concrete', 'Earthwork', 'Sitework', 'Utilities'],
    notes: 'Synthetic kiosk opportunity paired with demo bid 019.',
  },
  {
    project_name: 'South Drive-Through Coffee Kiosk',
    address: '914 Fixture Street',
    city: 'Demo Ridge',
    bid_due_date: '2026-06-02',
    bid_due_time: '8:00 AM',
    scope: 'Drive-through coffee kiosk and associated site utilities.',
    trades: ['Concrete', 'Earthwork', 'Sitework', 'Utilities'],
    notes: 'Synthetic companion opportunity used for same-GC comparisons.',
  },
  {
    project_name: 'Example High School Summer Modernization',
    address: '13212 Sample Boulevard',
    city: 'Sampleton',
    bid_due_date: '2026-06-02',
    bid_due_time: '10:00 AM',
    scope: 'High school summer modernization package.',
    trades: ['Concrete', 'Masonry', 'Sitework', 'Earthwork'],
    notes: 'Synthetic primary package paired with demo bid 021.',
  },
  {
    project_name: 'Example High School Modernization - Alternate',
    address: '13212 Sample Boulevard',
    city: 'Sampleton',
    bid_due_date: '2026-06-02',
    bid_due_time: '10:00 AM',
    scope: 'Alternate listing for a fictional high school modernization.',
    trades: ['Concrete', 'Masonry', 'Sitework', 'Earthwork'],
    notes: 'Synthetic possible duplicate retained for review workflows.',
  },
  {
    project_name: 'Demo Outpatient Clinic',
    address: '9108 Fixture Lane, Building 3, Suite 302',
    city: 'Fixture Falls',
    bid_due_date: '2026-06-04',
    bid_due_time: '10:00 AM',
    scope: 'Commercial outpatient clinic construction.',
    trades: ['Concrete', 'Sitework', 'MEP'],
    notes: 'Synthetic medical-office example.',
  },
  {
    project_name: 'Stagecoach Veterinary Hospital',
    address: '4826 Example Stagecoach Road',
    city: 'Demo Ridge',
    bid_due_date: '2026-06-04',
    bid_due_time: '10:00 AM',
    scope: 'Veterinary hospital shell, utilities, and site package.',
    trades: ['Concrete', 'Earthwork', 'Sitework', 'Utilities'],
    notes: 'Synthetic veterinary project.',
  },
  {
    project_name: 'Sample Smoothie Retail Store',
    address: '1300 State Demo Highway',
    city: 'Example City',
    bid_due_date: '2026-06-05',
    bid_due_time: '1:00 PM',
    scope: 'Small retail store and sitework package.',
    trades: ['Concrete', 'Earthwork', 'Sitework'],
    notes: 'Synthetic quick-service retail fixture.',
  },
  {
    project_name: 'Federal Exchange Renovation',
    address: '5100 Fixture Road',
    city: 'Sampleton',
    bid_due_date: '2026-06-09',
    bid_due_time: '8:00 AM',
    scope: 'Renovation of a fictional federal retail exchange.',
    trades: ['Concrete', 'Earthwork', 'Sitework', 'MEP'],
    notes: 'Synthetic federal-project example with prevailing-wage and access requirements.',
  },
  {
    project_name: 'Demo Roadway Reconstruction',
    address: null,
    city: 'Fixture Falls',
    bid_due_date: '2026-06-08',
    bid_due_time: '12:00 PM',
    scope: 'Road reconstruction with base placement and Type D asphalt.',
    trades: ['Earthwork', 'Asphalt', 'Paving', 'Grading'],
    notes: 'Synthetic high-relevance civil opportunity funded through a sample grant program.',
  },
  {
    project_name: 'East Connector Reconstruction and Water Line',
    address: 'East Connector Road',
    city: 'Demo Ridge',
    bid_due_date: '2026-06-14',
    bid_due_time: '10:00 AM',
    scope: 'Roadway reconstruction and water-line improvements.',
    trades: ['Earthwork', 'Paving', 'Utilities', 'Grading'],
    notes: 'Synthetic high-relevance road and utility fixture.',
  },
  {
    project_name: 'Bluff Road Improvements and Signalization',
    address: 'Demo Highway 93',
    city: 'Example City',
    bid_due_date: '2026-06-15',
    bid_due_time: '10:30 AM',
    scope: 'Approximately 6,200 LF of two-lane roadway construction with traffic signalization.',
    trades: ['Earthwork', 'Paving', 'Concrete', 'Grading', 'Utilities'],
    notes: 'Synthetic large-road example with substantial earthwork and paving quantities.',
  },
  {
    project_name: 'Community Park Renovation',
    address: null,
    city: 'Fixture Falls',
    bid_due_date: '2026-06-23',
    bid_due_time: '11:00 AM',
    scope: 'Renovation of a fictional park and playground.',
    trades: ['Concrete', 'Earthwork', 'Sitework'],
    notes: 'Synthetic park fixture with flatwork, grading, and utility scope.',
  },
];

const BIDS: SeedBid[] = FIXTURES.map((fixture, index) => {
  const sequence = index + 1;
  const suffix = String(sequence).padStart(3, '0');
  const gcName = SYNTHETIC_GCS[index % SYNTHETIC_GCS.length];

  return {
    id: `BID-2026-${suffix}`,
    thread_id: `demo-thread-${suffix}`,
    email_received: '2026-05-23',
    address: `${100 + sequence} Example Way`,
    city: 'Example City',
    state: 'TX',
    gc_name: gcName,
    gc_email: null,
    gc_contact_name: null,
    gc_contact_phone: null,
    bid_due_date: `2026-06-${String(sequence + 2).padStart(2, '0')}`,
    bid_due_time: '10:00 AM',
    submit_to: null,
    plans_link: null,
    source: 'PlanHub',
    status: 'New',
    our_bid_amount: null,
    awarded_amount: null,
    notes: 'Synthetic fixture for demos and automated testing.',
    ...fixture,
  };
});

export async function POST(req: NextRequest) {
  let secret: unknown = null;
  try {
    const body = await req.json();
    secret = body?.secret ?? null;
  } catch {
    // no body or invalid JSON
  }

  if (!secretOk(secret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServiceClient();

  // Seed data belongs to the NGU Construction workspace (workspace #1, created
  // by the tenant_scoping migration). Resolve it so every seeded bid is scoped.
  const { data: ws } = await supabase
    .from('workspaces')
    .select('id')
    .eq('name', 'NGU Construction')
    .limit(1)
    .maybeSingle();
  if (!ws) {
    return NextResponse.json(
      { error: 'No "NGU Construction" workspace found — run the tenant_scoping migration first.' },
      { status: 400 }
    );
  }

  const mapped = BIDS.map(b => ({
    ...b,
    workspace_id: ws.id,
    state: b.state ?? 'TX',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }));

  const { data, error } = await supabase
    .from('bids')
    .upsert(mapped, { onConflict: 'id' })
    .select('id');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    success: true,
    seeded: data?.length ?? 0,
    message: `Successfully seeded ${data?.length} bids into Supabase`,
  });
}
