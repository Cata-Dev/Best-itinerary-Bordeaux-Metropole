const colors = require('tailwindcss/colors')

module.exports = {
  purge: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        'bg': {
          'light': colors.blueGray['50'],
          'dark': colors.blueGray['800'],
        },
        't': {
          'light': {
            'primary': colors.trueGray['700'],
            'faded': colors.trueGray['500'],
          },
          'dark': {
            'primary': colors.trueGray['50'],
            'faded': colors.trueGray['300'],
          },
        }
      }
    },
  },
  variants: {
    extend: {},
  },
  plugins: [
    require('@tailwindcss/forms')
  ],
}
