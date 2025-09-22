import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { AuthProvider } from './contexts/AuthContext';
import { OrderProvider } from './contexts/OrderContext';
import { Toaster } from 'react-hot-toast';
import * as serviceWorker from './utils/serviceWorker';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <AuthProvider>
      <OrderProvider>
        <App />
        <Toaster 
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#363636',
              color: '#fff',
            },
            success: {
              duration: 3000,
              iconTheme: {
                primary: '#22c55e',
                secondary: '#fff',
              },
            },
            error: {
              duration: 5000,
              iconTheme: {
                primary: '#ef4444',
                secondary: '#fff',
              },
            },
          }}
        />
      </OrderProvider>
    </AuthProvider>
  </React.StrictMode>
);

// Register service worker only in production to avoid dev caching issues
if (process.env.NODE_ENV === 'production') {
  serviceWorker.register({
    onSuccess: () => {
      console.log('App is ready for offline use');
    },
    onUpdate: () => {
      console.log('New content is available; please refresh');
      // You could show a toast notification here
    }
  });
} else {
  // Ensure no service worker interferes with dev server HMR and CSS
  serviceWorker.unregister();
}