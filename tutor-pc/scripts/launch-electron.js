'use strict'
const { spawn } = require('child_process')
const path = require('path')

// VSCode sets ELECTRON_RUN_AS_NODE=1 for its own Electron runtime.
// Any truthy value (including "0") puts Electron in plain Node.js mode,
// suppressing app initialization and require('electron') interception.
// We must delete it entirely before spawning our app.
const env = { ...process.env }
delete env.ELECTRON_RUN_AS_NODE

const electronBin = path.join(__dirname, '..', 'node_modules', 'electron', 'dist', 'electron.exe')

const child = spawn(electronBin, ['.'], {
  stdio: 'inherit',
  env,
})

child.on('close', code => process.exit(code ?? 0))
child.on('error', err => { console.error(err); process.exit(1) })
