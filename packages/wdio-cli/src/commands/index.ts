
import { config, install } from 'create-wdio/commands'

import * as repl from './repl.js'
import * as run from './run.js'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const commands: any = [config, install, repl, run]
