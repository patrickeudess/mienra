import type { Api } from './index'

declare global {
  interface Window {
    /** API exposée par le preload (contextBridge). */
    api: Api
  }
}

export {}
