import '@testing-library/jest-dom'

const root = globalThis

const ensureResponseJsonStatic = (ResponseCtor) => {
  if (typeof ResponseCtor === 'undefined' || typeof ResponseCtor.json === 'function') {
    return
  }

  Object.defineProperty(ResponseCtor, 'json', {
    configurable: true,
    writable: true,
    value(body, init = {}) {
      const headers =
        init.headers instanceof Map
          ? Object.fromEntries(init.headers.entries())
          : typeof init.headers?.entries === 'function'
            ? Object.fromEntries(init.headers.entries())
            : { ...(init.headers || {}) }

      headers['Content-Type'] = headers['Content-Type'] || 'application/json'

      return new ResponseCtor(JSON.stringify(body), {
        ...init,
        headers,
      })
    },
  })
}

if (typeof root.fetch === 'undefined') {
  root.fetch = async (...args) => {
    const { default: fetch } = await import('node-fetch')
    return fetch(...args)
  }
}

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter() {
    return {
      push: jest.fn(),
      replace: jest.fn(),
      prefetch: jest.fn(),
      back: jest.fn(),
      forward: jest.fn(),
      refresh: jest.fn(),
    }
  },
  useSearchParams() {
    return new URLSearchParams()
  },
  usePathname() {
    return ''
  },
}))

// Mock Web APIs for Node.js environment
if (typeof root.Request === 'undefined') {
  root.Request = class Request {
    constructor(input, init) {
      Object.defineProperty(this, 'url', {
        value: typeof input === 'string' ? input : input.url,
        writable: false
      })
      this.method = init?.method || 'GET'
      this.headers = new Map(Object.entries(init?.headers || {}))
      this.body = init?.body
      this.signal = { addEventListener: jest.fn() }
    }
    
    async json() {
      return JSON.parse(this.body)
    }
    
    async text() {
      return this.body
    }
  }
}

if (typeof root.Response === 'undefined') {
  root.Response = class Response {
    constructor(body, init) {
      this.body = body
      this.status = init?.status || 200
      this.statusText = init?.statusText || 'OK'
      this.headers = new Map(Object.entries(init?.headers || {}))
    }
    
    json() {
      return Promise.resolve(JSON.parse(this.body))
    }
    
    text() {
      return Promise.resolve(this.body)
    }
  }
}

ensureResponseJsonStatic(root.Response)

// Mock modules will be handled in individual test files

// Mock environment variables
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-key'
process.env.STRIPE_SECRET_KEY = 'sk_test_123'
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_123'
process.env.GOOGLE_CLIENT_ID = 'test-google-client-id'
process.env.GOOGLE_CLIENT_SECRET = 'test-google-client-secret'
process.env.GOOGLE_DEVELOPER_TOKEN = 'test-google-developer-token'
