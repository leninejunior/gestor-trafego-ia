import { Router } from 'express';
import { AdminController } from '../../controllers/admin.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { container } from '../../container/container';

const router = Router();

// Get controller instance from container
const adminController = container.resolve<AdminController>('adminController');

/**
 * Admin Routes
 * Base path: /api/v1/admin
 * 
 * All routes require JWT authentication and appropriate permissions
 */

// Apply authentication middleware to all admin routes
router.use(authMiddleware.authenticate);

/**
 * Dashboard Routes
 */

// GET /api/v1/admin/dashboard - Get admin dashboard overview
router.get('/dashboard', 
  authMiddleware.requirePermission('dashboard:read'),
  adminController.getDashboard.bind(adminController)
);

/**
 * Provider Management Routes
 */

// GET /api/v1/admin/providers - Get detailed provider information
router.get('/providers',
  authMiddleware.requirePermission('providers:read'),
  adminController.getProvidersAdmin.bind(adminController)
);

// PUT /api/v1/admin/providers/:name/config - Update provider configuration
router.put('/providers/:name/config',
  authMiddleware.requirePermission('providers:write'),
  adminController.updateProviderConfig.bind(adminController)
);

/**
 * Reports Routes
 */

// GET /api/v1/admin/reports/financial - Get consolidated financial reports
router.get('/reports/financial',
  authMiddleware.requirePermission('reports:read'),
  adminController.getFinancialReports.bind(adminController)
);

// GET /api/v1/admin/reports/performance - Get provider performance reports
router.get('/reports/performance',
  authMiddleware.requirePermission('reports:read'),
  adminController.getPerformanceReports.bind(adminController)
);

/**
 * Audit Routes
 */

// GET /api/v1/admin/audit-logs - Get audit logs
router.get('/audit-logs',
  authMiddleware.requirePermission('audit:read'),
  adminController.getAuditLogs.bind(adminController)
);

/**
 * Alert Management Routes
 */

// GET /api/v1/admin/alerts - Get system alerts
router.get('/alerts',
  authMiddleware.requirePermission('alerts:read'),
  adminController.getAlerts.bind(adminController)
);

// POST /api/v1/admin/alerts/:id/acknowledge - Acknowledge an alert
router.post('/alerts/:id/acknowledge',
  authMiddleware.requirePermission('alerts:write'),
  adminController.acknowledgeAlert.bind(adminController)
);

/**
 * System Management Routes
 */

// GET /api/v1/admin/system/health - Get detailed system health
router.get('/system/health',
  authMiddleware.requirePermission('system:read'),
  adminController.getSystemHealth.bind(adminController)
);

// POST /api/v1/admin/system/maintenance - Enable/disable maintenance mode
router.post('/system/maintenance',
  authMiddleware.requirePermission('system:write'),
  adminController.setMaintenanceMode.bind(adminController)
);

/**
 * Role-based access examples
 */

// Super admin only routes
router.use('/system/advanced', authMiddleware.requireRole(['super_admin']));

// Admin and super admin routes
router.use('/users', authMiddleware.requireRole(['admin', 'super_admin']));

export { router as adminRoutes };