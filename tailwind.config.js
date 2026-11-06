/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        vazir: ['Vazir', 'Tahoma', 'Arial', 'sans-serif'],
      },
      colors: {
        faraja: {
          green: '#244b3b',
          dark: '#18372b',
          soft: '#edf5f0',
          accent: '#395d41',
          border: '#dbe5df',
        }
      }
    },
  },
  plugins: [],
}
