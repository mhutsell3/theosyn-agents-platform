// Client-safe constants — no server deps
export const PURCHASE_LEVELS = ['Community', 'Free', 'Core', 'Premium'] as const
export type PurchaseLevel = typeof PURCHASE_LEVELS[number]

export const LEVEL_COLOR: Record<string, string> = {
  Community: 'text-brand-gold bg-yellow-950 border border-yellow-800',
  Free:      'text-zinc-400 bg-zinc-800',
  Core:      'text-blue-400 bg-blue-950',
  Premium:   'text-amber-400 bg-amber-950',
}

export const LEVEL_PERKS: Record<string, string> = {
  Community: 'access to the TheoSYN AI Community — weekly live training, playbooks, peer network, and monthly group Q&A',
  Free:      'access to our free community resources and introductory content',
  Core:      'access to core course materials, community discussions, and monthly group calls',
  Premium:   'full access to all courses, priority support, one-on-one coaching sessions, and exclusive premium resources',
}
