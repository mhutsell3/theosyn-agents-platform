'use client'

import { useState, useEffect, useCallback } from 'react'
import type { ShopifyProduct, ShopifyCustomer, ShopifyOrder, ProductMargin } from '@/lib/forge'

type Tab = 'products' | 'customers' | 'orders' | 'margins'

const FULFILLMENT_COLOR: Record<string, string> = {
  fulfilled:   'bg-emerald-950 text-emerald-400',
  partial:     'bg-amber-950 text-amber-400',
  unfulfilled: 'bg-red-950 text-red-400',
  null:        'bg-zinc-800 text-zinc-400',
}

const FINANCIAL_COLOR: Record<string, string> = {
  paid:           'bg-emerald-950 text-emerald-400',
  pending:        'bg-amber-950 text-amber-400',
  refunded:       'bg-red-950 text-red-400',
  partially_paid: 'bg-blue-950 text-blue-400',
}

const STATUS_COLOR: Record<string, string> = {
  active:   'bg-emerald-950 text-emerald-400',
  draft:    'bg-zinc-800 text-zinc-400',
  archived: 'bg-red-950 text-red-400',
}

interface Stats {
  totalRevenue: number
  totalOrders: number
  totalCustomers: number
  totalProducts: number
  unfulfilled: number
  avgOrderValue: number
}

