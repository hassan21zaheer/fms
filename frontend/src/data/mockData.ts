import {
  Branch,
  LocationItem,
  Category,
  Question,
  FeedbackRecord,
  CaseItem,
  UserItem,
  Customer,
  FormConfig,
  ScoringConfig,
  SettingsConfig,
  RolePermissions,
} from '../types';

export const INITIAL_BRANCHES: Branch[] = [
  {
    id: 'islamabad',
    name: 'Serena Grove Luxury Suites',
    shortCode: 'ISB',
    city: 'Islamabad',
    address: 'Club Road, Sector G-5/1, Islamabad',
    roomsCount: 48,
    tablesCount: 22,
    rating: 4.8,
    active: true,
    manager: 'Tariq Mehmood',
  },
  {
    id: 'lahore',
    name: 'Serena Grove Heritage & Café',
    shortCode: 'LHE',
    city: 'Lahore',
    address: 'Gulberg III, MM Alam Road, Lahore',
    roomsCount: 36,
    tablesCount: 30,
    rating: 4.6,
    active: true,
    manager: 'Saman Zehra',
  },
  {
    id: 'karachi',
    name: 'Serena Grove Marina & Beach Resort',
    shortCode: 'KHI',
    city: 'Karachi',
    address: 'Marine Drive, Block 4, Clifton, Karachi',
    roomsCount: 64,
    tablesCount: 38,
    rating: 4.7,
    active: true,
    manager: 'Farhan Qureshi',
  },
];

export const INITIAL_LOCATIONS: LocationItem[] = [
  // Islamabad
  { id: 'loc-isb-r101', branchId: 'islamabad', name: 'Room 101 (Executive)', type: 'room', identifier: 'Room-101', active: true, qrScansCount: 42, lastScan: '2 hours ago' },
  { id: 'loc-isb-r204', branchId: 'islamabad', name: 'Room 204 (Deluxe Suite)', type: 'room', identifier: 'Room-204', active: true, qrScansCount: 78, lastScan: '14 mins ago' },
  { id: 'loc-isb-r305', branchId: 'islamabad', name: 'Room 305 (Presidential)', type: 'room', identifier: 'Room-305', active: true, qrScansCount: 31, lastScan: 'Yesterday' },
  { id: 'loc-isb-t01', branchId: 'islamabad', name: 'Table 1 (Terrace Garden)', type: 'table', identifier: 'Table-1', active: true, qrScansCount: 95, lastScan: '35 mins ago' },
  { id: 'loc-isb-t05', branchId: 'islamabad', name: 'Table 5 (Pine Dining)', type: 'table', identifier: 'Table-5', active: true, qrScansCount: 112, lastScan: '5 mins ago' },
  { id: 'loc-isb-rec', branchId: 'islamabad', name: 'Front Desk & Reception', type: 'counter', identifier: 'Reception', active: true, qrScansCount: 84, lastScan: '1 hour ago' },

  // Lahore
  { id: 'loc-lhe-r102', branchId: 'lahore', name: 'Room 102 (Courtyard View)', type: 'room', identifier: 'Room-102', active: true, qrScansCount: 53, lastScan: '3 hours ago' },
  { id: 'loc-lhe-r208', branchId: 'lahore', name: 'Room 208 (Heritage Suite)', type: 'room', identifier: 'Room-208', active: true, qrScansCount: 61, lastScan: 'Yesterday' },
  { id: 'loc-lhe-t03', branchId: 'lahore', name: 'Table 3 (Boutique Veranda)', type: 'table', identifier: 'Table-3', active: true, qrScansCount: 124, lastScan: '18 mins ago' },
  { id: 'loc-lhe-t09', branchId: 'lahore', name: 'Table 9 (Café Courtyard)', type: 'table', identifier: 'Table-9', active: true, qrScansCount: 140, lastScan: '8 mins ago' },
  { id: 'loc-lhe-rec', branchId: 'lahore', name: 'Concierge Counter', type: 'counter', identifier: 'Concierge', active: true, qrScansCount: 69, lastScan: '4 hours ago' },

  // Karachi
  { id: 'loc-khi-r402', branchId: 'karachi', name: 'Room 402 (Ocean Panorama)', type: 'room', identifier: 'Room-402', active: true, qrScansCount: 88, lastScan: '45 mins ago' },
  { id: 'loc-khi-r501', branchId: 'karachi', name: 'Penthouse 501', type: 'room', identifier: 'Penthouse-501', active: true, qrScansCount: 29, lastScan: '2 days ago' },
  { id: 'loc-khi-t12', branchId: 'karachi', name: 'Table 12 (Sea Breeze Deck)', type: 'table', identifier: 'Table-12', active: true, qrScansCount: 165, lastScan: 'Just now' },
  { id: 'loc-khi-t18', branchId: 'karachi', name: 'Table 18 (Cabana Lounge)', type: 'table', identifier: 'Table-18', active: true, qrScansCount: 119, lastScan: '52 mins ago' },
  { id: 'loc-khi-rec', branchId: 'karachi', name: 'Lobby & Valet', type: 'counter', identifier: 'Lobby', active: true, qrScansCount: 77, lastScan: '2 hours ago' },
];

