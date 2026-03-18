const { describe, it, expect } = require('@jest/globals')

// Mock do Next.js
jest.mock('next/server', () => ({
  NextRequest: class MockNextRequest {
    constructor(url, options = {}) {
      this.url = url
      this.method = options.method || 'GET'
      this.headers = new Map(Object.entries(options.headers || {}))
      this.body = options.body
    }
    
    async json() {
      return typeof this.body === 'string' ? JSON.parse(this.body) : this.body
    }
  },
  NextResponse: {
    json: jest.fn((body, init = {}) => ({
      status: init.status || 200,
      json: async () => body
    }))
  }
}))

describe('Integration Example Tests', () => {
  it('should handle a simple API request', async () => {
    // Arrange
    const mockData = { message: 'Hello World' }
    
    // Act
    const { NextRequest } = require('next/server')
    const request = new NextRequest('http://localhost/api/test', {
      method: 'POST',
      body: JSON.stringify(mockData),
      headers: { 'Content-Type': 'application/json' }
    })
    
    const body = await request.json()
    
    // Assert
    expect(body).toEqual(mockData)
    expect(request.method).toBe('POST')
  })

  it('should handle error responses', async () => {
    // Arrange
    const { NextResponse } = require('next/server')
    
    // Act
    const response = NextResponse.json(
      { error: 'Not found' },
      { status: 404 }
    )
    
    // Assert
    expect(response.status).toBe(404)
    const data = await response.json()
    expect(data.error).toBe('Not found')
  })
})