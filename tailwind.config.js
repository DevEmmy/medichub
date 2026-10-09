/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Manrope', 'Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        display: ['"Bricolage Grotesque"', 'Manrope', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        ink: { DEFAULT: '#06281F', 900: '#06281F', 800: '#0B3529', 700: '#124636' },
        lime: { 200: '#E6FBB5', 300: '#D6F78C', 400: '#C6F36B', 500: '#A9DC3F' },
        sand: { 50: '#FBF8F1', 100: '#F5EFE2', 200: '#EADFC8' },
        brand: {
          50: '#ECF7F2', 100: '#D3EEE2', 200: '#A7DCC5', 300: '#72C4A3', 400: '#3FA881',
          500: '#1E8C66', 600: '#137352', 700: '#0F5C43', 800: '#0D4A37', 900: '#0B3A2C',
        },
        canvas: '#FBF8F1',
        mist: '#F0EEE6',
        line: '#E7E1D3',
        slate: { 950: '#0F1B19', 900: '#1C2A27', 700: '#3A4A46', 600: '#4E5D59', 500: '#5F6D69', 400: '#66736F', 300: '#C2CCC9' },
        amber: { 50: '#FFF7E8', 100: '#FDECC8', 500: '#D98C1C', 600: '#B8730F', 700: '#8F5909' },
        coral: { 50: '#FFF1EC', 100: '#FFDCD0', 500: '#E4674A', 600: '#C8513A', 700: '#9A3622' },
        danger: { 50: '#FEF0F0', 100: '#FDD9D9', 500: '#DC2B2B', 600: '#C21D1D', 700: '#A01616', 900: '#5A0B0B' },
      },
      boxShadow: {
        soft: '0 1px 2px rgba(10,31,26,.04), 0 4px 16px -4px rgba(10,31,26,.08)',
        lift: '0 2px 4px rgba(10,31,26,.04), 0 16px 40px -12px rgba(10,31,26,.18)',
        ring: '0 0 0 1px rgba(10,31,26,.06)',
      },
      borderRadius: { xl2: '1.25rem', '4xl': '2rem' },
      keyframes: {
        pulseRing: { '0%': { transform: 'scale(.9)', opacity: '.7' }, '100%': { transform: 'scale(1.8)', opacity: '0' } },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
        marquee: { '0%': { transform: 'translateX(0)' }, '100%': { transform: 'translateX(-50%)' } },
        floaty: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-10px)' } },
        blink: { '0%,100%': { opacity: '1' }, '50%': { opacity: '.25' } },
        kenburns: { '0%': { transform: 'scale(1) translate(0,0)' }, '100%': { transform: 'scale(1.12) translate(-2%,-1.5%)' } },
      },
      animation: {
        pulseRing: 'pulseRing 1.8s cubic-bezier(.2,.6,.3,1) infinite',
        shimmer: 'shimmer 1.4s infinite',
        marquee: 'marquee 38s linear infinite',
        floaty: 'floaty 6s ease-in-out infinite',
        blink: 'blink 1.2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
