const STORE = process.env.SHOPIFY_STORE_URL!
const TOKEN = process.env.SHOPIFY_ACCESS_TOKEN!
const BASE  = `https://${STORE}/admin/api/2024-01`

async function shopify<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'X-Shopify-Access-Token': TOKEN,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })
  if (!res.ok) throw new Error(`Shopify API error ${res.status}: ${await res.text()}`)
  return res.json()
}

// ── Products ──────────────────────────────────────────────────────────────────

export async function getProducts(limit = 250, pageInfo?: string, collectionId?: string) {
  const params = new URLSearchParams({ limit: String(limit), fields: 'id,title,status,variants,images,product_type,vendor,tags,updated_at' })
  if (pageInfo) params.set('page_info', pageInfo)
  if (collectionId) params.set('collection_id', collectionId)
  const data = await shopify<{ products: ShopifyProduct[] }>(`/products.json?${params}`)
  return data.products
}

export async function getAllProducts(collectionId?: string): Promise<ShopifyProduct[]> {
  const all: ShopifyProduct[] = []
  let pageInfo: string | undefined
  do {
    const params = new URLSearchParams({ limit: '250', fields: 'id,title,status,variants,images,product_type,vendor,tags,updated_at' })
    if (pageInfo) params.set('page_info', pageInfo)
    else if (collectionId) params.set('collection_id', collectionId)

    const res = await fetch(`${BASE}/products.json?${params}`, {
      headers: { 'X-Shopify-Access-Token': TOKEN, 'Content-Type': 'application/json' },
    })
    if (!res.ok) break
    const data = await res.json()
    all.push(...(data.products ?? []))

    // Parse next page cursor from Link header
    const link = res.headers.get('link') ?? ''
    const nextMatch = link.match(/<[^>]*[?&]page_info=([^&>]+)[^>]*>;\s*rel="next"/)
    pageInfo = nextMatch ? nextMatch[1] : undefined
  } while (pageInfo)
  return all
}

export async function getCollections() {
  const [custom, smart] = await Promise.all([
    shopify<{ custom_collections: { id: string; title: string }[] }>('/custom_collections.json?limit=250&fields=id,title'),
    shopify<{ smart_collections: { id: string; title: string }[] }>('/smart_collections.json?limit=250&fields=id,title'),
  ])
  return [
    ...custom.custom_collections.map(c => ({ ...c, type: 'custom' })),
    ...smart.smart_collections.map(c => ({ ...c, type: 'smart' })),
  ].sort((a, b) => a.title.localeCompare(b.title))
}

export async function getProduct(id: string) {
  const data = await shopify<{ product: ShopifyProduct }>(`/products/${id}.json`)
  return data.product
}

export async function updateProduct(id: string, updates: Partial<ShopifyProduct>) {
  const data = await shopify<{ product: ShopifyProduct }>(`/products/${id}.json`, {
    method: 'PUT',
    body: JSON.stringify({ product: updates }),
  })
  return data.product
}

export async function updateVariant(id: string, updates: { price?: string; inventory_quantity?: number; compare_at_price?: string }) {
  const data = await shopify<{ variant: ShopifyVariant }>(`/variants/${id}.json`, {
    method: 'PUT',
    body: JSON.stringify({ variant: updates }),
  })
  return data.variant
}

export async function getProductCount() {
  const data = await shopify<{ count: number }>('/products/count.json')
  return data.count
}

// ── Inventory ─────────────────────────────────────────────────────────────────

export async function getInventoryLevels(locationId: string) {
  const data = await shopify<{ inventory_levels: InventoryLevel[] }>(`/inventory_levels.json?location_id=${locationId}&limit=250`)
  return data.inventory_levels
}

export async function getLocations() {
  const data = await shopify<{ locations: Location[] }>('/locations.json')
  return data.locations
}

export async function setInventoryLevel(inventoryItemId: string, locationId: string, quantity: number) {
  return shopify('/inventory_levels/set.json', {
    method: 'POST',
    body: JSON.stringify({ inventory_item_id: inventoryItemId, location_id: locationId, available: quantity }),
  })
}

// ── Customers ─────────────────────────────────────────────────────────────────

export async function getCustomers(limit = 50, query?: string) {
  const params = new URLSearchParams({ limit: String(limit), fields: 'id,first_name,last_name,email,phone,tags,orders_count,total_spent,created_at,last_order_name' })
  if (query) params.set('query', query)
  const data = await shopify<{ customers: ShopifyCustomer[] }>(`/customers.json?${params}`)
  return data.customers
}

export async function getCustomer(id: string) {
  const data = await shopify<{ customer: ShopifyCustomer }>(`/customers/${id}.json`)
  return data.customer
}

