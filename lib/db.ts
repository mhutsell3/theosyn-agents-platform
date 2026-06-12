import postgres from 'postgres'

// Railway injects DATABASE_URL; local dev uses individual params
const db = process.env.DATABASE_URL
  ? postgres(process.env.DATABASE_URL, { ssl: 'require', max: 10 })
  : postgres({
      host: 'localhost',
      port: 5432,
      database: 'theosyn',
      username: 'theosyn',
      password: 'T9$kL2!vQ7#m',
      ssl: false,
      max: 5,
    })

export default db
