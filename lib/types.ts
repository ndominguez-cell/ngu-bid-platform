// ============================================================
// NGU Bid Platform — TypeScript Types
// ============================================================

export type BidStatus = 'New' | 'Reviewing' | 'Active' | 'Submitted' | 'Won' | 'Lost' | 'Declined' | 'Expired';
export type EstimateStatus = 'Draft' | 'In Review' | 'Approved' | 'Submitted' | 'Archived';
export type ProposalStatus = 'Draft' | 'Reviewed' | 'Sent' | 'Declined';
export type CompanyType = 'GC' | 'Owner' | 'Architect' | 'Engineer' | 'Subcontractor' | 'Other';
export type UserRole = 'admin' | 'estimator' | 'viewer';
export type ActivityType = 'status_change' | 'note' | 'email_sent' | 'call' | 'file_upload' | 'estimate_created' | 'proposal_sent';
export type DocumentType = 'plans' | 'specs' | 'addendum' | 'proposal' | 'estimate' | 'other';

export interface Bid {
  id: string; // BID-2026-001
  thread_id: string | null;
  email_received: string | null; // ISO date
  project_name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  gc_name: string | null;
  gc_email: string | null;
  gc_contact_name: string | null;
  gc_contact_phone: string | null;
  company_id: string | null;
  contact_id: string | null;
  bid_due_date: string | null; // ISO date
  bid_due_time: string | null;
  submit_to: string | null;
  scope: string | null;
  trades: string[];
  plans_link: string | null;
  source: string | null;
  status: BidStatus;
  proposed_start_date: string | null;
  our_bid_amount: number | null;
  awarded_amount: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  company?: Company;
  contact?: Contact;
  estimates?: Estimate[];
  proposals?: Proposal[];
}

export interface Company {
  id: string;
  name: string;
  type: CompanyType;
  website: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  contacts?: Contact[];
  bids?: Bid[];
}

export interface Contact {
  id: string;
  company_id: string | null;
  first_name: string;
  last_name: string | null;
  title: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  notes: string | null;
  source: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  company?: Company;
}

export interface EstimateLineItem {
  trade: string;
  description: string;
  qty: number;
  unit: string;
  unit_price: number;
  total: number;
}

export interface Estimate {
  id: string;
  bid_id: string;
  name: string;
  status: EstimateStatus;
  total_amount: number | null;
  markup_pct: number;
  margin_pct: number | null;
  notes: string | null;
  ai_summary: string | null;
  line_items: EstimateLineItem[];
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  bid?: Bid;
  documents?: Document[];
}

export interface Proposal {
  id: string;
  bid_id: string;
  estimate_id: string | null;
  subject: string;
  body_draft: string | null;
  body_final: string | null;
  status: ProposalStatus;
  sent_at: string | null;
  sent_by: string | null;
  gmail_thread_id: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  bid?: Bid;
  estimate?: Estimate;
}

export interface Document {
  id: string;
  bid_id: string | null;
  estimate_id: string | null;
  name: string;
  type: DocumentType;
  storage_path: string;
  file_size: number | null;
  mime_type: string | null;
  uploaded_by: string | null;
  created_at: string;
}

export interface BidActivity {
  id: string;
  bid_id: string;
  user_id: string | null;
  type: ActivityType;
  content: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  // Joined
  profile?: Profile;
}

export interface Conversation {
  id: string;
  bid_id: string | null;
  contact_id: string | null;
  gmail_thread_id: string | null;
  subject: string | null;
  snippet: string | null;
  direction: 'inbound' | 'outbound';
  date: string | null;
  created_at: string;
}

export interface Profile {
  id: string;
  full_name: string | null;
  title: string | null;
  avatar_url: string | null;
  role: UserRole;
  google_refresh_token: string | null;
  google_access_token: string | null;
  google_token_expiry: string | null;
  gmail_synced_at: string | null;
  created_at: string;
  updated_at: string;
}

// API response shapes
export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
}

// Dashboard stats
export interface DashboardStats {
  total: number;
  urgent: number; // due <= 3 days
  this_week: number; // due <= 7 days
  submitted: number;
  won: number;
  total_bid_value: number;
  win_rate: number;
}
