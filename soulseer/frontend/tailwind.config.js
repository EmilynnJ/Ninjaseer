/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        mystical: {
          pink: '#FF69B4',
          darkPink: '#FF1493',
          lightPink: '#FFB6C1',
          gold: '#FFD700',
          darkGold: '#B8860B',
          purple: '#9370DB',
          darkPurple: '#6A0DAD',
        },
      },
      fontFamily: {
        'alex-brush': ['Alex Brush', 'cursive'],
        'playfair': ['Playfair Display', 'serif'],
      },
      backgroundImage: {
        'cosmic-gradient': 'linear-gradient(135deg, #000000 0%, #1a0033 50%, #000000 100%)',
        'mystical-gradient': 'linear-gradient(135deg, #FF69B4 0%, #9370DB 50%, #FFD700 100%)',
      },
      animation: {
        'float': 'float 6s ease-in-out infinite',
        'shimmer': 'shimmer 2s linear infinite',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-20px)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-1000px 0' },
          '100%': { backgroundPosition: '1000px 0' },
        },
      },
    },
  },
  plugins: [],
}