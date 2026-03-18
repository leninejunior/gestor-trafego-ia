import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import { createClient } from '@supabase/supabase-js'
import { SubscriptionIntentService } from '../subscription-intent-service'
import { SubscriptionIntentError } from '../subscription-intent-service'

// Mock do Supabase
jest.mock('@supabase/supabase-js')
const mockSupabaseClient = createClient()

describe('SubscriptionIntentService', () => {
  let service: SubscriptionIntentService

  beforeEach(() => {
    jest.clearAllMocks()
    service = new SubscriptionIntentService(mockSupabaseClient)
  })

  describe('createIntent', () => {
    it('should create subscription intent successfully', async () => {
      // Arrange
      const intentData = {
        plan_id: '123e4567-e89b-12d3-a456-426614174000',
        user_data: {
          name: 'Test User',
          email: 'test@example.com',
          cpf_cnpj: '12345678901',
          organization_name: 'Test Organization'
        }
      }

      const mockPlan = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Basic Plan',
        price: 99.90,
        features: { clients: 10, campaigns: 50 }
      }

      const mockIntent = {
        id: 'intent-123',
        ...intentData,
        status: 'pending',
        created_at: new Date().toISOString()
      }

      // Mock das chamadas ao Supabase
      mockSupabaseClient.from().select().eq().single.mockResolvedValueOnce({
        data: mockPlan,
        error: null
      })

      mockSupabaseClient.from().insert().select().single.mockResolvedValueOnce({
        data: mockIntent,
        error: null
      })

      // Act
      const result = await service.createIntent(intentData)

      // Assert
      expect(result.success).toBe(true)
      expect(result.data).toEqual(mockIntent)
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('subscription_plans')
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('subscription_intents')
    })

    it('should handle invalid plan ID', async () => {
      // Arrange
      const intentData = {
        plan_id: 'invalid-uuid',
        user_data: {
          name: 'Test User',
          email: 'test@example.com',
          cpf_cnpj: '12345678901',
          organization_name: 'Test Organization'
        }
      }

      // Mock de plano não encontrado
      mockSupabaseClient.from().select().eq().single.mockResolvedValueOnce({
        data: null,
        error: { message: 'Plan not found' }
      })

      // Act & Assert
      await expect(service.createIntent(intentData)).rejects.toThrow(SubscriptionIntentError)
    })

    it('should validate required fields', async () => {
      // Arrange
      const invalidData = {
        plan_id: '123e4567-e89b-12d3-a456-426614174000',
        user_data: {
          name: '',
          email: 'invalid-email',
          cpf_cnpj: '123',
          organization_name: ''
        }
      }

      // Act & Assert
      await expect(service.createIntent(invalidData)).rejects.toThrow(SubscriptionIntentError)
    })
  })

  describe('getIntent', () => {
    it('should retrieve intent by ID', async () => {
      // Arrange
      const intentId = 'intent-123'
      const mockIntent = {
        id: intentId,
        status: 'pending',
        created_at: new Date().toISOString()
      }

      mockSupabaseClient.from().select().eq().single.mockResolvedValueOnce({
        data: mockIntent,
        error: null
      })

      // Act
      const result = await service.getIntent(intentId)

      // Assert
      expect(result.success).toBe(true)
      expect(result.data).toEqual(mockIntent)
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('subscription_intents')
    })

    it('should handle intent not found', async () => {
      // Arrange
      const intentId = 'non-existent'

      mockSupabaseClient.from().select().eq().single.mockResolvedValueOnce({
        data: null,
        error: { message: 'Intent not found' }
      })

      // Act & Assert
      await expect(service.getIntent(intentId)).rejects.toThrow(SubscriptionIntentError)
    })
  })

  describe('updateIntentStatus', () => {
    it('should update intent status', async () => {
      // Arrange
      const intentId = 'intent-123'
      const newStatus = 'completed'

      mockSupabaseClient.from().update().eq().select().single.mockResolvedValueOnce({
        data: { id: intentId, status: newStatus },
        error: null
      })

      // Act
      const result = await service.updateIntentStatus(intentId, newStatus)

      // Assert
      expect(result.success).toBe(true)
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('subscription_intents')
    })

    it('should handle update errors', async () => {
      // Arrange
      const intentId = 'intent-123'
      const newStatus = 'completed'

      mockSupabaseClient.from().update().eq().select().single.mockResolvedValueOnce({
        data: null,
        error: { message: 'Update failed' }
      })

      // Act & Assert
      await expect(service.updateIntentStatus(intentId, newStatus)).rejects.toThrow(SubscriptionIntentError)
    })
  })

  describe('searchIntents', () => {
    it('should search intents by email', async () => {
      // Arrange
      const email = 'test@example.com'
      const mockIntents = [
        { id: 'intent-1', user_data: { email } },
        { id: 'intent-2', user_data: { email } }
      ]

      mockSupabaseClient.from().select().ilike.mockResolvedValueOnce({
        data: mockIntents,
        error: null
      })

      // Act
      const result = await service.searchIntents({ email })

      // Assert
      expect(result.success).toBe(true)
      expect(result.data).toEqual(mockIntents)
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('subscription_intents')
    })

    it('should search intents by status', async () => {
      // Arrange
      const status = 'pending'
      const mockIntents = [
        { id: 'intent-1', status },
        { id: 'intent-2', status }
      ]

      mockSupabaseClient.from().select().eq.mockResolvedValueOnce({
        data: mockIntents,
        error: null
      })

      // Act
      const result = await service.searchIntents({ status })

      // Assert
      expect(result.success).toBe(true)
      expect(result.data).toEqual(mockIntents)
    })

    it('should handle search errors', async () => {
      // Arrange
      mockSupabaseClient.from().select().mockResolvedValueOnce({
        data: null,
        error: { message: 'Search failed' }
      })

      // Act & Assert
      await expect(service.searchIntents({})).rejects.toThrow(SubscriptionIntentError)
    })
  })

  describe('getIntentByIdentifier', () => {
    it('should find intent by email and CPF', async () => {
      // Arrange
      const email = 'test@example.com'
      const cpfCnpj = '12345678901'
      const mockIntent = {
        id: 'intent-123',
        user_data: { email, cpf_cnpj: cpfCnpj }
      }

      mockSupabaseClient.from().select().eq().eq().single.mockResolvedValueOnce({
        data: mockIntent,
        error: null
      })

      // Act
      const result = await service.getIntentByIdentifier(email, cpfCnpj)

      // Assert
      expect(result.success).toBe(true)
      expect(result.data).toEqual(mockIntent)
    })

    it('should handle identifier not found', async () => {
      // Arrange
      const email = 'nonexistent@example.com'
      const cpfCnpj = '98765432100'

      mockSupabaseClient.from().select().eq().eq().single.mockResolvedValueOnce({
        data: null,
        error: { message: 'Intent not found' }
      })

      // Act & Assert
      await expect(service.getIntentByIdentifier(email, cpfCnpj)).rejects.toThrow(SubscriptionIntentError)
    })
  })

  describe('Error Handling', () => {
    it('should handle database connection errors', async () => {
      // Arrange
      mockSupabaseClient.from.mockImplementation(() => {
        throw new Error('Database connection failed')
      })

      // Act & Assert
      await expect(service.createIntent({
        plan_id: '123',
        user_data: { name: 'Test', email: 'test@example.com', cpf_cnpj: '123', organization_name: 'Test' }
      })).rejects.toThrow(SubscriptionIntentError)
    })

    it('should handle malformed data errors', async () => {
      // Arrange
      const malformedData = {
        plan_id: null,
        user_data: null
      }

      // Act & Assert
      await expect(service.createIntent(malformedData)).rejects.toThrow(SubscriptionIntentError)
    })
  })
})