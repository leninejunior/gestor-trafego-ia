import { ApolloServer } from 'apollo-server-express';
import { createServer } from 'http';
import { execute, subscribe } from 'graphql';
import { SubscriptionServer } from 'subscriptions-transport-ws';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { typeDefs } from './schema';
import { resolvers } from './resolvers';
import { createDataLoaders, DataLoaders } from './dataloaders';
import { Logger } from '../logging/logger';
import { config } from '../config/environment';
import express from 'express';

const logger = Logger.getInstance();

export interface GraphQLContext {
  dataloaders: DataLoaders;
  correlationId?: string;
  user?: any; // TODO: Add proper user type when authentication is implemented
}

export class GraphQLServerManager {
  private apolloServer: ApolloServer | null = null;
  private httpServer: any = null;
  private subscriptionServer: SubscriptionServer | null = null;

  async createServer(app: express.Application): Promise<ApolloServer> {
    try {
      // Create executable schema
      const schema = makeExecutableSchema({
        typeDefs,
        resolvers
      });

      // Create Apollo Server
      this.apolloServer = new ApolloServer({
        schema,
        context: ({ req, connection }): GraphQLContext => {
          // For subscriptions (WebSocket connections)
          if (connection) {
            return {
              dataloaders: createDataLoaders(),
              correlationId: connection.context.correlationId,
              user: connection.context.user
            };
          }

          // For queries and mutations (HTTP requests)
          return {
            dataloaders: createDataLoaders(),
            correlationId: req.correlationId,
            user: req.user // TODO: Add authentication middleware
          };
        },
        plugins: [
          {
            requestDidStart() {
              return {
                didResolveOperation(requestContext) {
                  logger.info('GraphQL operation started', {
                    operationName: requestContext.request.operationName,
                    correlationId: requestContext.context.correlationId
                  });
                },
                didEncounterErrors(requestContext) {
                  logger.error('GraphQL operation failed', {
                    operationName: requestContext.request.operationName,
                    errors: requestContext.errors,
                    correlationId: requestContext.context.correlationId
                  });
                },
                willSendResponse(requestContext) {
                  logger.info('GraphQL operation completed', {
                    operationName: requestContext.request.operationName,
                    correlationId: requestContext.context.correlationId
                  });
                }
              };
            }
          }
        ],
        introspection: config.env !== 'production',
        playground: config.env !== 'production' ? {
          settings: {
            'request.credentials': 'include'
          }
        } : false,
        formatError: (error) => {
          logger.error('GraphQL error', { error: error.message, stack: error.stack });
          
          // Don't expose internal errors in production
          if (config.env === 'production') {
            return new Error('Internal server error');
          }
          
          return error;
        }
      });

      // Apply Apollo GraphQL middleware
      this.apolloServer.applyMiddleware({ 
        app, 
        path: '/graphql',
        cors: {
          origin: config.env === 'production' ? false : true,
          credentials: true
        }
      });

      logger.info('GraphQL server created successfully', {
        path: '/graphql',
        introspection: config.env !== 'production',
        playground: config.env !== 'production'
      });

      return this.apolloServer;
    } catch (error) {
      logger.error('Failed to create GraphQL server', { error });
      throw error;
    }
  }

  async setupSubscriptions(httpServer: any): Promise<void> {
    try {
      const schema = makeExecutableSchema({
        typeDefs,
        resolvers
      });

      // Create subscription server for WebSocket connections
      this.subscriptionServer = SubscriptionServer.create(
        {
          schema,
          execute,
          subscribe,
          onConnect: (connectionParams: any, webSocket: any, context: any) => {
            logger.info('GraphQL subscription client connected', {
              connectionParams: Object.keys(connectionParams || {})
            });

            // TODO: Add authentication for WebSocket connections
            return {
              correlationId: `ws_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              user: null // TODO: Extract user from connectionParams
            };
          },
          onDisconnect: (webSocket: any, context: any) => {
            logger.info('GraphQL subscription client disconnected');
          },
          onOperationComplete: (webSocket: any, opId: string) => {
            logger.info('GraphQL subscription operation completed', { operationId: opId });
          }
        },
        {
          server: httpServer,
          path: '/graphql'
        }
      );

      this.httpServer = httpServer;

      logger.info('GraphQL subscriptions setup completed', {
        path: '/graphql'
      });
    } catch (error) {
      logger.error('Failed to setup GraphQL subscriptions', { error });
      throw error;
    }
  }

  async start(): Promise<void> {
    if (!this.apolloServer) {
      throw new Error('Apollo server not created. Call createServer() first.');
    }

    try {
      await this.apolloServer.start();
      logger.info('GraphQL server started successfully');
    } catch (error) {
      logger.error('Failed to start GraphQL server', { error });
      throw error;
    }
  }

  async stop(): Promise<void> {
    try {
      if (this.subscriptionServer) {
        this.subscriptionServer.close();
        logger.info('GraphQL subscription server stopped');
      }

      if (this.apolloServer) {
        await this.apolloServer.stop();
        logger.info('GraphQL server stopped');
      }
    } catch (error) {
      logger.error('Failed to stop GraphQL server', { error });
      throw error;
    }
  }

  getServer(): ApolloServer | null {
    return this.apolloServer;
  }
}

// Export singleton instance
export const graphqlServerManager = new GraphQLServerManager();