/**
 * Run indexer sync locally or in CI:
 *   DATABASE_URL=... pnpm --filter @lssvm/suchmarket run indexer:sync
 */
import { runIndexerSync } from '../indexer/sync'

async function main() {
  const result = await runIndexerSync()
  console.log(JSON.stringify(result, null, 2))
  if (!result.ok) process.exit(1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})