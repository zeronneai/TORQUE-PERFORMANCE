// ── PACKAGES ────────────────────────────────────────────────────────────────
export const PACKAGES = [
  {
    id: 'pkg-monthly-8',
    name: '8 Sessions / Month',
    type: 'monthly',
    sessions: 8,
    price: 1200,
    siblingPrice: 600,
    description: 'Perfect for consistent weekly training',
    features: ['2 sessions/week', 'Speed & Agility + Fielding', 'Monthly billing', 'Free reschedule 24h prior'],
    color: '#c8102e',
  },
  {
    id: 'pkg-monthly-12',
    name: '12 Sessions / Month',
    type: 'monthly',
    sessions: 12,
    price: 1600,
    siblingPrice: 800,
    description: 'For serious players pushing to the next level',
    features: ['3 sessions/week', 'All disciplines', 'Priority scheduling', 'Video analysis included'],
    color: '#d4a017',
    popular: true,
  },
  {
    id: 'pkg-fixed-10',
    name: '10-Class Pack',
    type: 'fixed',
    sessions: 10,
    price: 1500,
    siblingPrice: 750,
    description: 'Flexible pack, no expiration date',
    features: ['Use at your own pace', 'Never expires', 'Mix any discipline', 'Book anytime'],
    color: '#4fa8ff',
  },
  {
    id: 'pkg-fixed-20',
    name: '20-Class Pack',
    type: 'fixed',
    sessions: 20,
    price: 2600,
    siblingPrice: 1300,
    description: 'Best value for committed athletes',
    features: ['Use at your own pace', 'Never expires', 'Priority booking', '10% extra savings'],
    color: '#2ecc71',
  },
]

// ── SESSION TYPES ────────────────────────────────────────────────────────────
export const SESSION_TYPES = [
  { id: 'speed', name: 'Speed & Agility', color: '#c8102e', icon: '⚡' },
  { id: 'fielding', name: 'Fielding / Defense', color: '#4fa8ff', icon: '🧤' },
]

// ── COACHES ──────────────────────────────────────────────────────────────────
export const COACHES = [
  { id: 'c1', name: 'Coach Ramirez', specialty: 'Speed & Agility', avatar: 'CR' },
  { id: 'c2', name: 'Coach Martinez', specialty: 'Fielding / Defense', avatar: 'CM' },
  { id: 'c3', name: 'Coach Torres', specialty: 'Both', avatar: 'CT' },
]

// ── SCHEDULE SLOTS (recurring weekly) ───────────────────────────────────────
export const SLOTS = [
  { id: 's1', day: 'Monday', time: '09:00', type: 'speed', coach: 'c1', capacity: 10 },
  { id: 's2', day: 'Monday', time: '11:00', type: 'fielding', coach: 'c2', capacity: 10 },
  { id: 's3', day: 'Wednesday', time: '09:00', type: 'speed', coach: 'c1', capacity: 10 },
  { id: 's4', day: 'Wednesday', time: '11:00', type: 'fielding', coach: 'c2', capacity: 10 },
  { id: 's5', day: 'Wednesday', time: '17:00', type: 'speed', coach: 'c3', capacity: 12 },
  { id: 's6', day: 'Friday', time: '09:00', type: 'fielding', coach: 'c2', capacity: 10 },
  { id: 's7', day: 'Friday', time: '17:00', type: 'speed', coach: 'c3', capacity: 12 },
  { id: 's8', day: 'Saturday', time: '08:00', type: 'speed', coach: 'c1', capacity: 15 },
  { id: 's9', day: 'Saturday', time: '10:00', type: 'fielding', coach: 'c3', capacity: 15 },
  { id: 's10', day: 'Saturday', time: '12:00', type: 'speed', coach: 'c2', capacity: 12 },
]