export async function updateCustomerTags(id: string, tags: string) {
  const data = await shopify<{ customer: ShopifyCustomer }>(`/customers/${id}.json`, {
    method: 'PUT',
    body: JSON.stringify({ customer: { id, tags } }),
  })
  return data.customer
}

export async function getCustomerOrders(customerId: string) {
  const data = await shopify<{ orders: ShopifyOrder[] }>(`/customers/${customerId}/orders.json?status=any`)
  return data.orders
}

export async function getCustomerCount() {
  const data = await shopify<{ count: number }>('/customers/count.json')
  return data.count
}

// ── Orders ────────────────────────────────────────────────────────────────────

export async function getOrders(limit = 50, status = 'any', query?: string) {
  const params = new URLSearchParams({ limit: String(limit), status, fields: 'id,name,email,financial_status,fulfillment_status,total_price,line_items,created_at,customer,shipping_address' })
  if (query) params.set('query', query)
  const data = await shopify<{ orders: ShopifyOrder[] }>(`/orders.json?${params}`)
  return data.orders
}

export async function getOrder(id: string) {
  const data = await shopify<{ order: ShopifyOrder }>(`/orders/${id}.json`)
  return data.order
}

export async function getOrderCount(status = 'any') {
  const data = await shopify<{ count: number }>(`/orders/count.json?status=${status}`)
  return data.count
}

export async function fulfillOrder(orderId: string, locationId: string, trackingNumber?: string, trackingCompany?: string) {
  const fulfillment: Record<string, unknown> = { location_id: locationId, notify_customer: true }
  if (trackingNumber) fulfillment.tracking_number = trackingNumber
  if (trackingCompany) fulfillment.tracking_company = trackingCompany
  return shopify(`/orders/${orderId}/fulfillments.json`, {
    method: 'POST',
    body: JSON.stringify({ fulfillment }),
  })
}

// ── Analytics ─────────────────────────────────────────────────────────────────

