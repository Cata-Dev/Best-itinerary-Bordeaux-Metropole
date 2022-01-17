import { theme, toggleDarkMode } from './theme/theme'
import { client, APIRefresh, socket } from './feathers/feathers'
import { duration, formatDate, transportToIcon, transportToType, equalObjects } from './utils'

const defaultQuerySettings = {
    departureTime: '',
    maxWalkDistance: 1000,
    walkSpeed: 6.0,
    transports: {
        TBM: true,
        SNCF: true,
    },
}

export {
    toggleDarkMode,
    theme,
    client,
    APIRefresh,
    socket,
    duration,
    formatDate,
    transportToIcon,
    transportToType,
    equalObjects,
    defaultQuerySettings,
}