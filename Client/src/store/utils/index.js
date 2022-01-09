/**
 * @param {Number} ms Une durée en secondes
 * @param {Boolean} includeSec Un booléen indiquant s'il faut inclure les secondes
 * @returns {String} La durée formatée (YY?, MoMo?, DD?, HH?, MiMi?, SS? )
 */
function duration(ms, includeSec = true, short = false) {

    ms = Math.sqrt(ms**2) //ensure positive value

    let y = Math.floor(ms / 31556952000)
    ms-=y*31556952000
    let sy = y > 1 ? 's' : ''
    let mo = Math.floor(ms / 2629746000)
    ms-=mo*2629746000
    let d = Math.floor(ms / (3600000*24));
    ms-=d*3600000*24
    let sd = d > 1 ? 's' : ''
    let h = Math.floor(ms / 3600000);
    ms-=h*3600000
    let sh = h > 1 ? 's' : ''
    let mi = Math.floor(ms / 60000);
    ms-=mi*60000
    let smi = mi > 1 ? 's' : ''
    let s = Math.round(ms / 1000)
    let ss = s > 1 ? 's' : ''

    return `${y>0  && y<Infinity? `${y}${short ? 'a' : ` an${sy}`} ` : ''}${mo>0 ? `${mo}${short ? 'mo' : ` mois`} ` : ''}${d>0 ? `${d}${short ? 'j' : ` jour${sd}`} ` : ''}${h>0 ? `${h}${short ? 'h' : ` heure${sh}`} ` : ''}${mi>0 ? `${mi}${short ? ` min${smi}` : ` minute${smi}`} ` : ''}${s>0 && includeSec ? `${s}${short ? 's' : ` seconde${ss}`} ` : ''}`.replace(/ $/g, '')

}

/**
 * @param {Number | Date} date
 * @param {Boolean} hourOnly
 * @returns {string} Une date au format "DD/MoMo, HH:MiMi"
 */
function formatDate(date, hourOnly = false) {
    if (!(date instanceof Date)) date = new Date(date)
    if (!date) return '?'
    let h = date.getHours()
    let mi = date.getMinutes()
    if (h < 10) h = "0"+h
    if (mi < 10) mi = "0"+mi
    if (!hourOnly) {
        let d = date.getDate()
        let mo = date.getMonth()+1
        if (d < 10) d = "0"+d
        if (mo < 10) mo = "0"+mo
        return `${d}/${mo}, ${h}:${mi}`
    }
    return `${h}:${mi}`
}

const icons = {
    'foot': 'walking',
    'bus': 'bus',
    'tram': 'train',
    'boat': 'ship',
    'train': 'subway',
    'unknow': 'question-circle',
}

/**
 * @param {String} transport 
 * @returns {String}
 */
function transportToIcon(transport) {
    transport = transport.toLowerCase()
    return icons[transport] || icons['unknow']
}

/**
 * Properly compare 2 objects.
 * @param {Object} o1 
 * @param {Object} o2 
 * @returns {Boolean | null}
 */
function equalObjects(o1, o2) {

    if (typeof o1 != 'object' || typeof o2 != 'object') return o1 === o2

    for (const k in o1) {
        if ( !(o2[k]) ) return false
        if (!equalObjects(o1[k], o2[k])) return false
    }

    return true
}

export {
    duration,
    formatDate,
    transportToIcon,
    equalObjects,
}