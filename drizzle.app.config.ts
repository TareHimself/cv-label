import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  dialect: 'sqlite',
  schema: './src/main/appSchema.ts',
  out: './drizzle-app'
})
