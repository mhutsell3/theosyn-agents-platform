import NextAuth from 'next-auth'
import Google from 'next-auth/providers/google'
import db from './db'

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  pages: { signIn: '/login' },
  session: { strategy: 'jwt' },
  callbacks: {
    async signIn({ user }) {
      if (!user.email) return false
      try {
        // Upsert user — create org on first login
        const existing = await db`
          SELECT id, org_id FROM users WHERE email = ${user.email}
        ` as { id: string; org_id: string }[]

        if (existing.length === 0) {
          // New user — create org named after their email domain
          const domain = user.email.split('@')[1] ?? 'org'
          const slug = domain.replace(/[^a-z0-9]/g, '-') + '-' + Date.now()
          const orgName = user.name ?? domain

          const [org] = await db`
            INSERT INTO organizations (name, slug) VALUES (${orgName}, ${slug}) RETURNING id
          ` as { id: string }[]

          await db`
            INSERT INTO users (email, name, image, org_id, role)
            VALUES (${user.email}, ${user.name ?? null}, ${user.image ?? null}, ${org.id}, 'owner')
          `
        } else {
          // Update name/image in case they changed
          await db`
            UPDATE users SET name = ${user.name ?? null}, image = ${user.image ?? null}
            WHERE email = ${user.email}
          `
        }
        return true
      } catch (err) {
        console.error('signIn callback error:', err)
        return false
      }
    },

    async jwt({ token }) {
      if (!token.email) return token
      try {
        const [row] = await db`
          SELECT u.id, u.org_id, u.role, o.name as org_name, o.slug as org_slug
          FROM users u JOIN organizations o ON o.id = u.org_id
          WHERE u.email = ${token.email}
        ` as { id: string; org_id: string; role: string; org_name: string; org_slug: string }[]

        if (row) {
          token.userId = row.id
          token.orgId = row.org_id
          token.orgName = row.org_name
          token.orgSlug = row.org_slug
          token.role = row.role
        }
      } catch (err) {
        console.error('jwt callback error:', err)
      }
      return token
    },

    async session({ session, token }) {
      session.user.id = token.userId as string
      session.user.orgId = token.orgId as string
      session.user.orgName = token.orgName as string
      session.user.orgSlug = token.orgSlug as string
      session.user.role = token.role as string
      return session
    },
  },
})
