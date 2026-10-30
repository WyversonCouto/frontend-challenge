import { setupWorker } from 'msw/browser'
import { controlHandlers, restHandlers } from './handlers'
import { socketHandlers } from './socket'

export const worker = setupWorker(...controlHandlers, ...restHandlers, ...socketHandlers)
