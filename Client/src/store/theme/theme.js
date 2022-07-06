import { ref } from 'vue'

function refreshTheme() {

    if (!('theme' in localStorage)) localStorage.theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'

    if (localStorage.theme === 'dark') {
        document.documentElement.classList.add('dark')
    } else {
        document.documentElement.classList.remove('dark')
    }
    return localStorage.theme
}
const theme = ref(refreshTheme())

function toggleDarkMode() {
    if (localStorage.theme === 'dark') localStorage.theme = 'light'
    else localStorage.theme = 'dark'
    theme.value = refreshTheme()
}

export {
    theme,
    toggleDarkMode,
}