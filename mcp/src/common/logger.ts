import fs from 'fs'
import pino from 'pino'

const stdErrStream = {stream: process.stderr}
const fileStream = {stream: fs.createWriteStream('mcp.log', {flags: 'a'})}

const streams = []
streams.push(stdErrStream) // Always log to stderr
if (process.env.NODE_ENV === 'development') {
  // In development, also log to file
  streams.push(fileStream)
}

const logger = pino(
  {
    level: process.env.LOG_LEVEL || 'debug',
  },
  pino.multistream(streams),
)

export {logger}