export const INITIAL_CATEGORIES: Category[] = [
  { id: 'cat-room', name: 'Room', weight: 25, icon: 'BedDouble', color: '#F59E0B' }, // orange
  { id: 'cat-clean', name: 'Cleanliness', weight: 25, icon: 'Sparkles', color: '#3B82F6' }, // blue
  { id: 'cat-staff', name: 'Staff', weight: 20, icon: 'Users', color: '#EAB308' }, // yellow
  { id: 'cat-food', name: 'Food & Beverage', weight: 15, icon: 'UtensilsCrossed', color: '#F43F5E' }, // coral
  { id: 'cat-service', name: 'Service & Speed', weight: 15, icon: 'Clock', color: '#10B981' }, // green
];

export const INITIAL_QUESTIONS: Question[] = [
  {
    id: 'q-room-comfort',
    categoryId: 'cat-room',
    text: 'How comfortable was your room and bed arrangement?',
    type: 'star',
    required: true,
    critical: false,
    weight: 4,
    active: true,
  },
  {
    id: 'q-room-amenities',
    categoryId: 'cat-room',
    text: 'Did all in-room electronics, AC, and hot water function smoothly?',
    type: 'yesno',
    required: true,
    critical: true,
    weight: 5,
    active: true,
  },
  {
    id: 'q-clean-overall',
    categoryId: 'cat-clean',
    text: 'How would you rate the hygiene and overall cleanliness of your area?',
    type: 'smiley',
    required: true,
    critical: true,
    weight: 5,
    active: true,
  },
  {
    id: 'q-staff-courtesy',
    categoryId: 'cat-staff',
    text: 'Was our staff friendly, courteous, and attentive to your requests?',
    type: 'star',
    required: true,
    critical: false,
    weight: 4,
    active: true,
  },
  {
    id: 'q-food-quality',
    categoryId: 'cat-food',
    text: 'How was the taste, presentation, and freshness of your food?',
    type: 'single',
    required: true,
    critical: false,
    weight: 4,
    active: true,
    options: [
      { id: 'opt-f1', label: 'Delightful & Fresh', score: 100, emoji: '✨' },
      { id: 'opt-f2', label: 'Good & Satisfying', score: 75, emoji: '👍' },
      { id: 'opt-f3', label: 'Average / Neutral', score: 50, emoji: '😐' },
      { id: 'opt-f4', label: 'Below Expectations', score: 25, emoji: '👎' },
      { id: 'opt-f5', label: 'Unacceptable', score: 0, emoji: '❌' },
    ],
  },
  {
    id: 'q-service-nps',
    categoryId: 'cat-service',
    text: 'On a scale from 0 to 10, how likely are you to recommend Serena Grove?',
    type: 'scale10',
    required: true,
    critical: false,
    weight: 5,
    active: true,
  },
  {
    id: 'q-free-comments',
    categoryId: 'cat-service',
    text: 'Any additional thoughts, compliments, or suggestions for our team?',
    type: 'text',
    required: false,
    critical: false,
    weight: 1,
    active: true,
  },
];

