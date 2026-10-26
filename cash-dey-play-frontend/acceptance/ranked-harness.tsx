// Isolated dev/test entry only. Vite production entry does not import this fixture.
import React from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient,QueryClientProvider } from '@tanstack/react-query';
import RankedPlay from '../src/features/ranked/RankedPlay';
import { useAuthStore } from '../src/store/auth.store';
import '../src/index.css';
useAuthStore.setState({token:'local-browser-fixture',isAuthenticated:true});
createRoot(document.getElementById('root')!).render(<React.StrictMode><QueryClientProvider client={new QueryClient()}><RankedPlay /></QueryClientProvider></React.StrictMode>);
