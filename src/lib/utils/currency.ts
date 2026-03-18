/**
 * Currency formatting utilities
 */

export function formatCurrency(
  amount: number, 
  currency: string = 'BRL', 
  locale: string = 'pt-BR'
): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatCurrencyCompact(
  amount: number, 
  currency: string = 'BRL', 
  locale: string = 'pt-BR'
): string {
  if (amount >= 1000000) {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency,
      notation: 'compact',
      compactDisplay: 'short',
    }).format(amount);
  }
  
  return formatCurrency(amount, currency, locale);
}

export function parseCurrency(value: string): number {
  // Remove currency symbols and convert to number
  const numericValue = value
    .replace(/[^\d,.-]/g, '') // Remove non-numeric characters except comma, dot, and minus
    .replace(',', '.'); // Replace comma with dot for decimal
  
  return parseFloat(numericValue) || 0;
}

export function formatCurrencyInput(value: string): string {
  // Remove all non-numeric characters
  const numericValue = value.replace(/\D/g, '');
  
  if (!numericValue) return '';
  
  // Convert to cents and then to currency format
  const cents = parseInt(numericValue);
  const amount = cents / 100;
  
  return formatCurrency(amount);
}