import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { Logger } from '../logging/logger';
import { AdminUser } from '../controllers/admin.controller';

export interface AuthenticatedRequest extends Request {
  user?: AdminUser;
}

export class AuthMiddleware {
  private logger = Logger.getInstance();
  private jwtSecret: string;

  constructor() {
    this.jwtSecret = process.env.JWT_SECRET || 'your-secret-key';
    
    if (!process.env.JWT_SECRET) {
      this.logger.warn('JWT_SECRET not set in environment variables, using default');
    }
  }

  /**
   * JWT Authentication middleware
   */
  authenticate = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    try {
      const authHeader = req.headers.authorization;

      if (!authHeader) {
        res.status(401).json({
          success: false,
          error: 'Authorization header is required',
          correlationId: req.correlationId
        });
        return;
      }

      const token = authHeader.startsWith('Bearer ') 
        ? authHeader.substring(7) 
        : authHeader;

      if (!token) {
        res.status(401).json({
          success: false,
          error: 'JWT token is required',
          correlationId: req.correlationId
        });
        return;
      }

      // Verify JWT token
      const decoded = jwt.verify(token, this.jwtSecret) as any;

      // Extract user information from token
      const user: AdminUser = {
        id: decoded.sub || decoded.userId,
        email: decoded.email,
        role: decoded.role || 'viewer',
        organizationId: decoded.organizationId,
        permissions: decoded.permissions || this.getDefaultPermissions(decoded.role)
      };

      // Validate required fields
      if (!user.id || !user.email || !user.role) {
        res.status(401).json({
          success: false,
          error: 'Invalid token payload',
          correlationId: req.correlationId
        });
        return;
      }

      // Attach user to request
      req.user = user;

      this.logger.debug('User authenticated', {
        correlationId: req.correlationId,
        userId: user.id,
        role: user.role,
        organizationId: user.organizationId
      });

      next();

    } catch (error) {
      this.logger.warn('Authentication failed', {
        correlationId: req.correlationId,
        error: error instanceof Error ? error.message : error
      });

      if (error instanceof jwt.TokenExpiredError) {
        res.status(401).json({
          success: false,
          error: 'Token has expired',
          correlationId: req.correlationId
        });
        return;
      }

      if (error instanceof jwt.JsonWebTokenError) {
        res.status(401).json({
          success: false,
          error: 'Invalid token',
          correlationId: req.correlationId
        });
        return;
      }

      res.status(401).json({
        success: false,
        error: 'Authentication failed',
        correlationId: req.correlationId
      });
    }
  };

  /**
   * Role-based authorization middleware
   */
  requireRole = (allowedRoles: string[]) => {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
      const user = req.user;

      if (!user) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
          correlationId: req.correlationId
        });
        return;
      }

      if (!allowedRoles.includes(user.role)) {
        this.logger.warn('Access denied - insufficient role', {
          correlationId: req.correlationId,
          userId: user.id,
          userRole: user.role,
          requiredRoles: allowedRoles
        });

        res.status(403).json({
          success: false,
          error: 'Insufficient permissions',
          correlationId: req.correlationId
        });
        return;
      }

      next();
    };
  };

  /**
   * Permission-based authorization middleware
   */
  requirePermission = (permission: string) => {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
      const user = req.user;

      if (!user) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
          correlationId: req.correlationId
        });
        return;
      }

      // Super admin has all permissions
      if (user.role === 'super_admin') {
        next();
        return;
      }

      // Check if user has the required permission
      if (!user.permissions.includes(permission)) {
        this.logger.warn('Access denied - missing permission', {
          correlationId: req.correlationId,
          userId: user.id,
          userRole: user.role,
          requiredPermission: permission,
          userPermissions: user.permissions
        });

        res.status(403).json({
          success: false,
          error: `Permission '${permission}' is required`,
          correlationId: req.correlationId
        });
        return;
      }

      next();
    };
  };

  /**
   * Organization-based authorization middleware
   */
  requireOrganization = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    const user = req.user;

    if (!user) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
        correlationId: req.correlationId
      });
      return;
    }

    // Super admin can access all organizations
    if (user.role === 'super_admin') {
      next();
      return;
    }

    // Check if user has organization access
    if (!user.organizationId) {
      this.logger.warn('Access denied - no organization', {
        correlationId: req.correlationId,
        userId: user.id,
        userRole: user.role
      });

      res.status(403).json({
        success: false,
        error: 'Organization access required',
        correlationId: req.correlationId
      });
      return;
    }

    next();
  };

  /**
   * Generate JWT token for user
   */
  generateToken(user: Partial<AdminUser>, expiresIn: string = '24h'): string {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
      permissions: user.permissions,
      iat: Math.floor(Date.now() / 1000)
    };

    return jwt.sign(payload, this.jwtSecret, { expiresIn });
  }

  /**
   * Verify and decode JWT token
   */
  verifyToken(token: string): AdminUser | null {
    try {
      const decoded = jwt.verify(token, this.jwtSecret) as any;
      
      return {
        id: decoded.sub || decoded.userId,
        email: decoded.email,
        role: decoded.role,
        organizationId: decoded.organizationId,
        permissions: decoded.permissions || this.getDefaultPermissions(decoded.role)
      };
    } catch (error) {
      this.logger.warn('Token verification failed', {
        error: error instanceof Error ? error.message : error
      });
      return null;
    }
  }

  /**
   * Get default permissions for a role
   */
  private getDefaultPermissions(role: string): string[] {
    const rolePermissions: Record<string, string[]> = {
      super_admin: [
        'dashboard:read',
        'providers:read',
        'providers:write',
        'reports:read',
        'reports:write',
        'audit:read',
        'alerts:read',
        'alerts:write',
        'users:read',
        'users:write',
        'system:read',
        'system:write'
      ],
      admin: [
        'dashboard:read',
        'providers:read',
        'providers:write',
        'reports:read',
        'alerts:read',
        'alerts:write',
        'audit:read'
      ],
      viewer: [
        'dashboard:read',
        'providers:read',
        'reports:read',
        'alerts:read'
      ]
    };

    return rolePermissions[role] || rolePermissions.viewer;
  }

  /**
   * Refresh JWT token
   */
  refreshToken(token: string): string | null {
    try {
      const decoded = jwt.verify(token, this.jwtSecret, { ignoreExpiration: true }) as any;
      
      // Check if token is not too old (e.g., not older than 7 days)
      const tokenAge = Date.now() / 1000 - decoded.iat;
      const maxAge = 7 * 24 * 60 * 60; // 7 days in seconds
      
      if (tokenAge > maxAge) {
        return null;
      }

      const user: Partial<AdminUser> = {
        id: decoded.sub || decoded.userId,
        email: decoded.email,
        role: decoded.role,
        organizationId: decoded.organizationId,
        permissions: decoded.permissions
      };

      return this.generateToken(user);
    } catch (error) {
      this.logger.warn('Token refresh failed', {
        error: error instanceof Error ? error.message : error
      });
      return null;
    }
  }
}

// Export singleton instance
export const authMiddleware = new AuthMiddleware();