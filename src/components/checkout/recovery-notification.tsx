'use client';

import { useEffect, useState } from 'react';
import { CheckCircle, AlertTriangle, XCircle, Info, X } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface RecoveryNotificationProps {
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  description?: string;
  autoClose?: boolean;
  autoCloseDelay?: number;
  onClose?: () => void;
  actions?: Array<{
    label: string;
    onClick: () => void;
    variant?: 'default' | 'outline' | 'ghost';
  }>;
  className?: string;
}

const notificationConfig = {
  success: {
    icon: CheckCircle,
    className: 'border-green-200 bg-green-50 text-green-800',
    iconClassName: 'text-green-600'
  },
  error: {
    icon: XCircle,
    className: 'border-red-200 bg-red-50 text-red-800',
    iconClassName: 'text-red-600'
  },
  warning: {
    icon: AlertTriangle,
    className: 'border-yellow-200 bg-yellow-50 text-yellow-800',
    iconClassName: 'text-yellow-600'
  },
  info: {
    icon: Info,
    className: 'border-blue-200 bg-blue-50 text-blue-800',
    iconClassName: 'text-blue-600'
  }
};

export function RecoveryNotification({
  type,
  message,
  description,
  autoClose = true,
  autoCloseDelay = 5000,
  onClose,
  actions,
  className
}: RecoveryNotificationProps) {
  const [isVisible, setIsVisible] = useState(true);
  const [timeLeft, setTimeLeft] = useState(autoCloseDelay);

  const config = notificationConfig[type];
  const Icon = config.icon;

  useEffect(() => {
    if (!autoClose || !isVisible) return;

    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1000) {
          setIsVisible(false);
          if (onClose) {
            setTimeout(onClose, 300); // Wait for animation
          }
          return 0;
        }
        return prev - 1000;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [autoClose, isVisible, onClose]);

  const handleClose = () => {
    setIsVisible(false);
    if (onClose) {
      setTimeout(onClose, 300);
    }
  };

  if (!isVisible) {
    return null;
  }

  return (
    <div className={cn(
      "fixed top-4 right-4 z-50 w-full max-w-md transform transition-all duration-300 ease-in-out",
      isVisible ? "translate-x-0 opacity-100" : "translate-x-full opacity-0",
      className
    )}>
      <Alert className={cn(config.className, "shadow-lg")}>
        <Icon className={cn("h-4 w-4", config.iconClassName)} />
        
        <div className="flex-1 min-w-0">
          <AlertDescription className="font-medium">
            {message}
          </AlertDescription>
          
          {description && (
            <AlertDescription className="mt-1 text-sm opacity-90">
              {description}
            </AlertDescription>
          )}
          
          {actions && actions.length > 0 && (
            <div className="flex gap-2 mt-3">
              {actions.map((action, index) => (
                <Button
                  key={index}
                  size="sm"
                  variant={action.variant || 'outline'}
                  onClick={action.onClick}
                  className="h-7 text-xs"
                >
                  {action.label}
                </Button>
              ))}
            </div>
          )}
        </div>

        {/* Close button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleClose}
          className="h-6 w-6 p-0 hover:bg-black/10"
        >
          <X className="h-3 w-3" />
        </Button>

        {/* Auto-close progress bar */}
        {autoClose && timeLeft > 0 && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/10 rounded-b">
            <div
              className="h-full bg-current rounded-b transition-all duration-1000 ease-linear"
              style={{ width: `${(timeLeft / autoCloseDelay) * 100}%` }}
            />
          </div>
        )}
      </Alert>
    </div>
  );
}

// Hook para gerenciar notificações de recovery
export function useRecoveryNotifications() {
  const [notifications, setNotifications] = useState<Array<{
    id: string;
    type: 'success' | 'error' | 'warning' | 'info';
    message: string;
    description?: string;
    autoClose?: boolean;
    actions?: Array<{
      label: string;
      onClick: () => void;
      variant?: 'default' | 'outline' | 'ghost';
    }>;
  }>>([]);

  const addNotification = (notification: Omit<typeof notifications[0], 'id'>) => {
    const id = Date.now().toString();
    setNotifications(prev => [...prev, { ...notification, id }]);
    return id;
  };

  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const clearAll = () => {
    setNotifications([]);
  };

  // Convenience methods
  const showSuccess = (message: string, description?: string, actions?: any[]) => {
    return addNotification({ type: 'success', message, description, actions });
  };

  const showError = (message: string, description?: string, actions?: any[]) => {
    return addNotification({ 
      type: 'error', 
      message, 
      description, 
      actions,
      autoClose: false // Errors should not auto-close
    });
  };

  const showWarning = (message: string, description?: string, actions?: any[]) => {
    return addNotification({ type: 'warning', message, description, actions });
  };

  const showInfo = (message: string, description?: string, actions?: any[]) => {
    return addNotification({ type: 'info', message, description, actions });
  };

  const NotificationContainer = () => (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      {notifications.map((notification) => (
        <RecoveryNotification
          key={notification.id}
          type={notification.type}
          message={notification.message}
          description={notification.description}
          autoClose={notification.autoClose}
          actions={notification.actions}
          onClose={() => removeNotification(notification.id)}
        />
      ))}
    </div>
  );

  return {
    notifications,
    addNotification,
    removeNotification,
    clearAll,
    showSuccess,
    showError,
    showWarning,
    showInfo,
    NotificationContainer
  };
}