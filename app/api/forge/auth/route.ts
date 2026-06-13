import { NextResponse } from 'next/server'

export async function GET() {
  const shop    = process.env.SHOPIFY_STORE_URL!
  const apiKey  = process.env.SHOPIFY_CLIENT_ID!
  const scopes  = 'read_products,write_products,read_customers,write_customers,read_orders,write_orders,read_inventory,write_inventory'
  const redirect = `https://command.theosynlabs.com/api/forge/callback`
  const state   = Math.random().toString(36).slice(2)

  const url = `https://${shop}/admin/oauth/authorize?client_id=${apiKey}&scope=${scopes}&redirect_uri=${encodeURIComponent(redirect)}&state=${state}`
  return NextResponse.redirect(url)
}
