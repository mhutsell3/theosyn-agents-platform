import postgres from 'postgres'

const db = postgres(process.env.DATABASE_URL!, { ssl: false, max: 5 })
export default db