export const INITIAL_FORM_CONFIG: FormConfig = {
  orgName: 'Serena Grove Hotels & Cafés',
  orgLogoText: 'SG',
  brandColor: '#4338F5',
  welcomeTitle: 'Your Experience Matters',
  welcomeSubtitle: 'Please share your feedback to help us craft exceptional hospitality moments.',
  thankYouTitle: 'Thank You for Your Feedback!',
  thankYouSubtitle: 'Your response has been shared with our management team for immediate review.',
  customerInfoFields: {
    name: 'required',
    phone: 'required',
    email: 'optional',
  },
  categories: INITIAL_CATEGORIES,
  questions: INITIAL_QUESTIONS,
};

export const INITIAL_SCORING_CONFIG: ScoringConfig = {
  bands: {
    excellent: { min: 80, max: 100, label: 'Excellent', color: '#3B82F6', desc: 'Guests are delighted and loyal' },
    good: { min: 60, max: 79, label: 'Good', color: '#F97316', desc: 'Positive experience with minor tweaks' },
    needs_attention: { min: 40, max: 59, label: 'Needs Attention', color: '#EAB308', desc: 'Issues reported requiring review' },
    critical: { min: 0, max: 39, label: 'Critical', color: '#EF4444', desc: 'Urgent guest friction needing escalation' },
  },
  flagThreshold: 60,
  rules: {
    autoFlagOverallBelowThreshold: true,
    autoFlagCriticalQuestionBad: true,
    autoFlagCategoryBelowScore: true,
    categoryThresholdScore: 40,
  },
};

export const INITIAL_USERS: UserItem[] = [
  {
    id: 'usr-1',
    name: 'Barbara Vance',
    email: 'barbara.vance@serenagrove.com',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80',
    role: 'superadmin',
    active: true,
    lastActive: 'Active now',
  },
  {
    id: 'usr-2',
    name: 'Tariq Mehmood',
    email: 'tariq.m@serenagrove.com',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80',
    role: 'branch_admin',
    branchId: 'islamabad',
    active: true,
    lastActive: '12 mins ago',
  },
  {
    id: 'usr-3',
    name: 'Saman Zehra',
    email: 'saman.z@serenagrove.com',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&auto=format&fit=crop&q=80',
    role: 'branch_admin',
    branchId: 'lahore',
    active: true,
    lastActive: '45 mins ago',
  },
  {
    id: 'usr-4',
    name: 'Farhan Qureshi',
    email: 'farhan.q@serenagrove.com',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120&auto=format&fit=crop&q=80',
    role: 'branch_admin',
    branchId: 'karachi',
    active: true,
    lastActive: '1 hour ago',
  },
  {
    id: 'usr-5',
    name: 'Asad Cheema',
    email: 'asad.c@serenagrove.com',
    avatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=120&auto=format&fit=crop&q=80',
    role: 'staff',
    branchId: 'islamabad',
    active: true,
    lastActive: '3 hours ago',
  },
  {
    id: 'usr-6',
    name: 'Nadia Malik',
    email: 'nadia.m@serenagrove.com',
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=120&auto=format&fit=crop&q=80',
    role: 'staff',
    branchId: 'lahore',
    active: true,
    lastActive: 'Yesterday',
  },
];

export const INITIAL_ROLES_PERMISSIONS: Record<string, RolePermissions> = {
  superadmin: {
    feedback: { view: true, create: true, edit: true, delete: true },
    cases: { view: true, create: true, edit: true, delete: true },
    forms: { view: true, create: true, edit: true, delete: true },
    scoring: { view: true, create: true, edit: true, delete: true },
    reports: { view: true, create: true, edit: true, delete: true },
    branches: { view: true, create: true, edit: true, delete: true },
    users: { view: true, create: true, edit: true, delete: true },
    settings: { view: true, create: true, edit: true, delete: true },
  },
  branch_admin: {
    feedback: { view: true, create: true, edit: true, delete: false },
    cases: { view: true, create: true, edit: true, delete: false },
    forms: { view: true, create: false, edit: false, delete: false },
    scoring: { view: true, create: false, edit: false, delete: false },
    reports: { view: true, create: true, edit: false, delete: false },
    branches: { view: true, create: false, edit: true, delete: false },
    users: { view: true, create: true, edit: true, delete: false },
    settings: { view: true, create: false, edit: false, delete: false },
  },
  staff: {
    feedback: { view: true, create: true, edit: false, delete: false },
    cases: { view: true, create: true, edit: true, delete: false },
    forms: { view: true, create: false, edit: false, delete: false },
    scoring: { view: true, create: false, edit: false, delete: false },
    reports: { view: true, create: false, edit: false, delete: false },
    branches: { view: true, create: false, edit: false, delete: false },
    users: { view: false, create: false, edit: false, delete: false },
    settings: { view: false, create: false, edit: false, delete: false },
  },
};

