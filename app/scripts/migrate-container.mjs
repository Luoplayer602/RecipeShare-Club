import {loadSecrets} from './container-secrets.mjs'
import mysql from 'mysql2/promise'
import {drizzle} from 'drizzle-orm/mysql2'
import {migrate} from 'drizzle-orm/mysql2/migrator'
loadSecrets(['DB_PASSWORD'])
const connection=await mysql.createConnection({host:process.env.DB_HOST,port:Number(process.env.DB_PORT),database:process.env.DB_NAME,user:process.env.DB_USER,password:process.env.DB_PASSWORD,multipleStatements:false})
try{
  await migrate(drizzle(connection),{migrationsFolder:'./drizzle'})
  console.log('Database migrations completed.')
}catch{
  console.error('Database migration failed. Check schema permissions and migration history; SQL parameters are not logged.')
  process.exitCode=1
}finally{await connection.end()}
