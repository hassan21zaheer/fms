export type BranchId = string;

export type UserRole = 'owner' | 'superadmin' | 'branch_admin' | 'staff';

export interface Branch {
  id: BranchId;
  slug?: string;
  name: string;
  shortCode: string;
  city: string;
  address: string;
  roomsCount: number;
  tablesCount: number;
  rating: number;
  active: boolean;
  manager: string;
}

export type LocationType = 'room' | 'table' | 'counter' | 'facility';

export interface LocationItem {
  id: string;
  branchId: BranchId;
  name: string;
  type: LocationType;
  identifier: string; // e.g. "room-204"
  active: boolean;
  qrScansCount: number;
  lastScan: string;
  slug?: string;
  branchSlug?: string;
  publicUrl?: string;
  qrReady?: boolean;
  formId?: string;
  formName?: string;
}

export type QuestionType =
  | 'star'
  | 'smiley'
  | 'single'
  | 'multiple'
  | 'yesno'
  | 'scale10'
  | 'text';

export interface QuestionOption {
  id: string;
  label: string;
  score: number; // 0 - 100
  emoji?: string;
}

export interface Question {
  id: string;
  categoryId: string;
  text: string;
  type: QuestionType;
  required: boolean;
  critical: boolean; // if critical and scored low, auto-flags
  weight: number; // 1 - 5
  active: boolean;
  followUp?: boolean; // ask guests to explain a low score
  lowScoreThreshold?: number;
  options?: QuestionOption[];
}

export interface Category {
  id: string;
  name: string;
  weight: number; // percentage (sums to 100)
  icon: string;
  color: string;
}

export interface FeedbackAnswer {
  questionId: string;
  questionText: string;
  categoryId: string;
  value: string | number | string[];
  score: number; // 0 - 100
}

export type ScoreBand = 'excellent' | 'good' | 'needs_attention' | 'critical';

export type FeedbackStatus = 'open' | 'in_progress' | 'resolved' | 'verified';

export interface FeedbackRecord {
  id: string; // e.g. "FB-674839"
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  branchId: BranchId;
  locationName: string;
  locationId: string;
  createdAt: string; // ISO date
  overallScore: number; // 0 - 100
  categoryScores: Record<string, number>;
  answers: FeedbackAnswer[];
  flagged: boolean;
  flagReasons: string[];
  status: FeedbackStatus;
  caseId?: string;
  comment?: string;
}

export type CasePriority = 'urgent' | 'high' | 'medium' | 'low';
export type CaseStatus = 'open' | 'in_progress' | 'resolved';

export interface CaseNote {
  id: string;
  authorName: string;
  authorAvatar: string;
  content: string;
  createdAt: string;
}

export interface CaseItem {
  id: string;
  feedbackId: string;
  feedbackRef: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  branchId: BranchId;
  locationName: string;
  priority: CasePriority;
  status: CaseStatus;
  assigneeId: string;
  assigneeName: string;
  assigneeAvatar: string;
  title: string;
  description: string;
  score: number;
  createdAt: string;
  resolvedAt?: string;
  resolutionSummary?: string;
  notes: CaseNote[];
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string;
  branchId: BranchId;
  feedbackCount: number;
  avgScore: number;
  lastVisit: string;
  flaggedCount: number;
}

export interface UserItem {
  id: string;
  name: string;
  email: string;
  avatar: string;
  role: UserRole;
  branchId?: BranchId;
  active: boolean;
  lastActive: string;
  phone?: string;
  branchName?: string;
  organizationName?: string;
  sessions?: number;
}

export interface PermissionGroup {
  view: boolean;
  create: boolean;
  edit: boolean;
  delete: boolean;
}

export interface RolePermissions {
  feedback: PermissionGroup;
  cases: PermissionGroup;
  forms: PermissionGroup;
  scoring: PermissionGroup;
  reports: PermissionGroup;
  branches: PermissionGroup;
  users: PermissionGroup;
  settings: PermissionGroup;
}

export interface FormConfig {
  formId?: string;
  active?: boolean;
  orgName: string;
  orgLogoText: string;
  brandColor: string;
  welcomeTitle: string;
  welcomeSubtitle: string;
  thankYouTitle: string;
  thankYouSubtitle: string;
  customerInfoFields: {
    name: 'required' | 'optional' | 'hidden';
    phone: 'required' | 'optional' | 'hidden';
    email: 'required' | 'optional' | 'hidden';
  };
  categories: Category[];
  questions: Question[];
}

export interface ScoringConfig {
  bands: {
    excellent: { min: number; max: number; label: string; color: string; desc: string };
    good: { min: number; max: number; label: string; color: string; desc: string };
    needs_attention: { min: number; max: number; label: string; color: string; desc: string };
    critical: { min: number; max: number; label: string; color: string; desc: string };
  };
  flagThreshold: number; // default 60
  criticalThreshold?: number;
  rules: {
    autoFlagOverallBelowThreshold: boolean;
    autoFlagCriticalQuestionBad: boolean;
    autoFlagCategoryBelowScore: boolean;
    categoryThresholdScore: number;
  };
}

export interface SettingsConfig {
  company: {
    name: string;
    tagline: string;
    brandColor: string;
    supportEmail: string;
    supportPhone: string;
    countryCode: string;
    address: string;
    logoUrl?: string;
  };
  domain: {
    customDomain: string;
    status: 'verified' | 'pending';
    subdomain: string;
    instructions?: string;
  };
  notifications: {
    emailAlerts: boolean;
    whatsAppAlerts: boolean;
    inAppAlerts: boolean;
    notifyOnFlagged: boolean;
    dailyDigest: boolean;
    digestTime: string;
    recipients: string[];
  };
  language: {
    primary: 'en' | 'ur';
    rtlEnabled: boolean;
  };
}