// ── FAMILIES & PLAYERS ───────────────────────────────────────────────────────
export const FAMILIES = [
  {
    id: 'f1',
    parent: { firstName: 'Michael', lastName: 'Johnson', email: 'michael.j@email.com', phone: '614-555-0101' },
    players: [
      { id: 'p1', name: 'Tyler Johnson', age: 10, dob: '2014-06-15', packageId: 'pkg-monthly-8', sessionsUsed: 5, sessionsTotal: 8, nextBilling: '2025-04-01', status: 'active' },
    ],
    paymentMethod: 'card',
    autoRenew: true,
    joinDate: '2024-09-01',
  },
  {
    id: 'f2',
    parent: { firstName: 'Sarah', lastName: 'Martinez', email: 'sarah.m@email.com', phone: '614-555-0202' },
    players: [
      { id: 'p2', name: 'Jake Martinez', age: 12, dob: '2012-03-22', packageId: 'pkg-monthly-12', sessionsUsed: 9, sessionsTotal: 12, nextBilling: '2025-04-05', status: 'active' },
      { id: 'p3', name: 'Lucas Martinez', age: 9, dob: '2015-11-08', packageId: 'pkg-monthly-12', sessionsUsed: 7, sessionsTotal: 12, nextBilling: '2025-04-05', status: 'active', isSibling: true },
    ],
    paymentMethod: 'card',
    autoRenew: true,
    joinDate: '2024-08-15',
  },
  {
    id: 'f3',
    parent: { firstName: 'David', lastName: 'Thompson', email: 'david.t@email.com', phone: '614-555-0303' },
    players: [
      { id: 'p4', name: 'Ethan Thompson', age: 11, dob: '2013-07-30', packageId: 'pkg-fixed-10', sessionsUsed: 7, sessionsTotal: 10, nextBilling: null, status: 'active' },
    ],
    paymentMethod: 'paypal',
    autoRenew: false,
    joinDate: '2024-11-20',
  },
  {
    id: 'f4',
    parent: { firstName: 'Lisa', lastName: 'Garcia', email: 'lisa.g@email.com', phone: '614-555-0404' },
    players: [
      { id: 'p5', name: 'Noah Garcia', age: 8, dob: '2016-02-14', packageId: 'pkg-monthly-8', sessionsUsed: 8, sessionsTotal: 8, nextBilling: '2025-03-28', status: 'expiring' },
      { id: 'p6', name: 'Mia Garcia', age: 10, dob: '2014-09-05', packageId: 'pkg-monthly-8', sessionsUsed: 6, sessionsTotal: 8, nextBilling: '2025-03-28', status: 'expiring', isSibling: true },
    ],
    paymentMethod: 'cash',
    autoRenew: false,
    joinDate: '2024-10-10',
  },
  {
    id: 'f5',
    parent: { firstName: 'Robert', lastName: 'Williams', email: 'robert.w@email.com', phone: '614-555-0505' },
    players: [
      { id: 'p7', name: 'Mason Williams', age: 13, dob: '2011-12-01', packageId: 'pkg-fixed-20', sessionsUsed: 14, sessionsTotal: 20, nextBilling: null, status: 'active' },
    ],
    paymentMethod: 'card',
    autoRenew: false,
    joinDate: '2024-07-01',
  },
]

// ── BOOKINGS ─────────────────────────────────────────────────────────────────
export const BOOKINGS = [
  { id: 'b1', playerId: 'p1', slotId: 's1', date: '2025-03-24', status: 'confirmed' },
  { id: 'b2', playerId: 'p2', slotId: 's1', date: '2025-03-24', status: 'confirmed' },
  { id: 'b3', playerId: 'p3', slotId: 's2', date: '2025-03-24', status: 'confirmed' },
  { id: 'b4', playerId: 'p4', slotId: 's3', date: '2025-03-26', status: 'confirmed' },
  { id: 'b5', playerId: 'p5', slotId: 's8', date: '2025-03-22', status: 'attended' },
  { id: 'b6', playerId: 'p6', slotId: 's8', date: '2025-03-22', status: 'attended' },
  { id: 'b7', playerId: 'p7', slotId: 's5', date: '2025-03-19', status: 'attended' },
  { id: 'b8', playerId: 'p1', slotId: 's9', date: '2025-03-22', status: 'attended' },
  { id: 'b9', playerId: 'p2', slotId: 's5', date: '2025-03-19', status: 'cancelled' },
  { id: 'b10', playerId: 'p7', slotId: 's7', date: '2025-03-21', status: 'attended' },
]

// ── EVENTS ───────────────────────────────────────────────────────────────────
export const EVENTS = [
  {
    id: 'e1',
    title: 'Spring Showcase 2025',
    date: '2025-04-19',
    time: '09:00 AM',
    location: 'Torque Performance Field',
    description: 'Annual showcase where players demonstrate their skills to parents and scouts. All skill levels welcome.',
    type: 'showcase',
    spots: 40,
    registered: 28,
    image: '⚾',
  },
  {
    id: 'e2',
    title: 'Speed & Agility Camp',
    date: '2025-04-05',
    time: '08:00 AM',
    location: 'Main Training Facility',
    description: 'Intensive 1-day camp focused on explosive speed, base running mechanics, and agility drills.',
    type: 'camp',
    spots: 20,
    registered: 15,
    image: '⚡',
  },
  {
    id: 'e3',
    title: 'Fielding Fundamentals Clinic',
    date: '2025-04-12',
    time: '10:00 AM',
    location: 'Torque Performance Field',
    description: 'Master the basics of infield and outfield defense. Glove work, footwork, and throwing mechanics.',
    type: 'clinic',
    spots: 16,
    registered: 9,
    image: '🧤',
  },
  {
    id: 'e4',
    title: 'Parent Meet & Greet',
    date: '2025-04-26',
    time: '06:00 PM',
    location: 'Academy Lounge',
    description: 'Monthly gathering for parents to connect with coaches, ask questions, and see progress reports.',
    type: 'social',
    spots: 50,
    registered: 18,
    image: '🤝',
  },
]

// ── ATTENDANCE LOG ────────────────────────────────────────────────────────────
export const ATTENDANCE = [
  { date: '2025-03-22', slotId: 's8', attended: ['p5','p6','p1'], absent: ['p7'] },
  { date: '2025-03-21', slotId: 's7', attended: ['p7','p4'], absent: [] },
  { date: '2025-03-19', slotId: 's5', attended: ['p7','p3'], absent: ['p2'] },
  { date: '2025-03-17', slotId: 's1', attended: ['p1','p2','p5'], absent: [] },
  { date: '2025-03-15', slotId: 's9', attended: ['p4','p6','p1'], absent: ['p3'] },
]
