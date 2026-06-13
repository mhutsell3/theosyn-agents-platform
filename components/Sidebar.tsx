'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { useState } from 'react'

interface NavItem {
  label: string
  href: string
  icon: string
}

interface NavCategory {
  label: string
  icon: string
  items: NavItem[]
}

const categories: NavCategory[] = [
  {
    label: 'Command',
    icon: '⚡',
    items: [
      { label: 'Dashboard',  href: '/',          icon: '⚡' },
      { label: 'Theo',       href: '/theo',      icon: '🧠' },
      { label: 'Calendar',   href: '/calendar',  icon: '📅' },
      { label: 'Approvals',  href: '/approvals', icon: '✋' },
    ],
  },
  {
    label: 'Operations',
    icon: '💼',
    items: [
      { label: 'Clients',   href: '/clients',  icon: '💼' },
      { label: 'Projects',  href: '/projects', icon: '🏗️' },
      { label: 'Finance',   href: '/finance',  icon: '💰' },
      { label: 'Content',   href: '/content',  icon: '🎬' },
      { label: 'Atlas',     href: '/atlas',    icon: '🗺️' },
      { label: 'Lumen',     href: '/lumen',    icon: '💡' },
    ],
  },
  {
    label: 'Sales & Marketing',
    icon: '🧭',
    items: [
      { label: 'Piper',  href: '/piper',  icon: '🤝' },
      { label: 'Flow',   href: '/flow',   icon: '🌊' },
      { label: 'Remi',   href: '/remi',   icon: '📊' },
      { label: 'Pulse',  href: '/pulse',  icon: '📡' },
      { label: 'Orion',  href: '/orion',  icon: '🔭' },
    ],
  },
  {
    label: 'Research & Content',
    icon: '🔍',
    items: [
      { label: 'Scout',  href: '/scout',   icon: '🧭' },
      { label: 'Sage',   href: '/sage',    icon: '🔍' },
      { label: 'Nova',   href: '/content', icon: '⭐' },
      { label: 'Quill',  href: '/quill',   icon: '🖊️' },
    ],
  },
  {
    label: 'Commerce',
    icon: '🛒',
    items: [
      { label: 'Forge',  href: '/forge',  icon: '🛒' },
    ],
  },
  {
    label: 'Education',
    icon: '🎓',
    items: [
      { label: 'Beacon', href: '/beacon', icon: '🎓' },
      { label: 'Scribe', href: '/scribe', icon: '📜' },
    ],
  },
  {
    label: 'Ministry',
    icon: '✝️',
    items: [
      { label: 'Logos',  href: '/logos',  icon: '📖' },
    ],
  },
  {
    label: 'System',
    icon: '⚙️',
    items: [
      { label: 'Agents',   href: '/agents',   icon: '🤖' },
      { label: 'Settings', href: '/settings', icon: '⚙️' },
    ],
  },
]

const mobileNav = [
  { label: 'Home',     href: '/',        icon: '⚡' },
  { label: 'Clients',  href: '/clients', icon: '💼' },
  { label: 'Scout',    href: '/scout',   icon: '🧭' },
  { label: 'Forge',    href: '/forge',   icon: '🛒' },
  { label: 'More',     href: '#menu',    icon: '☰'  },
]

interface User {
  name?: string | null
  email?: string | null
  image?: string | null
}

