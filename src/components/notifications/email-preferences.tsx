'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Mail, Bell, CreditCard, Calendar, TrendingUp, X } from 'lucide-react';

interface EmailPreference {
  notification_type: string;
  enabled: boolean;
  email_address?: string | null;
  organization_id?: string;
  user_id?: string;
}

interface NotificationTypeConfig {
  type: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  category: 'billing' | 'subscription' | 'account';
}

const notificationTypes: NotificationTypeConfig[] = [
  {
    type: 'subscription_confirmation',
    title: 'Subscription Confirmation',
    description: 'Welcome email when you subscribe to a new plan',
    icon: <Bell className="h-4 w-4" />,
    category: 'subscription'
  },
  {
    type: 'payment_failure',
    title: 'Payment Failures',
    description: 'Alerts when payments fail and retry information',
    icon: <CreditCard className="h-4 w-4" />,
    category: 'billing'
  },
  {
    type: 'renewal_reminder',
    title: 'Renewal Reminders',
    description: 'Notifications before your subscription renews',
    icon: <Calendar className="h-4 w-4" />,
    category: 'billing'
  },
  {
    type: 'subscription_cancelled',
    title: 'Cancellation Confirmation',
    description: 'Confirmation when you cancel your subscription',
    icon: <X className="h-4 w-4" />,
    category: 'subscription'
  },
  {
    type: 'plan_upgrade',
    title: 'Plan Changes',
    description: 'Notifications when you upgrade or downgrade your plan',
    icon: <TrendingUp className="h-4 w-4" />,
    category: 'subscription'
  }
];

export function EmailPreferences() {
  const [preferences, setPreferences] = useState<EmailPreference[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    fetchPreferences();
  }, []);

  const fetchPreferences = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/notifications/preferences');
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch preferences');
      }

      setPreferences(data.preferences || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load preferences');
    } finally {
      setLoading(false);
    }
  };

  const updatePreference = (type: string, field: 'enabled' | 'email_address', value: boolean | string) => {
    setPreferences(prev => prev.map(pref => 
      pref.notification_type === type 
        ? { ...pref, [field]: value }
        : pref
    ));
  };

  const savePreferences = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(false);

      const response = await fetch('/api/notifications/preferences', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ preferences }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save preferences');
      }

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save preferences');
    } finally {
      setSaving(false);
    }
  };

  const groupedTypes = notificationTypes.reduce((acc, type) => {
    if (!acc[type.category]) {
      acc[type.category] = [];
    }
    acc[type.category].push(type);
    return acc;
  }, {} as Record<string, NotificationTypeConfig[]>);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Email Notifications
          </CardTitle>
          <CardDescription>
            Manage your email notification preferences
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Email Notifications
        </CardTitle>
        <CardDescription>
          Manage your email notification preferences for subscription and billing events
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert>
            <AlertDescription>Preferences saved successfully!</AlertDescription>
          </Alert>
        )}

        {Object.entries(groupedTypes).map(([category, types]) => (
          <div key={category} className="space-y-4">
            <h3 className="text-lg font-medium capitalize">{category} Notifications</h3>
            
            <div className="space-y-4">
              {types.map((typeConfig) => {
                const preference = preferences.find(p => p.notification_type === typeConfig.type);
                
                return (
                  <div key={typeConfig.type} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div className="mt-1">
                          {typeConfig.icon}
                        </div>
                        <div className="space-y-1">
                          <Label className="text-sm font-medium">
                            {typeConfig.title}
                          </Label>
                          <p className="text-sm text-muted-foreground">
                            {typeConfig.description}
                          </p>
                        </div>
                      </div>
                      <Switch
                        checked={preference?.enabled || false}
                        onCheckedChange={(checked) => 
                          updatePreference(typeConfig.type, 'enabled', checked)
                        }
                      />
                    </div>

                    {preference?.enabled && (
                      <div className="ml-7 space-y-2">
                        <Label htmlFor={`email-${typeConfig.type}`} className="text-xs text-muted-foreground">
                          Custom email address (optional)
                        </Label>
                        <Input
                          id={`email-${typeConfig.type}`}
                          type="email"
                          placeholder="Use account email"
                          value={preference.email_address || ''}
                          onChange={(e) => 
                            updatePreference(typeConfig.type, 'email_address', e.target.value)
                          }
                          className="text-sm"
                        />
                        <p className="text-xs text-muted-foreground">
                          Leave empty to use your account email address
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        <div className="flex justify-end pt-4 border-t">
          <Button 
            onClick={savePreferences} 
            disabled={saving}
            className="min-w-[120px]"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Saving...
              </>
            ) : (
              'Save Preferences'
            )}
          </Button>
        </div>

        <div className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-lg">
          <p className="font-medium mb-1">Note:</p>
          <ul className="space-y-1">
            <li>• Email notifications are sent for important subscription and billing events</li>
            <li>• Critical notifications (like payment failures) may still be sent even if disabled</li>
            <li>• Custom email addresses will only be used for the specific notification type</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}