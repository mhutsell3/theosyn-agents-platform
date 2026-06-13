// Shared config — safe to import in client components (no server dependencies)

// ── Major chain / franchise blocklist ────────────────────────────────────
// Leads matching any of these keywords are auto-dismissed as non-SMB targets.
// Add to this list as you encounter chains in Scout results.
export const CHAIN_KEYWORDS = [
  // Fast food
  "chick-fil-a", "chickfila", "mcdonald", "burger king", "wendy's", "wendys",
  "taco bell", "subway", "domino's", "dominoes", "pizza hut", "kfc",
  "popeyes", "sonic drive", "dairy queen", "arby's", "arbys", "hardee's",
  "hardees", "jack in the box", "whataburger", "five guys", "chipotle",
  "panda express", "wingstop", "zaxby's", "raising cane", "culver's",
  "steak 'n shake", "waffle house", "ihop", "denny's", "dennys",
  "cracker barrel", "olive garden", "applebee's", "applebees", "chili's",
  "chilies", "outback steakhouse", "red lobster", "buffalo wild wings",
  "panera bread", "jimmy john's", "jersey mike", "firehouse subs",
  "potbelly", "jason's deli", "mcalister", "noodles & company",
  // Coffee / bakery chains
  "starbucks", "dunkin", "tim hortons", "dutch bros", "caribou coffee",
  "einstein bagels", "bruegger", "great harvest",
  // Retail chains
  "walmart", "target", "kroger", "walgreens", "cvs", "rite aid",
  "dollar general", "dollar tree", "family dollar", "aldi", "lidl",
  "whole foods", "trader joe", "publix", "meijer", "costco", "sam's club",
  "home depot", "lowe's", "lowes", "menards", "ace hardware", "true value",
  "autozone", "o'reilly", "advance auto", "napa auto", "pep boys",
  // Fitness chains
  "planet fitness", "anytime fitness", "la fitness", "gold's gym",
  "24 hour fitness", "snap fitness", "orangetheory", "pure barre", "f45",
  "crunch fitness", "ymca", "curves",
  // Salon chains
  "great clips", "supercuts", "sport clips", "fantastic sams",
  "regis salon", "cost cutters", "first choice haircutters",
  "floyd's barbershop", "roosters",
  // Other service chains
  "jiffy lube", "midas", "meineke", "firestone", "pep boys",
  "christian brothers", "maaco", "caliber collision", "service king",
  "uhaul", "u-haul", "penske", "ryder", "budget truck",
  "h&r block", "jackson hewitt", "liberty tax",
  "edward jones", "state farm", "allstate", "farmers insurance",
  "century 21", "re/max", "remax", "coldwell banker", "keller williams",
  "servpro", "servicemaster", "stanley steemer", "molly maid",
  "superamerica", "speedway", "circle k", "marathon",
]

export function isChainBusiness(name: string): boolean {
  const lower = name.toLowerCase()
  return CHAIN_KEYWORDS.some(kw => lower.includes(kw))
}

export const TARGET_JOB_ROLES = [
  'social media manager',
  'office manager',
  'customer service representative',
  'receptionist',
  'marketing coordinator',
  'bookkeeper',
  'data entry',
  'administrative assistant',
  'content creator',
  'marketing assistant',
  'executive assistant',
  'sales coordinator',
  'operations coordinator',
]
