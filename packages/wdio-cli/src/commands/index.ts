
import { config } from 'create-wdio'

import * as install from './install.js'
import * as repl from './repl.js'
import * as run from './run.js'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const commands: any = [config, install, repl, run]
