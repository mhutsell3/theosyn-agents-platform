'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { PURCHASE_LEVELS, LEVEL_COLOR } from '@/lib/beacon-config'

interface GHLProduct {
  _id: string
  title: string
  description?: string
}

interface Student {
  id: string
  name: string
  email: string
  phone: string | null
  purchase_level: string
  ghl_contact_id: string | null
  status: string
  welcome_sent: boolean
  notes: string | null
  enrolled_at: string
  updated_at: string
}

interface Counts {
  total: number
  active: number
  community: number
  free: number
  core: number
  premium: number
}

interface Props {
  students: Student[]
  counts: Counts
}

const emptyForm = { name: '', email: '', phone: '', purchase_level: 'Free', notes: '' }
const emptyModuleForm = { title: '', description: '' }

export default function BeaconDashboard({ students: initialStudents, counts }: Props) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'students' | 'courses'>('students')

  // Students state
  const [students, setStudents] = useState(initialStudents)
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [enrolling, setEnrolling] = useState(false)
  const [enrollResult, setEnrollResult] = useState<{ name: string; ghl: boolean; email: boolean } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<'All' | 'Community' | 'Free' | 'Core' | 'Premium'>('All')
  const [resending, setResending] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<Partial<Student>>({})

  // Courses state
  const [products, setProducts] = useState<GHLProduct[]>([])
  const [productsLoading, setProductsLoading] = useState(false)
  const [productsLoaded, setProductsLoaded] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<GHLProduct | null>(null)
  const [moduleForm, setModuleForm] = useState(emptyModuleForm)
  const [pushingModule, setPushingModule] = useState(false)
  const [moduleResult, setModuleResult] = useState<{ title: string; success: boolean; error?: string } | null>(null)

  async function loadProducts() {
    if (productsLoaded) return
    setProductsLoading(true)
    const res = await fetch('/api/beacon/courses')
    const data = await res.json()
    setProducts(data.products ?? [])
    setProductsLoading(false)
    setProductsLoaded(true)
  }

  async function pushModule() {
    if (!selectedProduct || !moduleForm.title) return
    setPushingModule(true)
    setModuleResult(null)
    const res = await fetch(`/api/beacon/courses/${selectedProduct._id}/modules`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(moduleForm),
    })
    const data = await res.json()
    if (res.ok) {
      setModuleResult({ title: moduleForm.title, success: true })
      setModuleForm(emptyModuleForm)
    } else {
      setModuleResult({ title: moduleForm.title, success: false, error: data.error ?? 'Push failed' })
    }
    setPushingModule(false)
  }

  const filtered = filter === 'All' ? students.filter(s => s.status === 'active') : students.filter(s => s.purchase_level === filter && s.status === 'active')
  const inactive = students.filter(s => s.status === 'inactive')

  async function enroll() {
    if (!form.name || !form.email) { setError('Name and email are required'); return }
    setEnrolling(true)
    setError(null)
    const res = await fetch('/api/beacon/students', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error ?? 'Enrollment failed'); setEnrolling(false); return }

    setEnrollResult({ name: form.name, ghl: !!data.ghlContactId, email: data.welcomeSent })
    setForm(emptyForm)
    setShowAdd(false)
    setEnrolling(false)
    router.refresh()
    // Optimistically add to list
    setStudents(prev => [data.student, ...prev])
  }

  async function resendWelcome(student: Student) {
    setResending(student.id)
    await fetch('/api/beacon/welcome', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId: student.id }),
    })
    setResending(null)
  }

  async function deactivate(id: string) {
    if (!confirm('Deactivate this student?')) return
    await fetch(`/api/beacon/students/${id}`, { method: 'DELETE' })
    setStudents(prev => prev.map(s => s.id === id ? { ...s, status: 'inactive' } : s))
  }

  async function hardDelete(id: string, name: string) {
    if (!confirm(`Permanently delete ${name}? This cannot be undone.`)) return
    await fetch(`/api/beacon/students/${id}?hard=true`, { method: 'DELETE' })
    setStudents(prev => prev.filter(s => s.id !== id))
  }

  async function saveEdit(id: string) {
    const res = await fetch(`/api/beacon/students/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editForm),
    })
    const data = await res.json()
    if (res.ok) {
      setStudents(prev => prev.map(s => s.id === id ? { ...s, ...data.student } : s))
      setEditingId(null)
      setEditForm({})
    }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="text-3xl">🎓</span>
          <div>
            <h1 className="text-2xl font-bold text-white">Beacon</h1>
            <p className="text-zinc-500 text-sm">Community & Course Agent — student roster, enrollment, onboarding</p>
          </div>
        </div>
        {activeTab === 'students' && (
          <button
            onClick={() => { setShowAdd(true); setEnrollResult(null); setError(null) }}
            className="flex-shrink-0 bg-indigo-700 hover:bg-indigo-600 text-white text-sm px-4 py-2 rounded-lg transition-colors"
          >
            + Enroll Student
          </button>
        )}
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-zinc-900 border border-zinc-800 rounded-xl p-1 w-fit">
        <button
          onClick={() => setActiveTab('students')}
          className={`px-4 py-1.5 rounded-lg text-sm transition-colors ${activeTab === 'students' ? 'bg-indigo-700 text-white' : 'text-zinc-400 hover:text-white'}`}
        >
          Students
        </button>
        <button
          onClick={() => { setActiveTab('courses'); loadProducts() }}
          className={`px-4 py-1.5 rounded-lg text-sm transition-colors ${activeTab === 'courses' ? 'bg-indigo-700 text-white' : 'text-zinc-400 hover:text-white'}`}
        >
          Courses
        </button>
      </div>

      {activeTab === 'courses' && (
        <div className="flex flex-col gap-4">
          {/* Product selector */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 flex flex-col gap-4">
            <h2 className="text-white font-semibold text-sm">Select a Course (Product)</h2>
            {productsLoading && <p className="text-zinc-500 text-sm">Loading products from GHL...</p>}
            {!productsLoading && productsLoaded && products.length === 0 && (
              <p className="text-zinc-500 text-sm">No products found in GHL. Make sure your membership products are created in GHL first.</p>
            )}
            {products.length > 0 && (
              <div className="flex flex-col gap-2">
                {products.map(p => (
                  <button
                    key={p._id}
                    onClick={() => { setSelectedProduct(p); setModuleResult(null) }}
                    className={`text-left px-4 py-3 rounded-lg border transition-colors ${selectedProduct?._id === p._id ? 'border-indigo-500 bg-indigo-950 text-white' : 'border-zinc-700 bg-zinc-800 text-zinc-300 hover:border-zinc-600'}`}
                  >
                    <p className="text-sm font-medium">{p.title}</p>
                    {p.description && <p className="text-xs text-zinc-500 mt-0.5 line-clamp-1">{p.description}</p>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Add module form */}
          {selectedProduct && (
            <div className="bg-zinc-900 border border-indigo-800 rounded-xl p-5 flex flex-col gap-4">
              <div>
                <h2 className="text-white font-semibold text-sm">Add Module to: <span className="text-indigo-400">{selectedProduct.title}</span></h2>
                <p className="text-zinc-600 text-xs mt-0.5">This will create a new sub-category (module) inside this course in GHL.</p>
              </div>

              {moduleResult && (
                <div className={`px-4 py-2 rounded-lg text-sm ${moduleResult.success ? 'bg-emerald-950 border border-emerald-700 text-emerald-300' : 'bg-red-950 border border-red-700 text-red-400'}`}>
                  {moduleResult.success
                    ? `✓ Module "${moduleResult.title}" created in GHL`
                    : `✗ Failed: ${moduleResult.error}`}
                </div>
              )}

              <div className="flex flex-col gap-3">
                <div>
                  <label className="text-zinc-400 text-xs mb-1 block">Module Title *</label>
                  <input
                    value={moduleForm.title}
                    onChange={e => setModuleForm(f => ({ ...f, title: e.target.value }))}
                    placeholder="e.g. Module 1: Introduction to AI Agents"
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-zinc-400 text-xs mb-1 block">Description</label>
                  <textarea
                    value={moduleForm.description}
                    onChange={e => setModuleForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="Brief overview of what this module covers..."
                    rows={3}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 resize-none"
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => { setSelectedProduct(null); setModuleForm(emptyModuleForm); setModuleResult(null) }}
                  className="text-zinc-400 text-sm px-4 py-2 border border-zinc-700 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={pushModule}
                  disabled={pushingModule || !moduleForm.title}
                  className="bg-indigo-700 hover:bg-indigo-600 disabled:opacity-50 text-white text-sm px-4 py-2 rounded-lg transition-colors"
                >
                  {pushingModule ? '⏳ Pushing...' : '📤 Push Module to GHL'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'students' && <>

      {/* Enroll result */}
      {enrollResult && (
        <div className="bg-emerald-950 border border-emerald-700 rounded-xl px-5 py-3 flex flex-col gap-1">
          <p className="text-emerald-300 text-sm font-semibold">✓ {enrollResult.name} enrolled</p>
          <p className="text-emerald-600 text-xs">
            GHL contact: {enrollResult.ghl ? 'Created ✓' : 'Failed ✗'} &nbsp;·&nbsp;
            Welcome email: {enrollResult.email ? 'Sent ✓' : 'Not sent'}
          </p>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
        {[
          { label: 'Total',     value: counts.total,     color: 'text-white' },
          { label: 'Active',    value: counts.active,    color: 'text-emerald-400' },
          { label: 'Community', value: counts.community, color: 'text-yellow-400' },
          { label: 'Free',      value: counts.free,      color: 'text-zinc-400' },
          { label: 'Core',      value: counts.core,      color: 'text-blue-400' },
          { label: 'Premium',   value: counts.premium,   color: 'text-amber-400' },
        ].map(stat => (
          <div key={stat.label} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-center">
            <p className={`text-2xl font-bold font-mono ${stat.color}`}>{stat.value}</p>
            <p className="text-zinc-500 text-xs mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Enroll form */}
      {showAdd && (
        <div className="bg-zinc-900 border border-indigo-700 rounded-xl p-5 flex flex-col gap-4">
          <h2 className="text-white font-semibold">Enroll New Student</h2>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-zinc-400 text-xs mb-1 block">Full Name *</label>
              <input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Jane Smith"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="text-zinc-400 text-xs mb-1 block">Email *</label>
              <input
                type="email"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="jane@example.com"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="text-zinc-400 text-xs mb-1 block">Phone</label>
              <input
                value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                placeholder="+1 555 000 0000"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="text-zinc-400 text-xs mb-1 block">Purchase Level *</label>
              <select
                value={form.purchase_level}
                onChange={e => setForm(f => ({ ...f, purchase_level: e.target.value }))}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
              >
                {PURCHASE_LEVELS.map(l => <option key={l}>{l}</option>)}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="text-zinc-400 text-xs mb-1 block">Notes</label>
              <textarea
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Optional notes about this student..."
                rows={2}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 resize-none"
              />
            </div>
          </div>
          <p className="text-zinc-600 text-xs">Beacon will automatically create a GHL contact and send a welcome email.</p>
          <div className="flex gap-2">
            <button onClick={() => { setShowAdd(false); setError(null) }} className="text-zinc-400 text-sm px-4 py-2 border border-zinc-700 rounded-lg">Cancel</button>
            <button onClick={enroll} disabled={enrolling} className="bg-indigo-700 hover:bg-indigo-600 disabled:opacity-50 text-white text-sm px-4 py-2 rounded-lg transition-colors">
              {enrolling ? '⏳ Enrolling...' : '🎓 Enroll & Send Welcome'}
            </button>
          </div>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-1 bg-zinc-900 border border-zinc-800 rounded-xl p-1 w-fit">
        {(['All', 'Community', 'Free', 'Core', 'Premium'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-lg text-sm transition-colors ${filter === f ? 'bg-indigo-700 text-white' : 'text-zinc-400 hover:text-white'}`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Student roster */}
      {filtered.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-center">
          <p className="text-zinc-500 text-sm">No students yet. Enroll your first student above.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map(student => (
            <div key={student.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
              {editingId === student.id ? (
                // Edit mode
                <div className="flex flex-col gap-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <input
                      defaultValue={student.name}
                      onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                      className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                      placeholder="Name"
                    />
                    <input
                      defaultValue={student.phone ?? ''}
                      onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))}
                      className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                      placeholder="Phone"
                    />
                    <select
                      defaultValue={student.purchase_level}
                      onChange={e => setEditForm(f => ({ ...f, purchase_level: e.target.value }))}
                      className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                    >
                      {PURCHASE_LEVELS.map(l => <option key={l}>{l}</option>)}
                    </select>
                    <textarea
                      defaultValue={student.notes ?? ''}
                      onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))}
                      className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 resize-none"
                      placeholder="Notes"
                      rows={2}
                    />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => { setEditingId(null); setEditForm({}) }} className="text-zinc-400 text-xs px-3 py-1.5 border border-zinc-700 rounded-lg">Cancel</button>
                    <button onClick={() => saveEdit(student.id)} className="bg-indigo-700 hover:bg-indigo-600 text-white text-xs px-3 py-1.5 rounded-lg">Save</button>
                  </div>
                </div>
              ) : (
                // View mode
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-white font-semibold text-sm">{student.name}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${LEVEL_COLOR[student.purchase_level] ?? 'text-zinc-400 bg-zinc-800'}`}>
                        {student.purchase_level}
                      </span>
                      {student.welcome_sent
                        ? <span className="text-emerald-600 text-xs">✓ Welcome sent</span>
                        : <span className="text-amber-600 text-xs">⚠ No welcome sent</span>
                      }
                      {student.ghl_contact_id
                        ? <span className="text-zinc-600 text-xs">GHL ✓</span>
                        : <span className="text-red-700 text-xs">GHL ✗</span>
                      }
                    </div>
                    <p className="text-zinc-500 text-xs mt-0.5">{student.email}{student.phone ? ` · ${student.phone}` : ''}</p>
                    {student.notes && <p className="text-zinc-600 text-xs mt-1">{student.notes}</p>}
                    <p className="text-zinc-700 text-xs mt-1">
                      Enrolled {new Date(student.enrolled_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                  </div>
                  <div className="flex gap-2 flex-shrink-0 flex-wrap justify-end">
                    <button
                      onClick={() => { setEditingId(student.id); setEditForm({}) }}
                      className="text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-2 py-1.5 rounded-lg transition-colors"
                    >
                      Edit
                    </button>
                    {!student.welcome_sent && (
                      <button
                        onClick={() => resendWelcome(student)}
                        disabled={resending === student.id}
                        className="text-xs bg-indigo-800 hover:bg-indigo-700 disabled:opacity-50 text-white px-2 py-1.5 rounded-lg transition-colors"
                      >
                        {resending === student.id ? '...' : '✉️ Welcome'}
                      </button>
                    )}
                    <button
                      onClick={() => deactivate(student.id)}
                      className="text-xs text-zinc-600 hover:text-red-400 px-2 py-1.5 rounded-lg transition-colors"
                    >
                      Deactivate
                    </button>
                    <button
                      onClick={() => hardDelete(student.id, student.name)}
                      className="text-xs text-zinc-700 hover:text-red-600 px-2 py-1.5 rounded-lg transition-colors"
                    >
                      🗑
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Inactive students */}
      {inactive.length > 0 && (
        <details className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <summary className="text-zinc-500 text-xs cursor-pointer select-none">
            {inactive.length} inactive student{inactive.length !== 1 ? 's' : ''}
          </summary>
          <div className="flex flex-col gap-2 mt-3">
            {inactive.map(student => (
              <div key={student.id} className="flex items-center justify-between py-2 border-t border-zinc-800">
                <div>
                  <p className="text-zinc-500 text-sm">{student.name}</p>
                  <p className="text-zinc-700 text-xs">{student.email}</p>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={async () => {
                      await fetch(`/api/beacon/students/${student.id}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ status: 'active' }),
                      })
                      setStudents(prev => prev.map(s => s.id === student.id ? { ...s, status: 'active' } : s))
                    }}
                    className="text-xs text-zinc-500 hover:text-emerald-400 transition-colors"
                  >
                    Reactivate
                  </button>
                  <button
                    onClick={() => hardDelete(student.id, student.name)}
                    className="text-xs text-zinc-600 hover:text-red-500 transition-colors"
                  >
                    🗑 Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </details>
      )}

      </> }
    </div>
  )
}
