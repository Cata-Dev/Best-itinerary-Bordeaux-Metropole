const colors = require('tailwindcss/colors')

module.exports = {
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        'bg': {
          'light': colors.slate['50'],
          'dark': colors.slate['800'],
        },
        't': {
          'light': {
            'primary': colors.neutral['700'],
            'faded': colors.neutral['500'],
          },
          'dark': {
            'primary': colors.neutral['50'],
            'faded': colors.neutral['300'],
          },
        }
      }
    },
  },
  variants: {
    extend: {},
  },
  plugins: [
  ],
}
