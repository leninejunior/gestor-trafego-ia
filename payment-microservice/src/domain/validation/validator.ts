import { z } from 'zod';
import { PaymentError, PaymentErrorType } from '../types';

/**
 * Classe utilitária para validação de dados
 */
export class Validator {
  /**
   * Valida dados usando um schema Zod
   */
  static validate<T>(schema: z.ZodSchema<T>, data: unknown): T {
    try {
      return schema.parse(data);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorMessages = error.errors.map(err => 
          `${err.path.join('.')}: ${err.message}`
        ).join(', ');
        
        throw new PaymentError(
          PaymentErrorType.VALIDATION_ERROR,
          `Validation failed: ${errorMessages}`,
          error,
          false
        );
      }
      
      throw new PaymentError(
        PaymentErrorType.VALIDATION_ERROR,
        'Unknown validation error',
        error,
        false
      );
    }
  }

  /**
   * Valida dados de forma assíncrona
   */
  static async validateAsync<T>(schema: z.ZodSchema<T>, data: unknown): Promise<T> {
    try {
      return await schema.parseAsync(data);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorMessages = error.errors.map(err => 
          `${err.path.join('.')}: ${err.message}`
        ).join(', ');
        
        throw new PaymentError(
          PaymentErrorType.VALIDATION_ERROR,
          `Validation failed: ${errorMessages}`,
          error,
          false
        );
      }
      
      throw new PaymentError(
        PaymentErrorType.VALIDATION_ERROR,
        'Unknown validation error',
        error,
        false
      );
    }
  }

  /**
   * Valida dados e retorna resultado com sucesso/erro
   */
  static safeParse<T>(schema: z.ZodSchema<T>, data: unknown): {
    success: boolean;
    data?: T;
    error?: string;
  } {
    try {
      const result = schema.safeParse(data);
      
      if (result.success) {
        return {
          success: true,
          data: result.data
        };
      } else {
        const errorMessages = result.error.errors.map(err => 
          `${err.path.join('.')}: ${err.message}`
        ).join(', ');
        
        return {
          success: false,
          error: errorMessages
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown validation error'
      };
    }
  }

  /**
   * Valida múltiplos objetos usando o mesmo schema
   */
  static validateMany<T>(schema: z.ZodSchema<T>, dataArray: unknown[]): T[] {
    return dataArray.map((data, index) => {
      try {
        return this.validate(schema, data);
      } catch (error) {
        if (error instanceof PaymentError) {
          throw new PaymentError(
            error.type,
            `Item ${index}: ${error.message}`,
            error.providerError,
            error.retryable,
            error.providerName
          );
        }
        throw error;
      }
    });
  }

  /**
   * Cria um schema personalizado para validação de credenciais
   */
  static createCredentialsSchema(requiredFields: string[]): z.ZodSchema {
    const schemaObject: Record<string, z.ZodString> = {};
    
    requiredFields.forEach(field => {
      schemaObject[field] = z.string().min(1, `${field} is required`);
    });
    
    return z.object(schemaObject);
  }

  /**
   * Valida formato de email
   */
  static validateEmail(email: string): boolean {
    const emailSchema = z.string().email();
    return emailSchema.safeParse(email).success;
  }

  /**
   * Valida formato de URL
   */
  static validateUrl(url: string): boolean {
    const urlSchema = z.string().url();
    return urlSchema.safeParse(url).success;
  }

  /**
   * Valida formato de UUID
   */
  static validateUuid(uuid: string): boolean {
    const uuidSchema = z.string().uuid();
    return uuidSchema.safeParse(uuid).success;
  }

  /**
   * Sanitiza string removendo caracteres perigosos
   */
  static sanitizeString(input: string): string {
    return input
      .replace(/[<>]/g, '') // Remove < e >
      .replace(/javascript:/gi, '') // Remove javascript:
      .replace(/on\w+=/gi, '') // Remove event handlers
      .trim();
  }

  /**
   * Valida e sanitiza metadados
   */
  static validateMetadata(metadata: Record<string, any>): Record<string, any> {
    const sanitized: Record<string, any> = {};
    
    for (const [key, value] of Object.entries(metadata)) {
      // Valida chave
      if (typeof key !== 'string' || key.length === 0 || key.length > 100) {
        continue;
      }
      
      // Sanitiza valor baseado no tipo
      if (typeof value === 'string') {
        sanitized[key] = this.sanitizeString(value);
      } else if (typeof value === 'number' || typeof value === 'boolean') {
        sanitized[key] = value;
      } else if (value === null) {
        sanitized[key] = null;
      }
      // Ignora outros tipos (objetos, arrays, etc.)
    }
    
    return sanitized;
  }
}