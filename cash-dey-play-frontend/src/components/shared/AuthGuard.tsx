import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/auth.store';
import routes from '../../config/routes.config';

export const AuthGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, token } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    // If we're not authenticated, we should ideally go to a login/splash page.
    // For telegram mini apps, this usually happens transparently if the init data is missing.
    if (!isAuthenticated || !token) {
      navigate(routes.home); // We don't have a login route yet, so we just redirect to home/splash 
    }
  }, [isAuthenticated, token, navigate]);

  if (!isAuthenticated || !token) {
    return null; // Or a loading spinner
  }

  return <>{children}</>;
};