export async function getRevenueStats() {
  const [orders, customers, products] = await Promise.all([
    getOrders(250, 'any'),
    getCustomerCount(),
    getProductCount(),
  ])

  const totalRevenue = orders.reduce((s, o) => s + parseFloat(o.total_price ?? '0'), 0)
  const unfulfilled  = orders.filter(o => o.fulfillment_status === null || o.fulfillment_status === 'partial').length
  const avgOrderValue = orders.length > 0 ? totalRevenue / orders.length : 0

  return { totalRevenue, unfulfilled, avgOrderValue, totalOrders: orders.length, totalCustomers: customers, totalProducts: products }
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ShopifyVariant {
  id: string
  title: string
  price: string
  compare_at_price: string | null
  inventory_quantity: number
  inventory_item_id: string
  sku: string
}

export interface ShopifyProduct {
  id: string
  title: string
  status: 'active' | 'draft' | 'archived'
  product_type: string
  vendor: string
  tags: string
  updated_at: string
  variants: ShopifyVariant[]
  images: { src: string }[]
}

export interface ShopifyCustomer {
  id: string
  first_name: string
  last_name: string
  email: string
  phone: string | null
  tags: string
  orders_count: number
  total_spent: string
  created_at: string
  last_order_name: string | null
}

export interface ShopifyOrder {
  id: string
  name: string
  email: string
  financial_status: string
  fulfillment_status: string | null
  total_price: string
  created_at: string
  customer: { id: string; first_name: string; last_name: string } | null
  shipping_address: { city: string; province: string; country: string } | null
  line_items: { title: string; quantity: number; price: string }[]
}

export interface InventoryLevel {
  inventory_item_id: string
  location_id: string
  available: number
}

export interface Location {
  id: string
  name: string
}

// ── Margin Analysis ───────────────────────────────────────────────────────────

export interface InventoryItem {
  id: string
  cost: string | null
  currency_code: string
}

export interface ProductMargin {
  productId: string
  variantId: string
  inventoryItemId: string
  title: string
  variantTitle: string
  price: number
  cost: number | null
  margin: number | null          // (price - cost) / price * 100
  profit: number | null          // price - cost
  status: 'active' | 'draft' | 'archived'
  imageUrl: string | null
  below40: boolean
}

/** Fetch inventory items in batches of 100 to get COGS */
export async function getInventoryItems(ids: string[]): Promise<InventoryItem[]> {
  const results: InventoryItem[] = []
  for (let i = 0; i < ids.length; i += 100) {
    const batch = ids.slice(i, i + 100)
    const data = await shopify<{ inventory_items: InventoryItem[] }>(
      `/inventory_items.json?ids=${batch.join(',')}&fields=id,cost,currency_code`
    )
    results.push(...(data.inventory_items ?? []))
  }
  return results
}

/** Pull all active products and calculate per-variant margin */
export async function analyzeProductMargins(): Promise<ProductMargin[]> {
  const products = await getAllProducts()
  const activeProducts = products.filter(p => p.status === 'active')

  // Collect all inventory_item_ids
  const allInvIds: string[] = []
  for (const p of activeProducts) {
    for (const v of p.variants ?? []) {
      if (v.inventory_item_id) allInvIds.push(v.inventory_item_id)
    }
  }

  const invItems = await getInventoryItems(allInvIds)
  const costMap = new Map<string, string | null>()
  for (const item of invItems) {
    costMap.set(String(item.id), item.cost)
  }

  const margins: ProductMargin[] = []
  for (const p of activeProducts) {
    for (const v of p.variants ?? []) {
      const price = parseFloat(v.price ?? '0')
      const costStr = costMap.get(String(v.inventory_item_id))
      const costRaw = costStr ? parseFloat(costStr) : null
      const cost = costRaw !== null && costRaw > 0 ? costRaw : null  // treat $0 cost as unset
      const margin = cost !== null && price > 0 ? ((price - cost) / price) * 100 : null
      const profit = cost !== null ? price - cost : null
      margins.push({
        productId: p.id,
        variantId: v.id,
        inventoryItemId: v.inventory_item_id,
        title: p.title,
        variantTitle: v.title === 'Default Title' ? '' : v.title,
        price,
        cost,
        margin,
        profit,
        status: p.status,
        imageUrl: p.images?.[0]?.src ?? null,
        below40: margin !== null ? margin < 40 : false,
      })
    }
  }

  return margins.sort((a, b) => {
    // Sort: null cost first (need attention), then by margin ascending
    if (a.margin === null && b.margin !== null) return -1
    if (b.margin === null && a.margin !== null) return 1
    if (a.margin !== null && b.margin !== null) return a.margin - b.margin
    return 0
  })
}

// ── AI Margin Recommendations ─────────────────────────────────────────────────

const OLLAMA_URL = process.env.OLLAMA_URL ?? 'http://localhost:11434'
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? 'llama3.1:8b'

async function ollamaChat(prompt: string): Promise<string> {
  const res = await fetch(`${OLLAMA_URL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: OLLAMA_MODEL, prompt, stream: false }),
    signal: AbortSignal.timeout(120000),
  })
  if (!res.ok) throw new Error(`Ollama ${res.status}`)
  const data = await res.json()
  return data.response ?? ''
}

async function geminiChat(prompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY
  const model = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash-lite'
  if (!apiKey) throw new Error('GEMINI_API_KEY not set')
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      signal: AbortSignal.timeout(60000),
    }
  )
  if (!res.ok) throw new Error(`Gemini ${res.status}`)
  const data = await res.json()
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
}

async function aiChat(prompt: string): Promise<string> {
  try { return await ollamaChat(prompt) } catch { return await geminiChat(prompt) }
}

export async function generateMarginRecommendations(margins: ProductMargin[]): Promise<string> {
  // Only analyze products where cost is actually set (non-null, non-zero)
  const withCost = margins.filter(m => m.cost !== null)
  const below40 = withCost.filter(m => m.below40)
  const healthy = withCost.filter(m => m.margin !== null && m.margin >= 40)

  const format = (m: ProductMargin) =>
    `- ${m.title}${m.variantTitle ? ` (${m.variantTitle})` : ''}: price $${m.price.toFixed(2)}, cost $${m.cost!.toFixed(2)}, margin ${m.margin!.toFixed(1)}%`

  const prompt = `You are Forge, the Shopify product advisor for Blessed Bling Co — a Print-on-Demand jewelry and apparel store.

Analyze the following product margin data and give actionable recommendations. The target gross margin is 40%+ (meaning (price - cost) / price >= 0.40). Only products with cost data entered are included in this analysis.

## Products BELOW 40% Margin (${below40.length} products)
${below40.length > 0 ? below40.map(format).join('\n') : 'None — all priced products meet the 40% target.'}

## Healthy Products (${healthy.length} products, margin ≥ 40%)
${healthy.slice(0, 5).map(format).join('\n')}${healthy.length > 5 ? `\n... and ${healthy.length - 5} more` : ''}

Write a clear, concise report (3-4 short paragraphs):
1. Summary of margin health across products with known costs
2. Specific recommendations for any below-40% products — suggest exact price increases needed to hit 40%, or recommend discontinuation if the product type can't support that margin
3. Quick wins — which below-40% products are closest to the target and just need a small price adjustment?
4. One closing note on overall pricing strategy

Be direct and specific. Do not mention products without cost data. Keep it under 250 words.`

  return aiChat(prompt)
}
