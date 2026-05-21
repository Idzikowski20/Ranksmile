/** @type {import('tailwindcss').Config} */
module.exports = {
   purge: {
      content: [
         './pages/**/*.{js,ts,jsx,tsx}',
         './components/**/*.{js,ts,jsx,tsx}',
      ],
   },
   content: [
      './pages/**/*.{js,ts,jsx,tsx}',
      './components/**/*.{js,ts,jsx,tsx}',
   ],
   safelist: [
      'max-h-48',
      'w-[150px]',
      'w-[240px]',
      'min-w-[270px]',
      'min-w-[180px]',
      'max-w-[180px]',
    ],
   theme: {
      extend: {
         fontFamily: {
            primary: ['Inter Variable', 'Inter', 'Arial', 'sans-serif'],
         },
         fontSize: {
            'ds-xs': 'var(--font-size-xs)',
            'ds-sm': 'var(--font-size-sm)',
            'ds-md': 'var(--font-size-md)',
            'ds-lg': 'var(--font-size-lg)',
            'ds-xl': 'var(--font-size-xl)',
            'ds-2xl': 'var(--font-size-2xl)',
            'ds-3xl': 'var(--font-size-3xl)',
            'ds-4xl': 'var(--font-size-4xl)',
         },
         colors: {
            'surface-base': 'var(--color-surface-base)',
            'surface-strong': 'var(--color-surface-strong)',
            'surface-raised': 'var(--color-surface-raised)',
            'text-primary': 'var(--color-text-primary)',
            'text-tertiary': 'var(--color-text-tertiary)',
            'border-strong': 'var(--color-border-strong)',
         },
         borderRadius: {
            'ds-xs': 'var(--radius-xs)',
            'ds-sm': 'var(--radius-sm)',
            'ds-md': 'var(--radius-md)',
            'ds-lg': 'var(--radius-lg)',
            'ds-xl': 'var(--radius-xl)',
         },
         spacing: {
            'ds-1': 'var(--space-1)',
            'ds-2': 'var(--space-2)',
            'ds-3': 'var(--space-3)',
            'ds-4': 'var(--space-4)',
            'ds-5': 'var(--space-5)',
            'ds-6': 'var(--space-6)',
            'ds-7': 'var(--space-7)',
            'ds-8': 'var(--space-8)',
         },
         boxShadow: {
            'ds-1': 'var(--shadow-1)',
            'ds-2': 'var(--shadow-2)',
         },
         transitionDuration: {
            instant: 'var(--motion-instant)',
            fast: 'var(--motion-fast)',
            normal: 'var(--motion-normal)',
            slow: 'var(--motion-slow)',
         },
      },
   },
   plugins: [],
 };