export default function Sidebar({ user }: { user?: User }) {
  const pathname = usePathname()
  const [menuOpen, setMenuOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(true)

  // Find which category contains the active path — open it by default
  const activeCategory = categories.find(cat => cat.items.some(i => i.href === pathname))?.label
  const [openCategories, setOpenCategories] = useState<Set<string>>(
    new Set(activeCategory ? [activeCategory] : ['Command'])
  )

  function toggleCategory(label: string) {
    setOpenCategories(prev => {
      const next = new Set(prev)
      if (next.has(label)) next.delete(label)
      else next.add(label)
      return next
    })
  }

  // When expanded, auto-open category of current page
  const allItems = categories.flatMap(c => c.items)

  return (
    <>
      {/* ── Desktop sidebar ─────────────────────────────────── */}
      <aside className={`hidden md:flex ${collapsed ? 'w-14' : 'w-56'} min-h-screen bg-zinc-900 border-r border-zinc-800 flex-col py-4 flex-shrink-0 transition-all duration-200`}>

        {/* Header + collapse toggle */}
        <div className={`flex items-center justify-between mb-6 ${collapsed ? 'px-2' : 'px-3'}`}>
          {!collapsed && (
            <div>
              <h1 className="text-white font-bold text-base tracking-tight">TheoSYN</h1>
              <p className="text-zinc-500 text-xs mt-0.5">Command Center</p>
            </div>
          )}
          <button
            onClick={() => setCollapsed(c => !c)}
            className={`text-zinc-500 hover:text-white transition-colors p-1 rounded-lg hover:bg-zinc-800 ${collapsed ? 'mx-auto' : ''}`}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? '→' : '←'}
          </button>
        </div>

        {/* Nav */}
        <nav className={`flex flex-col gap-0.5 overflow-y-auto flex-1 ${collapsed ? 'px-1' : 'px-2'}`}>
          {collapsed ? (
            // Collapsed: icons grouped by category with dividers
            categories.map((cat, catIdx) => (
              <div key={cat.label}>
                {catIdx > 0 && <div className="border-t border-zinc-800 my-1.5 mx-1" />}
                {cat.items.map(({ label, href, icon }) => {
                  const active = pathname === href
                  return (
                    <Link key={href} href={href} title={label}
                      className={`flex items-center justify-center rounded-lg py-2 transition-colors ${
                        active ? 'bg-indigo-600 text-white' : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                      }`}>
                      <span>{icon}</span>
                    </Link>
                  )
                })}
              </div>
            ))
          ) : (
            // Expanded: categories with collapsible groups
            categories.map(cat => {
              const isOpen = openCategories.has(cat.label)
              const hasActive = cat.items.some(i => i.href === pathname)
              return (
                <div key={cat.label}>
                  {/* Category header */}
                  <button
                    onClick={() => toggleCategory(cat.label)}
                    className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-colors mb-0.5 ${
                      hasActive ? 'text-indigo-400' : 'text-zinc-500 hover:text-zinc-300'
                    } hover:bg-zinc-800/50`}
                  >
                    <span className="flex items-center gap-2">
                      <span>{cat.icon}</span>
                      <span>{cat.label}</span>
                    </span>
                    <span className={`text-xs transition-transform duration-150 ${isOpen ? 'rotate-90' : ''}`}>▶</span>
                  </button>

                  {/* Category items */}
                  {isOpen && (
                    <div className="flex flex-col gap-0.5 mb-2 ml-1">
                      {cat.items.map(({ label, href, icon }) => {
                        const active = pathname === href
                        return (
                          <Link key={href} href={href}
                            className={`flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                              active ? 'bg-indigo-600 text-white' : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                            }`}>
                            <span className="text-base flex-shrink-0">{icon}</span>
                            <span>{label}</span>
                          </Link>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </nav>

        {/* User + sign out */}
        <div className={`mt-4 flex flex-col gap-2 border-t border-zinc-800 pt-3 ${collapsed ? 'px-1' : 'px-2'}`}>
          {!collapsed && user && (
            <div className="flex items-center gap-2 px-1">
              {user.image ? (
                <img src={user.image} alt="" className="w-7 h-7 rounded-full flex-shrink-0" />
              ) : (
                <div className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center text-xs flex-shrink-0">
                  {user.name?.[0] ?? '?'}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-white text-xs font-medium truncate">{user.name}</p>
                <p className="text-zinc-600 text-xs truncate">{user.email}</p>
              </div>
            </div>
          )}
          {collapsed && user && (
            <div className="flex justify-center">
              {user.image ? (
                <img src={user.image} alt="" className="w-7 h-7 rounded-full" title={user.name ?? ''} />
              ) : (
                <div className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center text-xs" title={user.name ?? ''}>
                  {user.name?.[0] ?? '?'}
                </div>
              )}
            </div>
          )}
          {!collapsed && (
            <button onClick={() => signOut({ redirectTo: '/login' })}
              className="w-full text-left text-zinc-600 hover:text-rose-400 text-xs px-2 py-1 transition-colors">
              Sign out →
            </button>
          )}
          {collapsed && (
            <button onClick={() => signOut({ redirectTo: '/login' })}
              className="flex justify-center text-zinc-600 hover:text-rose-400 transition-colors py-1" title="Sign out">
              ×
            </button>
          )}
        </div>
      </aside>

      {/* ── Mobile: top bar ─────────────────────────────────── */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-zinc-900 border-b border-zinc-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">🧠</span>
          <span className="text-white font-bold text-sm tracking-tight">TheoSYN</span>
        </div>
        <button onClick={() => setMenuOpen(o => !o)}
          className="text-zinc-400 hover:text-white text-xl w-8 h-8 flex items-center justify-center">
          {menuOpen ? '✕' : '☰'}
        </button>
      </div>

      {/* ── Mobile: slide-down full menu ────────────────────── */}
      {menuOpen && (
        <div className="md:hidden fixed top-12 left-0 right-0 bottom-0 z-40 bg-zinc-950/95 backdrop-blur-sm overflow-y-auto">
          <nav className="flex flex-col gap-1 p-4 pt-2">
            {categories.map(cat => (
              <div key={cat.label}>
                <p className="text-zinc-600 text-xs font-semibold uppercase tracking-wider px-2 py-2 mt-2">{cat.label}</p>
                {cat.items.map(({ label, href, icon }) => {
                  const active = pathname === href
                  return (
                    <Link key={href} href={href} onClick={() => setMenuOpen(false)}
                      className={`flex items-center gap-4 px-4 py-3 rounded-xl text-base transition-colors ${
                        active ? 'bg-indigo-600 text-white' : 'text-zinc-300 hover:text-white hover:bg-zinc-800'
                      }`}>
                      <span className="text-xl w-8">{icon}</span>
                      {label}
                    </Link>
                  )
                })}
              </div>
            ))}
          </nav>
          <div className="p-4 border-t border-zinc-800 mx-4">
            {user && (
              <div className="flex items-center gap-3 mb-4">
                {user.image ? (
                  <img src={user.image} alt="" className="w-10 h-10 rounded-full" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center text-sm">
                    {user.name?.[0] ?? '?'}
                  </div>
                )}
                <div>
                  <p className="text-white text-sm font-medium">{user.name}</p>
                  <p className="text-zinc-500 text-xs">{user.email}</p>
                </div>
              </div>
            )}
            <button onClick={() => signOut({ redirectTo: '/login' })}
              className="text-zinc-500 hover:text-rose-400 text-sm transition-colors">
              Sign out →
            </button>
          </div>
        </div>
      )}

      {/* ── Mobile: bottom nav bar ──────────────────────────── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-zinc-900 border-t border-zinc-800 flex items-center justify-around px-2 py-1">
        {mobileNav.map(({ label, href, icon }) => {
          if (href === '#menu') {
            return (
              <button key="more" onClick={() => setMenuOpen(o => !o)}
                className={`flex flex-col items-center gap-0.5 px-3 py-2 rounded-lg transition-colors ${menuOpen ? 'text-indigo-400' : 'text-zinc-500'}`}>
                <span className="text-xl">{icon}</span>
                <span className="text-xs">{label}</span>
              </button>
            )
          }
          const active = pathname === href
          return (
            <Link key={href} href={href} onClick={() => setMenuOpen(false)}
              className={`flex flex-col items-center gap-0.5 px-3 py-2 rounded-lg transition-colors ${active ? 'text-indigo-400' : 'text-zinc-500 hover:text-white'}`}>
              <span className="text-xl">{icon}</span>
              <span className="text-xs">{label}</span>
            </Link>
          )
        })}
      </nav>
    </>
  )
}
