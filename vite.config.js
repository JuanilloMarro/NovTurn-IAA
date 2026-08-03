import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
    plugins: [react()],
    server: {
        // El RP ID de las passkeys en la fase de desarrollo es `localhost`
        // (PLAN §9.3, fase A). El origen tiene que ser exactamente este.
        port: 5173,
        strictPort: true,
    },
    build: {
        rollupOptions: {
            output: {
                manualChunks: {
                    'react-vendor': ['react', 'react-dom', 'react-router-dom'],
                    'supabase': ['@supabase/supabase-js'],
                },
            },
        },
        sourcemap: false,
    },
});
