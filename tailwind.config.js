export default {
    content: ['./index.html', './src/**/*.{js,jsx}'],
    theme: {
        extend: {
            colors: {
                navy: {
                    50: '#F5F8FD',
                    100: '#EBF2FB',
                    300: '#5B8AC4',
                    500: '#1D5FAD',
                    700: '#1A3A6B',
                    900: '#0F2044',
                },
                glass: {
                    card: 'rgba(255,255,255,0.82)',
                    border: 'rgba(255,255,255,0.90)',
                    input: 'rgba(255,255,255,0.65)',
                    hover: 'rgba(255,255,255,0.60)',
                }
            },
            boxShadow: {
                'card': '0 2px 8px rgba(15,32,68,0.06), 0 1px 3px rgba(15,32,68,0.04)',
                'card-hover': '0 4px 20px rgba(15,32,68,0.08), 0 2px 8px rgba(15,32,68,0.04)',
                'modal': '0 16px 48px rgba(15,32,68,0.12), 0 8px 20px rgba(15,32,68,0.06)',
                'btn': '0 2px 8px rgba(26,58,107,0.25)',
                'btn-hover': '0 4px 14px rgba(26,58,107,0.35)',
            },
            backdropBlur: {
                'card': '12px',
                'modal': '20px',
            },
            fontFamily: {
                sans: ['Inter', '-apple-system', 'sans-serif'],
            }
        }
    },
    plugins: []
};
