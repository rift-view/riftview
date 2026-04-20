// CLI bin entry. Used both as the dev entry via `tsx apps/cli/cli/bin.ts`
// AND as the bundler entrypoint for esbuild (see scripts/build-cli.ts).
// esbuild adds the #!/usr/bin/env node shebang via `banner`.
import { buildProgram } from './index'
import { mapCommanderExit } from './exit-mapper'

async function run(): Promise<number> {
  const program = buildProgram()
  program.exitOverride()
  try {
    await program.parseAsync(process.argv)
    return 0
  } catch (err) {
    return mapCommanderExit(err)
  }
}

run().then(
  (code) => process.exit(code),
  (err) => {
    console.error(err)
    process.exit(4)
  }
)