export default function ForgePanel() {
  const [tab, setTab] = useState<Tab>('products')
  const [stats, setStats] = useState<Stats | null>(null)
  const [products, setProducts] = useState<ShopifyProduct[]>([])
  const [customers, setCustomers] = useState<ShopifyCustomer[]>([])
  const [orders, setOrders] = useState<ShopifyOrder[]>([])
  const [loading, setLoading] = useState(false)
  const [statsLoading, setStatsLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [orderStatus, setOrderStatus] = useState('any')
  const [selectedCustomer, setSelectedCustomer] = useState<ShopifyCustomer | null>(null)
  const [customerOrders, setCustomerOrders] = useState<ShopifyOrder[]>([])
  const [editingProduct, setEditingProduct] = useState<string | null>(null)
  const [editPrice, setEditPrice] = useState('')
  const [editInventory, setEditInventory] = useState('')
  const [saving, setSaving] = useState(false)
  const [tagInput, setTagInput] = useState('')
  const [fulfillModal, setFulfillModal] = useState<ShopifyOrder | null>(null)
  const [trackingNum, setTrackingNum] = useState('')
  const [trackingCo, setTrackingCo] = useState('')
  const [fulfilling, setFulfilling] = useState(false)
  const [collections, setCollections] = useState<{ id: string; title: string; type: string }[]>([])
  const [selectedCollection, setSelectedCollection] = useState<string>('')
  // Margins tab
  const [margins, setMargins] = useState<ProductMargin[]>([])
  const [marginsLoading, setMarginsLoading] = useState(false)
  const [marginsAnalyzing, setMarginsAnalyzing] = useState(false)
  const [marginRecommendations, setMarginRecommendations] = useState<string>('')
  const [marginFilter, setMarginFilter] = useState<'all' | 'below40' | 'nocost'>('all')

  // Load stats + collections on mount
  useEffect(() => {
    fetch('/api/forge/stats')
      .then(r => r.json())
      .then(d => { if (!d.error) setStats(d) })
      .finally(() => setStatsLoading(false))
    fetch('/api/forge/collections')
      .then(r => r.json())
      .then(d => setCollections(d.collections ?? []))
  }, [])

  const loadProducts = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (selectedCollection) params.set('collection_id', selectedCollection)
    const res = await fetch(`/api/forge/products?${params}`)
    const data = await res.json()
    setProducts(data.products ?? [])
    setLoading(false)
  }, [selectedCollection])

  const loadCustomers = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (search) params.set('q', search)
    const res = await fetch(`/api/forge/customers?${params}`)
    const data = await res.json()
    setCustomers(data.customers ?? [])
    setLoading(false)
  }, [search])

  const loadOrders = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ status: orderStatus })
    if (search) params.set('q', search)
    const res = await fetch(`/api/forge/orders?${params}`)
    const data = await res.json()
    setOrders(data.orders ?? [])
    setLoading(false)
  }, [search, orderStatus])

  const loadMargins = useCallback(async () => {
    setMarginsLoading(true)
    setMarginRecommendations('')
    const res = await fetch('/api/forge/margins')
    const data = await res.json()
    setMargins(data.margins ?? [])
    setMarginsLoading(false)
  }, [])

  async function analyzeMargins() {
    setMarginsAnalyzing(true)
    const res = await fetch('/api/forge/margins', { method: 'POST' })
    const data = await res.json()
    if (data.margins) setMargins(data.margins)
    if (data.recommendations) setMarginRecommendations(data.recommendations)
    setMarginsAnalyzing(false)
  }

  useEffect(() => {
    if (tab === 'products') loadProducts()
    else if (tab === 'customers') loadCustomers()
    else if (tab === 'orders') loadOrders()
    else if (tab === 'margins' && margins.length === 0) loadMargins()
  }, [tab, loadProducts, loadCustomers, loadOrders, loadMargins, margins.length])

  async function saveProductEdit(product: ShopifyProduct) {
    setSaving(true)
    const variant = product.variants[0]
    if (editPrice) {
      await fetch('/api/forge/products', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'variant', id: variant.id, updates: { price: editPrice } }),
      })
    }
    if (editInventory) {
      await fetch('/api/forge/products', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'variant', id: variant.id, updates: { inventory_quantity: parseInt(editInventory) } }),
      })
    }
    setSaving(false)
    setEditingProduct(null)
    loadProducts()
  }

  async function toggleProductStatus(product: ShopifyProduct) {
    const newStatus = product.status === 'active' ? 'draft' : 'active'
    await fetch('/api/forge/products', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'product', id: product.id, updates: { status: newStatus } }),
    })
    loadProducts()
  }

  async function viewCustomer(customer: ShopifyCustomer) {
    setSelectedCustomer(customer)
    setTagInput(customer.tags)
    const res = await fetch(`/api/forge/customers?id=${customer.id}&orders=1`)
    const data = await res.json()
    setCustomerOrders(data.orders ?? [])
  }

  async function saveTags() {
    if (!selectedCustomer) return
    setSaving(true)
    await fetch('/api/forge/customers', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: selectedCustomer.id, tags: tagInput }),
    })
    setSaving(false)
    setSelectedCustomer(prev => prev ? { ...prev, tags: tagInput } : null)
    loadCustomers()
  }

  async function fulfillOrder() {
    if (!fulfillModal) return
    setFulfilling(true)
    await fetch('/api/forge/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId: fulfillModal.id, trackingNumber: trackingNum, trackingCompany: trackingCo }),
    })
    setFulfilling(false)
    setFulfillModal(null)
    setTrackingNum('')
    setTrackingCo('')
    loadOrders()
  }

  return (
    <div className="p-6 flex flex-col gap-6 max-w-6xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">🛒 Forge <span className="text-zinc-500 font-normal text-base">Shopify Store Manager</span></h1>
        <p className="text-zinc-500 text-sm mt-1">Blessed Bling Co / Backroad Syndicate · Products · Customers · Orders</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
        {statsLoading ? (
          Array(6).fill(0).map((_, i) => <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 animate-pulse h-20" />)
        ) : stats ? [
          { label: 'Revenue',       value: `$${stats.totalRevenue.toLocaleString('en-US', { maximumFractionDigits: 0 })}`, color: 'text-emerald-400' },
          { label: 'Orders',        value: stats.totalOrders,        color: 'text-white' },
          { label: 'Avg Order',     value: `$${stats.avgOrderValue.toFixed(2)}`, color: 'text-blue-400' },
          { label: 'Customers',     value: stats.totalCustomers,     color: 'text-purple-400' },
          { label: 'Products',      value: stats.totalProducts,      color: 'text-white' },
          { label: 'Unfulfilled',   value: stats.unfulfilled,        color: stats.unfulfilled > 0 ? 'text-red-400' : 'text-zinc-500' },
        ].map(s => (
          <div key={s.label} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <p className="text-zinc-500 text-xs mb-1">{s.label}</p>
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        )) : null}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-zinc-800">
        {([
          { key: 'products',  label: '📦 Products',  count: products.length },
          { key: 'customers', label: '👥 Customers', count: customers.length },
          { key: 'orders',    label: '🧾 Orders',    count: orders.length },
          { key: 'margins',   label: '📊 Margins',   count: margins.filter(m => m.below40).length, countColor: 'text-red-400' },
        ] as { key: Tab; label: string; count: number; countColor?: string }[]).map(t => (
          <button key={t.key} onClick={() => { setTab(t.key); setSearch('') }}
            className={`px-4 py-2 text-sm font-medium transition-colors ${tab === t.key ? 'text-white border-b-2 border-indigo-500 -mb-px' : 'text-zinc-500 hover:text-zinc-300'}`}>
            {t.label} {t.count > 0 && <span className={`text-xs ml-1 ${t.countColor ?? 'text-zinc-600'}`}>({t.count})</span>}
          </button>
        ))}
      </div>

      {/* Search + filters */}
      <div className="flex gap-3 items-center flex-wrap">
        {tab === 'products' && collections.length > 0 && (
          <select
            value={selectedCollection}
            onChange={e => setSelectedCollection(e.target.value)}
            className="bg-zinc-800 border border-zinc-700 text-zinc-200 text-sm rounded-lg px-3 py-2 min-w-[200px]"
          >
            <option value="">All Products</option>
            {collections.map(c => (
              <option key={c.id} value={c.id}>{c.title}</option>
            ))}
          </select>
        )}
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && (tab === 'customers' ? loadCustomers() : loadOrders())}
          placeholder={tab === 'products' ? 'Filter products...' : tab === 'customers' ? 'Search customers...' : 'Search orders...'}
          className="flex-1 bg-zinc-800 border border-zinc-700 text-white text-sm rounded-lg px-3 py-2 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500 min-w-[200px]"
        />
        {tab === 'orders' && (
          <select value={orderStatus} onChange={e => setOrderStatus(e.target.value)}
            className="bg-zinc-800 border border-zinc-700 text-zinc-200 text-sm rounded-lg px-3 py-2">
            <option value="any">All Orders</option>
            <option value="open">Open</option>
            <option value="closed">Closed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        )}
        <button onClick={() => tab === 'products' ? loadProducts() : tab === 'customers' ? loadCustomers() : loadOrders()}
          className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm px-4 py-2 rounded-lg transition-colors">
          Refresh
        </button>
      </div>

      {/* Products Tab */}
      {tab === 'products' && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          {loading ? (
            <p className="text-zinc-500 text-sm p-6 text-center">Loading products...</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-zinc-500 text-xs uppercase tracking-wide border-b border-zinc-800">
                    <th className="text-left px-4 py-3">Product</th>
                    <th className="text-left px-4 py-3">Supplier</th>
                    <th className="text-left px-4 py-3">Status</th>
                    <th className="text-right px-4 py-3">Price</th>
                    <th className="text-right px-4 py-3">Inventory</th>
                    <th className="text-right px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {products
                    .filter(p => !search || p.title.toLowerCase().includes(search.toLowerCase()))
                    .map(p => {
                      const variant = p.variants[0]
                      const isEditing = editingProduct === p.id
                      return (
                        <tr key={p.id} className="hover:bg-zinc-800/50">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              {p.images[0] && <img src={p.images[0].src} alt={p.title} className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />}
                              <div>
                                <p className="text-white font-medium text-sm">{p.title}</p>
                                <p className="text-zinc-500 text-xs">{p.product_type || p.vendor}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-zinc-400 text-xs">{p.vendor || '—'}</td>
                          <td className="px-4 py-3">
                            <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLOR[p.status]}`}>{p.status}</span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            {isEditing ? (
                              <input type="number" value={editPrice} onChange={e => setEditPrice(e.target.value)}
                                placeholder={variant?.price}
                                className="w-24 bg-zinc-700 border border-zinc-600 text-white text-xs rounded px-2 py-1 text-right" />
                            ) : (
                              <span className="text-emerald-400 font-medium">${variant?.price}</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {isEditing ? (
                              <input type="number" value={editInventory} onChange={e => setEditInventory(e.target.value)}
                                placeholder={String(variant?.inventory_quantity ?? 0)}
                                className="w-20 bg-zinc-700 border border-zinc-600 text-white text-xs rounded px-2 py-1 text-right" />
                            ) : (
                              <span className={`font-medium ${(variant?.inventory_quantity ?? 0) < 5 ? 'text-red-400' : (variant?.inventory_quantity ?? 0) < 20 ? 'text-amber-400' : 'text-zinc-300'}`}>
                                {variant?.inventory_quantity ?? '—'}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {isEditing ? (
                                <>
                                  <button onClick={() => saveProductEdit(p)} disabled={saving}
                                    className="text-xs bg-emerald-700 hover:bg-emerald-600 text-white px-2 py-1 rounded disabled:opacity-50">
                                    {saving ? '...' : 'Save'}
                                  </button>
                                  <button onClick={() => setEditingProduct(null)}
                                    className="text-xs bg-zinc-700 hover:bg-zinc-600 text-white px-2 py-1 rounded">
                                    Cancel
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button onClick={() => { setEditingProduct(p.id); setEditPrice(''); setEditInventory('') }}
                                    className="text-xs border border-zinc-700 hover:border-zinc-500 text-zinc-400 hover:text-white px-2 py-1 rounded transition-colors">
                                    Edit
                                  </button>
                                  <button onClick={() => toggleProductStatus(p)}
                                    className={`text-xs px-2 py-1 rounded transition-colors ${p.status === 'active' ? 'border border-zinc-700 text-zinc-400 hover:text-red-400' : 'border border-emerald-800 text-emerald-400 hover:bg-emerald-950'}`}>
                                    {p.status === 'active' ? 'Deactivate' : 'Activate'}
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Customers Tab */}
      {tab === 'customers' && (
        <div className="flex gap-4">
          <div className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
            {loading ? (
              <p className="text-zinc-500 text-sm p-6 text-center">Loading customers...</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-zinc-500 text-xs uppercase tracking-wide border-b border-zinc-800">
                      <th className="text-left px-4 py-3">Customer</th>
                      <th className="text-right px-4 py-3">Orders</th>
                      <th className="text-right px-4 py-3">Total Spent</th>
                      <th className="text-left px-4 py-3">Tags</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {customers.map(c => (
                      <tr key={c.id} onClick={() => viewCustomer(c)}
                        className={`cursor-pointer hover:bg-zinc-800/50 transition-colors ${selectedCustomer?.id === c.id ? 'bg-indigo-950/30' : ''}`}>
                        <td className="px-4 py-3">
                          <p className="text-white font-medium">{c.first_name} {c.last_name}</p>
                          <p className="text-zinc-500 text-xs">{c.email}</p>
                        </td>
                        <td className="px-4 py-3 text-right text-zinc-300">{c.orders_count}</td>
                        <td className="px-4 py-3 text-right text-emerald-400 font-medium">${parseFloat(c.total_spent).toFixed(2)}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {c.tags?.split(',').filter(Boolean).map(tag => (
                              <span key={tag} className="text-xs bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded-full">{tag.trim()}</span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Customer Detail Panel */}
          {selectedCustomer && (
            <div className="w-80 flex-shrink-0 bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex flex-col gap-4">
              <div>
                <p className="text-white font-bold">{selectedCustomer.first_name} {selectedCustomer.last_name}</p>
                <p className="text-zinc-500 text-xs">{selectedCustomer.email}</p>
                {selectedCustomer.phone && <p className="text-zinc-500 text-xs">{selectedCustomer.phone}</p>}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-zinc-800 rounded-lg p-2 text-center">
                  <p className="text-zinc-500 text-xs">Orders</p>
                  <p className="text-white font-bold">{selectedCustomer.orders_count}</p>
                </div>
                <div className="bg-zinc-800 rounded-lg p-2 text-center">
                  <p className="text-zinc-500 text-xs">Total Spent</p>
                  <p className="text-emerald-400 font-bold">${parseFloat(selectedCustomer.total_spent).toFixed(2)}</p>
                </div>
              </div>

              {/* Tags editor */}
              <div>
                <p className="text-zinc-500 text-xs font-semibold uppercase tracking-wider mb-2">Tags</p>
                <textarea
                  value={tagInput}
                  onChange={e => setTagInput(e.target.value)}
                  rows={2}
                  className="w-full bg-zinc-800 border border-zinc-700 text-white text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-indigo-500 resize-none"
                  placeholder="tag1, tag2, tag3"
                />
                <button onClick={saveTags} disabled={saving}
                  className="w-full mt-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs py-1.5 rounded-lg transition-colors">
                  {saving ? 'Saving...' : 'Save Tags'}
                </button>
              </div>

              {/* Recent orders */}
              <div>
                <p className="text-zinc-500 text-xs font-semibold uppercase tracking-wider mb-2">Recent Orders</p>
                <div className="flex flex-col gap-2">
                  {customerOrders.slice(0, 5).map(o => (
                    <div key={o.id} className="bg-zinc-800 rounded-lg p-2">
                      <div className="flex items-center justify-between">
                        <p className="text-white text-xs font-medium">{o.name}</p>
                        <p className="text-emerald-400 text-xs">${parseFloat(o.total_price).toFixed(2)}</p>
                      </div>
                      <p className="text-zinc-500 text-xs">{new Date(o.created_at).toLocaleDateString()}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Orders Tab */}
      {tab === 'orders' && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          {loading ? (
            <p className="text-zinc-500 text-sm p-6 text-center">Loading orders...</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-zinc-500 text-xs uppercase tracking-wide border-b border-zinc-800">
                    <th className="text-left px-4 py-3">Order</th>
                    <th className="text-left px-4 py-3">Customer</th>
                    <th className="text-left px-4 py-3">Items</th>
                    <th className="text-right px-4 py-3">Total</th>
                    <th className="text-left px-4 py-3">Payment</th>
                    <th className="text-left px-4 py-3">Fulfillment</th>
                    <th className="text-left px-4 py-3">Date</th>
                    <th className="text-right px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {orders.map(o => (
                    <tr key={o.id} className="hover:bg-zinc-800/50">
                      <td className="px-4 py-3 text-white font-medium">{o.name}</td>
                      <td className="px-4 py-3">
                        <p className="text-zinc-300 text-xs">{o.customer ? `${o.customer.first_name} ${o.customer.last_name}` : o.email}</p>
                      </td>
                      <td className="px-4 py-3 text-zinc-500 text-xs max-w-[150px] truncate">
                        {o.line_items?.map(i => i.title).join(', ')}
                      </td>
                      <td className="px-4 py-3 text-right text-emerald-400 font-medium">${parseFloat(o.total_price).toFixed(2)}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${FINANCIAL_COLOR[o.financial_status] ?? 'bg-zinc-800 text-zinc-400'}`}>
                          {o.financial_status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${FULFILLMENT_COLOR[o.fulfillment_status ?? 'null']}`}>
                          {o.fulfillment_status ?? 'unfulfilled'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-zinc-500 text-xs">{new Date(o.created_at).toLocaleDateString()}</td>
                      <td className="px-4 py-3 text-right">
                        {(!o.fulfillment_status || o.fulfillment_status === 'partial') && o.financial_status === 'paid' && (
                          <button onClick={() => setFulfillModal(o)}
                            className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-2 py-1 rounded transition-colors">
                            Fulfill
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Margins Tab */}
      {tab === 'margins' && (
        <div className="flex flex-col gap-4">
          {/* Summary cards */}
          {margins.length > 0 && (() => {
            const withCost = margins.filter(m => m.margin !== null)
            const below40 = margins.filter(m => m.below40)
            const noCost = margins.filter(m => m.cost === null)
            const avgMargin = withCost.length > 0
              ? withCost.reduce((s, m) => s + (m.margin ?? 0), 0) / withCost.length
              : null
            return (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: 'Total Products', value: margins.length, color: 'text-white' },
                  { label: 'Avg Margin', value: avgMargin !== null ? `${avgMargin.toFixed(1)}%` : '—', color: avgMargin !== null && avgMargin >= 40 ? 'text-emerald-400' : 'text-amber-400' },
                  { label: 'Below 40%', value: below40.length, color: below40.length > 0 ? 'text-red-400' : 'text-zinc-500' },
                  { label: 'No Cost Set', value: noCost.length, color: noCost.length > 0 ? 'text-amber-400' : 'text-zinc-500' },
                ].map(s => (
                  <div key={s.label} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                    <p className="text-zinc-500 text-xs mb-1">{s.label}</p>
                    <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                  </div>
                ))}
              </div>
            )
          })()}

          {/* Controls */}
          <div className="flex gap-2 items-center flex-wrap">
            {(['all', 'below40'] as const).map(f => (
              <button key={f} onClick={() => setMarginFilter(f)}
                className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${marginFilter === f ? 'bg-indigo-600 border-indigo-500 text-white' : 'border-zinc-700 text-zinc-400 hover:text-white'}`}>
                {f === 'all' ? 'All Products' : '⚠ Below 40%'}
              </button>
            ))}
            <div className="flex-1" />
            <button onClick={loadMargins} disabled={marginsLoading}
              className="text-xs border border-zinc-700 text-zinc-400 hover:text-white px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50">
              {marginsLoading ? 'Loading...' : '↺ Refresh'}
            </button>
            <button onClick={analyzeMargins} disabled={marginsAnalyzing || marginsLoading}
              className="text-xs bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-4 py-1.5 rounded-lg transition-colors flex items-center gap-1">
              {marginsAnalyzing ? '⏳ Analyzing...' : '🤖 Analyze & Recommend'}
            </button>
          </div>

          {/* AI Recommendations */}
          {marginRecommendations && (
            <div className="bg-indigo-950/30 border border-indigo-800/50 rounded-xl p-4">
              <p className="text-indigo-300 text-xs font-semibold uppercase tracking-wider mb-2">🤖 Forge Recommendations</p>
              <div className="text-zinc-300 text-sm whitespace-pre-wrap leading-relaxed">{marginRecommendations}</div>
            </div>
          )}

          {/* Products table */}
          {marginsLoading ? (
            <p className="text-zinc-500 text-sm text-center py-8">Loading product margins from Shopify… this may take a moment.</p>
          ) : (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-zinc-500 text-xs uppercase tracking-wide border-b border-zinc-800">
                      <th className="text-left px-4 py-3">Product</th>
                      <th className="text-right px-4 py-3">Sell Price</th>
                      <th className="text-right px-4 py-3">Cost</th>
                      <th className="text-right px-4 py-3">Profit</th>
                      <th className="text-right px-4 py-3">Margin</th>
                      <th className="text-left px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {margins
                      .filter(m => {
                        if (m.cost === null) return false  // exclude zero/unset cost products
                        if (marginFilter === 'below40') return m.below40
                        return true
                      })
                      .map((m, i) => {
                        const marginColor =
                          m.margin === null ? 'text-zinc-500' :
                          m.margin < 20 ? 'text-red-400' :
                          m.margin < 40 ? 'text-amber-400' :
                          m.margin < 55 ? 'text-emerald-400' :
                          'text-emerald-300'
                        const rowBg = m.below40 ? 'bg-red-950/10' : m.cost === null ? 'bg-amber-950/10' : ''
                        return (
                          <tr key={`${m.variantId}-${i}`} className={`hover:bg-zinc-800/50 ${rowBg}`}>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                {m.imageUrl && <img src={m.imageUrl} alt={m.title} className="w-9 h-9 rounded-lg object-cover flex-shrink-0" />}
                                <div>
                                  <p className="text-white font-medium text-sm leading-snug">{m.title}</p>
                                  {m.variantTitle && <p className="text-zinc-500 text-xs">{m.variantTitle}</p>}
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right text-zinc-200 font-medium">${m.price.toFixed(2)}</td>
                            <td className="px-4 py-3 text-right">
                              {m.cost !== null
                                ? <span className="text-zinc-400">${m.cost.toFixed(2)}</span>
                                : <span className="text-amber-500 text-xs">Not set</span>}
                            </td>
                            <td className="px-4 py-3 text-right">
                              {m.profit !== null
                                ? <span className={m.profit < 0 ? 'text-red-400' : 'text-zinc-300'}>${m.profit.toFixed(2)}</span>
                                : <span className="text-zinc-600">—</span>}
                            </td>
                            <td className="px-4 py-3 text-right">
                              {m.margin !== null ? (
                                <div className="flex items-center justify-end gap-2">
                                  <div className="w-16 bg-zinc-800 rounded-full h-1.5">
                                    <div
                                      className={`h-1.5 rounded-full ${m.margin < 20 ? 'bg-red-500' : m.margin < 40 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                                      style={{ width: `${Math.min(m.margin, 100)}%` }}
                                    />
                                  </div>
                                  <span className={`font-bold w-12 text-right ${marginColor}`}>{m.margin.toFixed(1)}%</span>
                                </div>
                              ) : (
                                <span className="text-zinc-600 text-xs">—</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              {m.margin === null ? (
                                <span className="text-xs bg-amber-950 text-amber-400 px-2 py-0.5 rounded-full">No Cost</span>
                              ) : m.margin < 20 ? (
                                <span className="text-xs bg-red-950 text-red-400 px-2 py-0.5 rounded-full">Critical</span>
                              ) : m.margin < 40 ? (
                                <span className="text-xs bg-amber-950 text-amber-400 px-2 py-0.5 rounded-full">Below Target</span>
                              ) : (
                                <span className="text-xs bg-emerald-950 text-emerald-400 px-2 py-0.5 rounded-full">Healthy</span>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    {margins.filter(m => {
                      if (m.cost === null) return false
                      if (marginFilter === 'below40') return m.below40
                      return true
                    }).length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-zinc-500 text-sm">
                          {margins.length === 0 ? 'Click Refresh to load margins.' : 'No products match this filter.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Fulfill Modal */}
      {fulfillModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 w-full max-w-md mx-4">
            <h3 className="text-white font-bold mb-1">Fulfill Order {fulfillModal.name}</h3>
            <p className="text-zinc-500 text-xs mb-4">{fulfillModal.line_items?.map(i => `${i.quantity}x ${i.title}`).join(', ')}</p>
            <div className="flex flex-col gap-3">
              <div>
                <label className="text-zinc-500 text-xs mb-1 block">Tracking Number (optional)</label>
                <input value={trackingNum} onChange={e => setTrackingNum(e.target.value)}
                  placeholder="1Z999AA10123456784"
                  className="w-full bg-zinc-800 border border-zinc-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-indigo-500" />
              </div>
              <div>
                <label className="text-zinc-500 text-xs mb-1 block">Carrier (optional)</label>
                <select value={trackingCo} onChange={e => setTrackingCo(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 text-zinc-200 text-sm rounded-lg px-3 py-2">
                  <option value="">Select carrier...</option>
                  <option>UPS</option>
                  <option>USPS</option>
                  <option>FedEx</option>
                  <option>DHL</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setFulfillModal(null)} className="border border-zinc-700 text-zinc-400 text-sm px-4 py-2 rounded-lg">Cancel</button>
              <button onClick={fulfillOrder} disabled={fulfilling}
                className="bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white text-sm px-4 py-2 rounded-lg transition-colors">
                {fulfilling ? 'Fulfilling...' : '✓ Mark Fulfilled'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
