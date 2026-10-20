import React from 'react';
import { RouterProvider } from 'react-router-dom';
import { AuthProvider } from './features/auth/AuthContext';
import { router } from './app/router';

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  );
};

export default App;
