import { useEffect, useState } from 'react';
import { Shield, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

export const AdminMfaWarning = () => {
  const [showWarning, setShowWarning] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    checkMfaStatus();
  }, []);

  const checkMfaStatus = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Check if user is admin
      const { data: isAdmin } = await supabase.rpc('has_role', {
        _user_id: user.id,
        _role: 'администратор',
      });

      if (!isAdmin) return;

      // Check if user has MFA enabled
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const hasMfa = factors?.totp?.some((f) => f.status === 'verified');

      setShowWarning(!hasMfa);
    } catch (error) {
      console.error('Error checking MFA status:', error);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    // Store dismissal in session storage (reappears on page reload)
    sessionStorage.setItem('mfa-warning-dismissed', 'true');
  };

  const handleSetupMfa = () => {
    navigate('/dashboard?tab=settings&section=security');
  };

  if (!showWarning || dismissed || sessionStorage.getItem('mfa-warning-dismissed')) {
    return null;
  }

  return (
    <Alert className="border-orange-200 bg-orange-50 dark:border-orange-900 dark:bg-orange-950 mb-4">
      <Shield className="h-5 w-5 text-orange-600 dark:text-orange-400" />
      <div className="flex items-start justify-between flex-1">
        <div className="flex-1">
          <AlertTitle className="text-orange-800 dark:text-orange-200 mb-2">
            Multi-Factor Authentication Not Enabled
          </AlertTitle>
          <AlertDescription className="text-orange-700 dark:text-orange-300 space-y-2">
            <p>
              As an administrator, you have access to sensitive operations including user management,
              vault access control, and system settings. Enabling MFA adds an extra layer of security
              to protect your account.
            </p>
            <div className="flex gap-2 mt-3">
              <Button
                onClick={handleSetupMfa}
                size="sm"
                className="bg-orange-600 hover:bg-orange-700 text-white"
              >
                Enable MFA Now
              </Button>
              <Button
                onClick={handleDismiss}
                size="sm"
                variant="outline"
                className="border-orange-300 text-orange-700 hover:bg-orange-100 dark:border-orange-700 dark:text-orange-300 dark:hover:bg-orange-900"
              >
                Remind Me Later
              </Button>
            </div>
          </AlertDescription>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleDismiss}
          className="h-6 w-6 ml-2 text-orange-600 hover:text-orange-800 dark:text-orange-400 dark:hover:text-orange-200"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </Alert>
  );
};
