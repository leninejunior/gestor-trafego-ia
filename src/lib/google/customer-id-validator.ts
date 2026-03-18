/**
 * Google Ads Customer ID Validator
 * 
 * Validates and formats Google Ads customer IDs according to API requirements.
 * 
 * Google Ads Customer ID Format:
 * - Must be exactly 10 digits
 * - No dashes or special characters
 * - Example: "1234567890"
 * - Sometimes displayed with dashes: "123-456-7890" (must be removed)
 * 
 * Requirements: 3.2
 */

export interface CustomerIdValidationResult {
  isValid: boolean;
  formatted: string;
  original: string;
  errors: string[];
}

/**
 * Validate and format a Google Ads customer ID
 * 
 * @param customerId - The customer ID to validate (with or without dashes)
 * @returns Validation result with formatted ID
 */
export function validateCustomerId(customerId: string | null | undefined): CustomerIdValidationResult {
  const errors: string[] = [];
  const original = customerId || '';

  // Check if customer ID is provided
  if (!customerId || customerId.trim() === '') {
    errors.push('Customer ID is required');
    return {
      isValid: false,
      formatted: '',
      original,
      errors,
    };
  }

  // Remove all non-digit characters (dashes, spaces, etc.)
  const digitsOnly = customerId.replace(/\D/g, '');

  // Check if we have exactly 10 digits
  if (digitsOnly.length !== 10) {
    errors.push(
      `Customer ID must be exactly 10 digits (found ${digitsOnly.length}). ` +
      `Example: "1234567890" or "123-456-7890"`
    );
    return {
      isValid: false,
      formatted: digitsOnly,
      original,
      errors,
    };
  }

  // Check if it's all zeros (invalid)
  if (digitsOnly === '0000000000') {
    errors.push('Customer ID cannot be all zeros');
    return {
      isValid: false,
      formatted: digitsOnly,
      original,
      errors,
    };
  }

  // Valid customer ID
  return {
    isValid: true,
    formatted: digitsOnly,
    original,
    errors: [],
  };
}

/**
 * Format a customer ID by removing dashes and non-digit characters
 * Throws an error if the customer ID is invalid
 * 
 * @param customerId - The customer ID to format
 * @returns Formatted customer ID (10 digits, no dashes)
 * @throws Error if customer ID is invalid
 */
export function formatCustomerId(customerId: string | null | undefined): string {
  const result = validateCustomerId(customerId);
  
  if (!result.isValid) {
    throw new Error(`Invalid customer ID: ${result.errors.join(', ')}`);
  }
  
  return result.formatted;
}

/**
 * Check if a customer ID is valid
 * 
 * @param customerId - The customer ID to check
 * @returns true if valid, false otherwise
 */
export function isValidCustomerId(customerId: string | null | undefined): boolean {
  return validateCustomerId(customerId).isValid;
}

/**
 * Validate multiple customer IDs
 * 
 * @param customerIds - Array of customer IDs to validate
 * @returns Array of validation results
 */
export function validateCustomerIds(
  customerIds: (string | null | undefined)[]
): CustomerIdValidationResult[] {
  return customerIds.map(id => validateCustomerId(id));
}

/**
 * Format multiple customer IDs
 * Returns only valid formatted IDs, skipping invalid ones
 * 
 * @param customerIds - Array of customer IDs to format
 * @returns Array of formatted customer IDs (only valid ones)
 */
export function formatCustomerIds(
  customerIds: (string | null | undefined)[]
): string[] {
  return customerIds
    .map(id => validateCustomerId(id))
    .filter(result => result.isValid)
    .map(result => result.formatted);
}

/**
 * Log customer ID validation errors
 * 
 * @param customerId - The customer ID that failed validation
 * @param context - Additional context for logging
 */
export function logCustomerIdError(
  customerId: string | null | undefined,
  context?: Record<string, any>
): void {
  const result = validateCustomerId(customerId);
  
  if (!result.isValid) {
    console.error('[Customer ID Validation] Invalid customer ID:', {
      original: result.original,
      errors: result.errors,
      context,
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * Validate customer ID with detailed logging
 * 
 * @param customerId - The customer ID to validate
 * @param context - Additional context for logging
 * @returns Validation result
 */
export function validateCustomerIdWithLogging(
  customerId: string | null | undefined,
  context?: Record<string, any>
): CustomerIdValidationResult {
  const result = validateCustomerId(customerId);
  
  console.log('[Customer ID Validation] Validating customer ID:', {
    original: result.original,
    formatted: result.formatted,
    isValid: result.isValid,
    errors: result.errors,
    context,
    timestamp: new Date().toISOString(),
  });
  
  if (!result.isValid) {
    logCustomerIdError(customerId, context);
  }
  
  return result;
}
