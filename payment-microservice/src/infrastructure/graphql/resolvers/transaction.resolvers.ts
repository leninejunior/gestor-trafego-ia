import { PaymentService } from '../../../application/services/payment.service';
import { Logger } from '../../logging/logger';
import { container } from '../../container/container';

const logger = Logger.getInstance();

export const transactionResolvers = {
  Query: {
    transaction: async (_: any, { id }: { id: string }) => {
      try {
        const paymentService = container.get<PaymentService>('PaymentService');
        const transaction = await paymentService.getTransaction(id);
        
        if (!transaction) {
          throw new Error(`Transaction with id ${id} not found`);
        }
        
        return transaction;
      } catch (error) {
        logger.error('GraphQL transaction query failed', { transactionId: id, error });
        throw error;
      }
    },

    transactions: async (_: any, { filter, pagination }: any) => {
      try {
        logger.info('GraphQL transactions query', { filter, pagination });
        
        if (!filter?.organizationId) {
          throw new Error('Organization ID is required');
        }

        const paymentService = container.get<PaymentService>('PaymentService');
        const transactions = await paymentService.getTransactionsByOrganization(filter.organizationId);
        
        // Apply client-side filtering for now (should be done in service/repository)
        let filteredTransactions = transactions;
        
        if (filter.providerName) {
          filteredTransactions = filteredTransactions.filter(t => t.providerName === filter.providerName);
        }
        
        if (filter.type) {
          filteredTransactions = filteredTransactions.filter(t => t.type === filter.type);
        }
        
        if (filter.status) {
          filteredTransactions = filteredTransactions.filter(t => t.status === filter.status);
        }

        // Apply date filtering
        if (filter.dateFrom) {
          const fromDate = new Date(filter.dateFrom);
          filteredTransactions = filteredTransactions.filter(t => 
            new Date(t.createdAt) >= fromDate
          );
        }
        
        if (filter.dateTo) {
          const toDate = new Date(filter.dateTo);
          filteredTransactions = filteredTransactions.filter(t => 
            new Date(t.createdAt) <= toDate
          );
        }

        // Apply pagination
        const limit = pagination?.limit || 20;
        const offset = pagination?.offset || 0;
        const total = filteredTransactions.length;
        
        // Apply sorting
        const orderBy = pagination?.orderBy || 'createdAt';
        const orderDirection = pagination?.orderDirection || 'DESC';
        
        filteredTransactions.sort((a: any, b: any) => {
          const aValue = a[orderBy];
          const bValue = b[orderBy];
          
          if (orderDirection === 'DESC') {
            return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
          } else {
            return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
          }
        });
        
        const paginatedTransactions = filteredTransactions.slice(offset, offset + limit);

        return {
          transactions: paginatedTransactions,
          pagination: {
            total,
            limit,
            offset,
            hasNext: offset + limit < total,
            hasPrevious: offset > 0
          }
        };
      } catch (error) {
        logger.error('GraphQL transactions query failed', { filter, pagination, error });
        throw error;
      }
    }
  }
};