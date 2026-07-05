/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/index.html', './src/renderer/src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Palette MIENRA : bleu foncé, blanc, vert, gris clair
        primary: {
          50: '#eef4fb',
          100: '#d8e5f5',
          200: '#b5cdea',
          300: '#87abda',
          400: '#5583c5',
          500: '#3364ab',
          600: '#264e8c',
          700: '#1f3e70',
          800: '#1b345c',
          900: '#152947',
          950: '#0d1a2f'
        },
        accent: {
          50: '#f0faf4',
          100: '#dcf3e4',
          200: '#bce5cd',
          300: '#8dd1ab',
          400: '#57b482',
          500: '#349a64',
          600: '#247b4f',
          700: '#1e6241',
          800: '#1b4e36',
          900: '#17402e'
        }
      },
      fontFamily: {
        sans: ['Segoe UI', 'system-ui', 'Arial', 'sans-serif']
      }
    }
  },
  plugins: []
}
