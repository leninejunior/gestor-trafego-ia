const { describe, it, expect } = require('@jest/globals')

describe('Example Tests', () => {
  it('should pass a simple test', () => {
    expect(1 + 1).toBe(2)
  })

  it('should handle async operations', async () => {
    const promise = Promise.resolve('test')
    await expect(promise).resolves.toBe('test')
  })

  it('should handle object matching', () => {
    const obj = { name: 'test', value: 123 }
    expect(obj).toEqual({
      name: 'test',
      value: 123
    })
  })
})