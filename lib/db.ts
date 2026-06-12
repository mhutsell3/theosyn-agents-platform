import postgres from 'postgres'

// Use individual params to avoid URL parsing mangling special chars in password
const db = postgres({
  host: 'localhost',
  port: 5432,
  database: 'theosyn',
  username: 'theosyn',
  password: 'T9$kL2!vQ7#m',
  ssl: false,
  max: 5,
})
export default db
