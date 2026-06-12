import { DefaultSession } from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      email: string
      name?: string | null
      image?: string | null
      orgId: string
      orgName: string
      orgSlug: string
      role: string
      isSystemAdmin: boolean
    } & DefaultSession['user']
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    userId?: string
    orgId?: string
    orgName?: string
    orgSlug?: string
    role?: string
    isSystemAdmin?: boolean
  }
}