export const INITIAL_SETTINGS: SettingsConfig = {
  company: {
    name: 'Serena Grove Hotels & Cafés',
    tagline: 'Refined Hospitality Across Pakistan',
    brandColor: '#4338F5',
    supportEmail: 'hospitality@serenagrove.com',
    supportPhone: '+92 51 282 0011',
    countryCode: '92',
    address: 'Club Road, Sector G-5/1, Islamabad, Pakistan',
  },
  domain: {
    customDomain: 'feedback.serenagrove.com',
    status: 'verified',
    subdomain: 'serenagrove.feedbackos.app',
  },
  notifications: {
    emailAlerts: true,
    whatsAppAlerts: true,
    inAppAlerts: true,
    notifyOnFlagged: true,
    dailyDigest: true,
    digestTime: '09:00',
    recipients: [],
  },
  language: {
    primary: 'en',
    rtlEnabled: false,
  },
};

// Deterministic mock feedback generation (~300 records)
const CUSTOMER_NAMES = [
  'Hamza Malik', 'Ayesha Khan', 'Bilal Ahmed', 'Zainab Tariq', 'Omer Farooq',
  'Fatima Noor', 'Saad Rauf', 'Mahnoor Shah', 'Daniyal Qureshi', 'Sara Alvi',
  'Hassan Raza', 'Hina Jamil', 'Usman Butt', 'Khadija Abbasi', 'Waqas Sheikh',
  'Mehwish Ali', 'Shahid Afridi', 'Mariam Chaudhry', 'Taimoor Baig', 'Amina Gillani',
  'Zubair Niazi', 'Sumbul Iqbal', 'Rehan Siddiqui', 'Faiza Tahir', 'Arslan Ghafoor',
  'Noor-ul-Ain', 'Junaid Zia', 'Bushra Ansari', 'Ali Haider', 'Haleema Sadia',
];

const COMMENTS_POSITIVE = [
  'The suite was immaculate and the mountain views were breathtaking.',
  'Courteous staff, warm hospitality. The breakfast buffet was exquisite.',
  'Fast check-in and beautiful room decor. Will definitely return next month.',
  'The terrace café ambiance in Lahore is unmatched. Highly recommended!',
  'Exceptional concierge service. Helped us arrange transport in minutes.',
];

const COMMENTS_CRITICAL = [
  'Air conditioning in room was making clicking noise all night. Slept poorly.',
  'Bathroom drainage was sluggish and floor was not properly cleaned.',
  'Order took over 45 minutes to arrive at Table 5 and soup was lukewarm.',
  'Reception staff seemed distracted during late check-in and gave wrong keycard.',
  'Wi-Fi was unstable during important Zoom call from our room.',
];

