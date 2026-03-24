import { parsePositiveNumber, resolveDateRange } from '../api-v1-utils'

describe('api-v1-utils', () => {
  describe('resolveDateRange', () => {
    it('defaults to current month when dates are not provided', () => {
      const range = resolveDateRange(new URLSearchParams())

      expect(range.dateDefaultApplied).toBe(true)
      expect(range.warnings.length).toBeGreaterThan(0)
      expect(range.dateFrom).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(range.dateTo).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    })

    it('throws for invalid date format', () => {
      const params = new URLSearchParams({
        date_from: '03-01-2026',
        date_to: '2026-03-24'
      })

      expect(() => resolveDateRange(params)).toThrow('INVALID_DATE_FORMAT')
    })

    it('throws when date_from is after date_to', () => {
      const params = new URLSearchParams({
        date_from: '2026-03-25',
        date_to: '2026-03-24'
      })

      expect(() => resolveDateRange(params)).toThrow('INVALID_DATE_RANGE')
    })
  })

  describe('parsePositiveNumber', () => {
    it('parses positive numbers from string and number', () => {
      expect(parsePositiveNumber('120.50')).toBe(120.5)
      expect(parsePositiveNumber(88)).toBe(88)
    })

    it('returns null for invalid values', () => {
      expect(parsePositiveNumber(0)).toBeNull()
      expect(parsePositiveNumber(-10)).toBeNull()
      expect(parsePositiveNumber('abc')).toBeNull()
      expect(parsePositiveNumber(undefined)).toBeNull()
    })
  })
})
