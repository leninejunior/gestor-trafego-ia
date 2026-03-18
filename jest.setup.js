require('@testing-library/jest-dom')
const { TextEncoder, TextDecoder } = require('util')

// Load environment variables from .env file
require('dotenv').config()

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

// Mock Next.js API routes
jest.mock('next/server', () => ({
  NextRequest: class NextRequest {
    constructor(input, init = {}) {
      const resolvedUrl =
        input instanceof URL
          ? input.toString()
          : typeof input === 'string'
            ? input
            : input?.url || 'http://localhost:3000'

      this.url = resolvedUrl
      this.nextUrl = new URL(resolvedUrl, 'http://localhost:3000')
      this.method = init.method || 'GET'
      this.headers = new Map(Object.entries(init.headers || {}))
      this.body = init.body
    }

    async json() {
      if (!this.body) return {}
      if (typeof this.body === 'string') return JSON.parse(this.body)
      return this.body
    }

    async text() {
      if (typeof this.body === 'string') return this.body
      return JSON.stringify(this.body || {})
    }
  },
  NextResponse: {
    json: jest.fn((body, init = {}) => ({
      status: init.status || 200,
      headers: new Map(Object.entries(init.headers || {})),
      json: async () => body,
      text: async () => JSON.stringify(body)
    })),
    redirect: jest.fn((url, init = {}) => ({
      status: init.status || 302,
      headers: new Map(Object.entries({ location: url, ...init.headers || {} })),
      url
    }))
  }
}))

// Mock Web APIs for Node.js environment
if (typeof global.Request === 'undefined') {
  global.Request = class Request {
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

if (typeof global.Response === 'undefined') {
  global.Response = class Response {
    constructor(body, init = {}) {
      this.body = body
      this.status = init.status || 200
      this.statusText = init.statusText || 'OK'
      this.headers = new Map(Object.entries(init.headers || {}))
      this.url = init.url
    }
    
    static json(body, init = {}) {
      return new Response(JSON.stringify(body), {
        ...init,
        headers: {
          'Content-Type': 'application/json',
          ...init.headers
        }
      })
    }
    
    json() {
      return Promise.resolve(typeof this.body === 'string' ? JSON.parse(this.body) : this.body)
    }
    
    text() {
      return Promise.resolve(typeof this.body === 'string' ? this.body : JSON.stringify(this.body))
    }
  }
}

// Mock fetch API - but allow real Supabase calls
// Store original fetch if it exists (it won't in Node.js, but will in browser-like environments)
const originalFetch = global.fetch;

// Import cross-fetch for real HTTP calls
let crossFetch;
try {
  crossFetch = require('cross-fetch');
} catch (e) {
  // cross-fetch not available, will use mock for all calls
  console.warn('cross-fetch not available, using mock fetch for all calls');
}

global.fetch = jest.fn((url, options) => {
  // Allow real fetch for Supabase URLs
  if (typeof url === 'string' && url.includes('supabase.co')) {
    if (crossFetch) {
      return crossFetch(url, options);
    } else if (originalFetch) {
      return originalFetch(url, options);
    }
  }
  
  // Mock other URLs
  return Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve({}),
    text: () => Promise.resolve(''),
    headers: new Map(),
    url: url || ''
  });
})

// Mock window.location - simplified to avoid JSDOM navigation errors
if (typeof global !== 'undefined' && !global.location) {
  // Only define location if it doesn't already exist
  Object.defineProperty(global, 'location', {
    value: {
      href: 'http://localhost:3000',
      origin: 'http://localhost:3000',
      protocol: 'http:',
      host: 'localhost:3000',
      hostname: 'localhost',
      port: '3000',
      pathname: '/',
      search: '',
      hash: '',
      assign: jest.fn(),
      replace: jest.fn(),
      reload: jest.fn()
    },
    writable: true,
    configurable: true
  });
}

// Mock window.reload
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'reload', {
  value: jest.fn(),
    writable: true
  })
}

// Add TextEncoder/TextDecoder to global
global.TextEncoder = TextEncoder
global.TextDecoder = TextDecoder

// Mock environment variables only if not already set
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
}
if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-key'
}
process.env.STRIPE_SECRET_KEY = 'sk_mock_123'
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_123'
process.env.GOOGLE_CLIENT_ID = 'test-google-client-id'
process.env.GOOGLE_CLIENT_SECRET = 'test-google-client-secret'
process.env.GOOGLE_DEVELOPER_TOKEN = 'test-google-developer-token'

// Mock console methods to reduce noise in tests
const originalConsole = { ...console }
global.console = {
  ...originalConsole,
  // Uncomment to ignore specific console messages during tests
  // log: jest.fn(),
  // warn: jest.fn(),
  // error: jest.fn(),
}

// Setup test timeout
jest.setTimeout(10000)