export function generateInitialFeedback(): { feedback: FeedbackRecord[]; cases: CaseItem[]; customers: Customer[] } {
  const records: FeedbackRecord[] = [];
  const cases: CaseItem[] = [];
  const customerMap = new Map<string, Customer>();

  const branches: Branch[] = INITIAL_BRANCHES;
  const now = new Date('2026-11-09T23:00:00Z').getTime();
  const dayMs = 24 * 60 * 60 * 1000;

  // Let's create ~310 records spread over 60 days
  for (let i = 1; i <= 312; i++) {
    const nameIndex = (i * 7) % CUSTOMER_NAMES.length;
    const customerName = CUSTOMER_NAMES[nameIndex];
    const customerPhone = `03${((i % 4) + 1).toString().padStart(2, '0')} ${3000000 + ((i * 12345) % 8999999)}`;
    const emailSlug = customerName.toLowerCase().replace(/[^a-z]/g, '.');
    const customerEmail = `${emailSlug}@gmail.com`;

    const branch = branches[i % branches.length];
    const locsForBranch = INITIAL_LOCATIONS.filter((l) => l.branchId === branch.id);
    const location = locsForBranch[i % locsForBranch.length];

    // Timestamp within last 60 days
    const daysAgo = (i * 0.19) % 58;
    const createdAt = new Date(now - daysAgo * dayMs - (i * 37) % dayMs).toISOString();

    // Bias scores toward high quality (75% good/excellent, 15% needs attention, 10% critical)
    const seed = (i * 9301 + 49297) % 233280;
    const rand = seed / 233280;

    let overallScore: number;
    let isFlagged = false;
    const flagReasons: string[] = [];

    if (rand < 0.58) {
      // 80 - 100
      overallScore = Math.floor(82 + (rand / 0.58) * 18);
    } else if (rand < 0.78) {
      // 60 - 79
      overallScore = Math.floor(62 + ((rand - 0.58) / 0.20) * 17);
    } else if (rand < 0.90) {
      // 40 - 59 (Needs attention)
      overallScore = Math.floor(42 + ((rand - 0.78) / 0.12) * 17);
      isFlagged = true;
      flagReasons.push('Overall score below threshold (60)');
    } else {
      // < 40 (Critical)
      overallScore = Math.floor(22 + ((rand - 0.90) / 0.10) * 17);
      isFlagged = true;
      flagReasons.push('Critical score recorded');
      flagReasons.push('Critical question amenities rated poor');
    }

    const roomScore = Math.min(100, Math.max(10, overallScore + ((i % 11) - 5) * 2));
    const cleanScore = Math.min(100, Math.max(10, overallScore + ((i % 7) - 3) * 3));
    const staffScore = Math.min(100, Math.max(10, overallScore + ((i % 5) - 2) * 2));
    const foodScore = Math.min(100, Math.max(10, overallScore + ((i % 9) - 4) * 2));
    const serviceScore = Math.min(100, Math.max(10, overallScore + ((i % 13) - 6) * 2));

    const categoryScores = {
      'cat-room': roomScore,
      'cat-clean': cleanScore,
      'cat-staff': staffScore,
      'cat-food': foodScore,
      'cat-service': serviceScore,
    };

    const comment = isFlagged
      ? COMMENTS_CRITICAL[i % COMMENTS_CRITICAL.length]
      : i % 3 === 0
      ? COMMENTS_POSITIVE[i % COMMENTS_POSITIVE.length]
      : undefined;

    const answers = [
      {
        questionId: 'q-room-comfort',
        questionText: 'How comfortable was your room and bed arrangement?',
        categoryId: 'cat-room',
        value: overallScore >= 80 ? 5 : overallScore >= 60 ? 4 : overallScore >= 40 ? 3 : 2,
        score: roomScore,
      },
      {
        questionId: 'q-room-amenities',
        questionText: 'Did all in-room electronics, AC, and hot water function smoothly?',
        categoryId: 'cat-room',
        value: overallScore >= 60 ? 'Yes' : 'No',
        score: overallScore >= 60 ? 100 : 20,
      },
      {
        questionId: 'q-clean-overall',
        questionText: 'How would you rate the hygiene and overall cleanliness of your area?',
        categoryId: 'cat-clean',
        value: overallScore >= 80 ? 'very_happy' : overallScore >= 60 ? 'happy' : overallScore >= 40 ? 'neutral' : 'unhappy',
        score: cleanScore,
      },
      {
        questionId: 'q-staff-courtesy',
        questionText: 'Was our staff friendly, courteous, and attentive to your requests?',
        categoryId: 'cat-staff',
        value: overallScore >= 80 ? 5 : overallScore >= 60 ? 4 : 3,
        score: staffScore,
      },
      {
        questionId: 'q-food-quality',
        questionText: 'How was the taste, presentation, and freshness of your food?',
        categoryId: 'cat-food',
        value: overallScore >= 80 ? 'Delightful & Fresh' : overallScore >= 60 ? 'Good & Satisfying' : 'Average / Neutral',
        score: foodScore,
      },
      {
        questionId: 'q-service-nps',
        questionText: 'On a scale from 0 to 10, how likely are you to recommend Serena Grove?',
        categoryId: 'cat-service',
        value: Math.round(overallScore / 10),
        score: serviceScore,
      },
    ];

    if (comment) {
      answers.push({
        questionId: 'q-free-comments',
        questionText: 'Any additional thoughts, compliments, or suggestions for our team?',
        categoryId: 'cat-service',
        value: comment,
        score: overallScore,
      });
    }

    const feedbackId = `FB-${(674800 + i).toString()}`;
    const statusPool: ('open' | 'in_progress' | 'resolved' | 'verified')[] = isFlagged
      ? ['open', 'in_progress', 'resolved']
      : ['verified', 'resolved', 'open'];
    const status = statusPool[i % statusPool.length];

    const fbRecord: FeedbackRecord = {
      id: feedbackId,
      customerName,
      customerPhone,
      customerEmail,
      branchId: branch.id,
      locationName: location.name,
      locationId: location.id,
      createdAt,
      overallScore,
      categoryScores,
      answers,
      flagged: isFlagged,
      flagReasons,
      status,
      comment,
    };

    records.push(fbRecord);

    // If flagged, create a corresponding Case
    if (isFlagged && i % 2 === 0) {
      const caseId = `CASE-${1000 + cases.length + 1}`;
      fbRecord.caseId = caseId;

      const assignees = INITIAL_USERS.filter((u) => u.role !== 'superadmin');
      const assignee = assignees[cases.length % assignees.length];

      const priority: 'urgent' | 'high' | 'medium' | 'low' =
        overallScore < 35 ? 'urgent' : overallScore < 50 ? 'high' : 'medium';

      const caseStatus: 'open' | 'in_progress' | 'resolved' =
        cases.length % 3 === 0 ? 'open' : cases.length % 3 === 1 ? 'in_progress' : 'resolved';

      const notes = [
        {
          id: `note-${caseId}-1`,
          authorName: 'System Bot',
          authorAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80&fit=crop',
          content: `Auto-escalated case from ${location.name} (${branch.name}). Overall score ${overallScore}/100.`,
          createdAt,
        },
      ];

      if (caseStatus !== 'open') {
        notes.push({
          id: `note-${caseId}-2`,
          authorName: assignee.name,
          authorAvatar: assignee.avatar,
          content: `Contacted customer via phone at ${customerPhone}. Apologized for the inconvenience and offered complimentary lounge access.`,
          createdAt: new Date(new Date(createdAt).getTime() + 3 * 3600 * 1000).toISOString(),
        });
      }

      cases.push({
        id: caseId,
        feedbackId: fbRecord.id,
        feedbackRef: fbRecord.id,
        customerName,
        customerPhone,
        customerEmail,
        branchId: branch.id,
        locationName: location.name,
        priority,
        status: caseStatus,
        assigneeId: assignee.id,
        assigneeName: assignee.name,
        assigneeAvatar: assignee.avatar,
        title: `Service issue at ${location.name}`,
        description: comment || `Guest experienced friction with room amenities and overall service speed.`,
        score: overallScore,
        createdAt,
        notes,
        resolvedAt: caseStatus === 'resolved' ? new Date(new Date(createdAt).getTime() + 12 * 3600 * 1000).toISOString() : undefined,
        resolutionSummary: caseStatus === 'resolved' ? 'Guest was re-contacted and issue resolved with room service credit.' : undefined,
      });
    }

    // Accumulate customer aggregate
    const existing = customerMap.get(customerEmail);
    if (!existing) {
      customerMap.set(customerEmail, {
        id: `cust-${customerMap.size + 1}`,
        name: customerName,
        phone: customerPhone,
        email: customerEmail,
        branchId: branch.id,
        feedbackCount: 1,
        avgScore: overallScore,
        lastVisit: createdAt,
        flaggedCount: isFlagged ? 1 : 0,
      });
    } else {
      existing.feedbackCount += 1;
      existing.avgScore = Math.round((existing.avgScore * (existing.feedbackCount - 1) + overallScore) / existing.feedbackCount);
      if (new Date(createdAt).getTime() > new Date(existing.lastVisit).getTime()) {
        existing.lastVisit = createdAt;
      }
      if (isFlagged) existing.flaggedCount += 1;
    }
  }

  // Sort feedbacks newest first
  records.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  cases.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return {
    feedback: records,
    cases,
    customers: Array.from(customerMap.values()),
  };
}
