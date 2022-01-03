const colors = require('tailwindcss/colors')
const defaultTheme = require('tailwindcss/defaultTheme')

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
        'text': {
          'light': {
            'primary': colors.neutral['700'],
            'faded': colors.neutral['500'],
          },
          'dark': {
            'primary': colors.neutral['200'],
            'faded': colors.neutral['300'],
          },
        },
        'info': {
          'bg': colors.amber['200'],
          't': colors.amber['600'],
        },
        'alert': {
          'bg': colors.red['400'],
          't': colors.red['800'],
        },
        'success': {
          'bg': colors.emerald['400'],
          't': colors.emerald['700'],
        },
        'walking': {
          'bg': colors.orange['500'],
          't': colors.neutral['700'],
        },
        'tbm': {
          'bg': colors.sky['400'],
          't': colors.neutral['700'],
        },
        'sncf': {
          'bg': colors.rose['600'],
          't': colors.neutral['700'],
        },
      },
    },
    screens: {
      'xs': '550px',
      ...defaultTheme.screens,
    }
  },
  variants: {
    extend: {},
  },
  plugins: [
  ],
}
