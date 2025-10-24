import { Request, Response, NextFunction } from 'express';
import { Logger } from '../logging/logger';

export interface VersionConfig {
  version: string;
  status: 'current' | 'deprecated' | 'sunset';
  deprecationDate?: Date;
  sunsetDate?: Date;
  migrationGuideUrl?: string;
}

export class VersionManager {
  private static instance: VersionManager;
  private logger = Logger.getInstance();
  private versions: Map<string, VersionConfig> = new Map();

  private constructor() {
    this.initializeVersions();
  }

  public static getInstance(): VersionManager {
    if (!VersionManager.instance) {
      VersionManager.instance = new VersionManager();
    }
    return VersionManager.instance;
  }

  private initializeVersions(): void {
    // Current supported versions
    this.versions.set('v1', {
      version: 'v1',
      status: 'deprecated',
      deprecationDate: new Date('2024-06-01'),
      sunsetDate: new Date('2024-12-31'),
      migrationGuideUrl: '/docs/migration/v1-to-v2'
    });

    this.versions.set('v2', {
      version: 'v2',
      status: 'current'
    });
  }

  public detectVersion(req: Request): string {
    // Check explicit version header
    const headerVersion = req.headers['x-api-version'] as string;
    if (headerVersion && this.isValidVersion(headerVersion)) {
      return headerVersion;
    }

    // Check URL path
    const pathMatch = req.path.match(/\/api\/v(\d+)\//);
    if (pathMatch) {
      const pathVersion = `v${pathMatch[1]}`;
      if (this.isValidVersion(pathVersion)) {
        return pathVersion;
      }
    }

    // Check Accept header
    const acceptHeader = req.headers.accept;
    if (acceptHeader) {
      const acceptMatch = acceptHeader.match(/vnd\.payment-api\.v(\d+)/);
      if (acceptMatch) {
        const acceptVersion = `v${acceptMatch[1]}`;
        if (this.isValidVersion(acceptVersion)) {
          return acceptVersion;
        }
      }
    }

    // Default to latest stable version
    return 'v2';
  }

  public isValidVersion(version: string): boolean {
    return this.versions.has(version);
  }

  public getVersionConfig(version: string): VersionConfig | undefined {
    return this.versions.get(version);
  }

  public addDeprecationHeaders(res: Response, version: string): void {
    const config = this.versions.get(version);
    if (!config) return;

    if (config.status === 'deprecated') {
      res.setHeader('Deprecation', 'true');
      
      if (config.sunsetDate) {
        res.setHeader('Sunset', config.sunsetDate.toISOString());
      }
      
      if (config.migrationGuideUrl) {
        res.setHeader('Link', `<${config.migrationGuideUrl}>; rel="successor-version"`);
      }

      res.setHeader('Warning', '299 - "This API version is deprecated"');
    }
  }

  public validateVersionSupport(version: string): { supported: boolean; message?: string } {
    const config = this.versions.get(version);
    
    if (!config) {
      return {
        supported: false,
        message: `API version ${version} is not supported. Supported versions: ${Array.from(this.versions.keys()).join(', ')}`
      };
    }

    if (config.status === 'sunset') {
      return {
        supported: false,
        message: `API version ${version} has been sunset and is no longer available`
      };
    }

    return { supported: true };
  }

  public trackVersionUsage(version: string, endpoint: string, clientId?: string): void {
    this.logger.info('API version usage', {
      version,
      endpoint,
      clientId,
      timestamp: new Date().toISOString()
    });

    // Emit metrics for monitoring
    // This would integrate with your metrics system (Prometheus, etc.)
  }

  public getMigrationStatus(): { [version: string]: any } {
    const status: { [version: string]: any } = {};
    
    for (const [version, config] of this.versions) {
      status[version] = {
        status: config.status,
        deprecationDate: config.deprecationDate,
        sunsetDate: config.sunsetDate,
        migrationGuideUrl: config.migrationGuideUrl
      };
    }
    
    return status;
  }
}

// Middleware for version detection and validation
export const versionMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const versionManager = VersionManager.getInstance();
  
  // Detect version
  const version = versionManager.detectVersion(req);
  req.apiVersion = version;
  
  // Validate version support
  const validation = versionManager.validateVersionSupport(version);
  if (!validation.supported) {
    res.status(400).json({
      error: 'UNSUPPORTED_API_VERSION',
      message: validation.message,
      supportedVersions: Array.from(versionManager['versions'].keys())
    });
    return;
  }
  
  // Add deprecation headers if needed
  versionManager.addDeprecationHeaders(res, version);
  
  // Track usage
  versionManager.trackVersionUsage(version, req.path, req.headers['x-client-id'] as string);
  
  next();
};

// Extend Express Request interface
declare global {
  namespace Express {
    interface Request {
      apiVersion?: string;
    }
  }
}