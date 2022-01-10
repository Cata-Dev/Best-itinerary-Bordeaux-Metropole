class Deferred {
    constructor() {
      this.promise = new Promise((resolve, reject) => {
            this.reject = reject
            this.resolve = resolve
        })
    }
}

/**
 * Format documents to be bulkUpdated via bulkWrite
 * @param {Array} documents 
 * @param {String} filterKey 
 * @returns {Array}
 */
module.exports.bulkOps = (documents, filterKey = '_id') => {
    return documents.map((doc) => {
        return {
            updateOne: {
                filter: { [filterKey]: doc[filterKey] },
                update: doc,
                upsert: true
            }
        }
    })
}

module.exports.sumObj = function (obj = {}, keys = []) { //Object.prototype.sum = // -> make errors when requiring on other files ?

    return Object.keys(obj).filter(k => keys.map(k => String(k)).includes(k) && typeof obj[k] == 'number').reduce((acc, v) => acc+obj[v], 0)

}

module.exports.time = {

    sToTime: (sec) => {
        if (typeof sec != 'number') sec = Number(sec)
        let hours = (sec/3600 >= 1) ? Math.floor(sec/3600) : 0
        let mins = Math.floor(sec%3600/60)
        sec = sec%3600%60%60
        if (hours<10 && hours>0) hours = '0'+String(hours)
        if (mins<10) mins = '0'+String(mins)
        if (sec<10) sec = '0'+String(sec)
        return (hours !=0) ? hours+':'+mins+':'+sec : mins+':'+sec
    },

    /**
     * @description Converts milliseconds to duration formatted as MM:SS
     * @param {Number} ms Les millisecondes à convertir
     * @returns {String} Duration formatted as MM:SS
     */
    msToTime: (ms) => {

        if (typeof ms != "number") ms = Number(ms)

        let date = new Date(ms)
        let m = date.getMinutes()
        let s = date.getSeconds()
        if (m < 10) m = "0"+m
        if (s < 10) s = "0"+s

        return `${m}:${s}`
    },

    /**
     * @returns {string} Une date au format "JJ mois année à HH:MM:SS"
     */
    timeConverter: (date) => {
        if (!(date instanceof Date)) date = new Date(date)
        let months = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
        let year = date.getFullYear();
        let month = months[date.getMonth()];
        let d = date.getDate();
        let hour = date.getHours();
        if (hour < 10) hour = "0"+hour
        let min = date.getMinutes();
        if (min < 10) min = "0"+min
        let sec = date.getSeconds();
        if (sec < 10) sec = "0"+sec
        let time = d + ' ' + month + ' ' + year + ' à ' + hour + ':' + min + ':' + sec ;
        return time;
    },

    /**
     * @returns {string} Une date au format "DD/MoMo/YY, HH:MiMi:SS"
     */
    datetocompact: (date) => {
        if (!(date instanceof Date)) date = new Date(date)
        try {
            var d = date.getDate()
            var mo = date.getMonth()+1
            var y = date.getFullYear().toString().substring(2, 4)
            var h = date.getHours()
            var mi = date.getMinutes()
            var s = date.getSeconds()
        } catch(e) {return '?'}
    
        if (d < 10) d = "0"+d
        if (mo < 10) mo = "0"+mo
        if (y < 10) y = "0"+y
        if (h < 10) h = "0"+h
        if (mi < 10) mi = "0"+mi
        if (s < 10) s = "0"+s
        return d+'/'+mo+'/'+y+', '+h+':'+mi+':'+s;
    },

    /**
     * @returns {string} Une date au format "DD/MoMo, HH:MiMi"
     */
    datetocompact1: (date) => {
        if (!(date instanceof Date)) date = new Date(date)
        try {
            var d = date.getDate()
            var mo = date.getMonth()+1
            var h = date.getHours()
            var mi = date.getMinutes()
        } catch(e) {return '?'}
    
        if (d < 10) d = "0"+d
        if (mo < 10) mo = "0"+mo
        if (h < 10) h = "0"+h
        if (mi < 10) mi = "0"+mi
        return d+'/'+mo+', '+h+':'+mi;
    },

    /**
     * @returns {string} Une date au format "DD/MM/YYYY"
     */
    datetocompact2: (date) => {
        if (!(date instanceof Date)) date = new Date(date)
        try {
            var d = date.getDate()
            var mo = date.getMonth()+1
            var y = date.getFullYear().toString()
        } catch(e) {return '?'}
    
        if (d < 10) d = "0"+d
        if (mo < 10) mo = "0"+mo
        if (y < 10) y = "0"+y
        return d+'/'+mo+'/'+y;
    },

    /**
     * @param {Date} date
     * @param {Boolean} includeSec Un booléen indiquant s'il faut inclure les millisecondes
     * @returns {string} Une date au format "HH:MiMi:SS"
     */
     datetocompact3: (date, includeMs) => {
        if (!(date instanceof Date)) date = new Date(date)
        try {
            var h = date.getHours()
            var mi = date.getMinutes()
            var s = date.getSeconds()
            var ms = date.getMilliseconds()
        } catch(e) {return '?'}
    
        if (h < 10) h = "0"+h
        if (mi < 10) mi = "0"+mi
        if (s < 10) s = "0"+s
        if (ms < 100) ms = "0"+ms
        else if (ms < 10) ms = "00"+ms
        return `${h}:${mi}:${s}${includeMs ? `.${ms}` : ''}`;
    },

    /**
     * @param {Number} ms Une durée en secondes
     * @param {Boolean} includeSec Un booléen indiquant s'il faut inclure les secondes
     * @returns {String} La durée formatée (YY?, MoMo?, DD?, HH?, MiMi?, SS? )
     */
    duration: (ms, includeSec = true, short = false) => {

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

        return `${y>0  && y<Infinity? `${y}${short ? 'a' : ` an${sy}`} ` : ''}${mo>0 ? `${mo}${short ? 'mo' : ` mois`} ` : ''}${d>0 ? `${d}${short ? 'j' : ` jour${sd}`} ` : ''}${h>0 ? `${h}${short ? 'h' : ` heure${sh}`} ` : ''}${mi>0 ? `${mi}${short ? 'm' : ` minute${smi}`} ` : ''}${s>0 && includeSec ? `${s}${short ? 's' : ` seconde${ss}`} ` : ''}`.replace(/ $/g, '')

    }
}

/**
 * Permet de mettre en pause l'exécution du code pour un délai donné, dans du code asynchrone
 * @param {number} [ms=1000] Nombre de millisecondes à attendre, 1s par défaut
 * @returns {Promise} Une promesse à await
 * @example await wait(1000) //permet de pause l'exécution pendant 1s
 */
module.exports.wait = (ms = 1000) => {
    const defP = new Deferred()
    setTimeout(()=> {
        defP.resolve()
    }, ms)
    return defP.promise
}

/**
 * Meilleur round, prend en compte les décimales
 * @param {number} number Le nombre à arrondir
 * @returns {string}
 */
module.exports.round = (number) => {
    if (typeof number !== 'number') number = Number(number)
    let retenues = 0
    let decs
    let decimals = Math.round(Number(number.toFixed(3).toString().split('.')[1]) / 10)
    if (decimals >= 100) {
        retenues++
        decs = ''
    } else if (decimals == 0) {
        decs = ''
    } else {
        decs = '.' + decimals.toString()
    }
    let integers = String(Math.floor(number) + retenues)
    return integers + decs
}

Array.from([
    ["fBlack", "\x1b[30m"],
    ["fR", "\x1b[31m"],
    ["fG", "\x1b[32m"],
    ["fY", "\x1b[33m"],
    ["fB", "\x1b[34m"],
    ["fM", "\x1b[35m"],
    ["fC", "\x1b[36m"],
    ["fW", "\x1b[37m"],
    ["bBlack", "\x1b[40m"],
    ["bR", "\x1b[41m"],
    ["bG", "\x1b[42m"],
    ["bY", "\x1b[43m"],
    ["bB", "\x1b[44m"],
    ["bM", "\x1b[45m"],
    ["bC", "\x1b[46m"],
    ["bW", "\x1b[47m"],
    ["reset", "\x1b[0m"],
    ["bright", "\x1b[1m"],
    ["dim", "\x1b[2m"],
    ["underscore", "\x1b[4m"],
    ["blink", "\x1b[5m"],
    ["reverse", "\x1b[7m"],
    ["hidden", "\x1b[8m"]
]).forEach(color => {
    module.exports[color[0]] = (s) => {
        return `${color[1]}${s.replace(/(\\x1b|)\[0m/g, "")}\x1b[0m`
    }
})

/** @param {[]} keys */
module.exports.propFromKey = (obj, keys) => {

    if (!(obj instanceof Object || obj instanceof Array) || !keys.length) return obj //non accessible

    keys = keys.split('.')
    if (!keys.length) return obj[keys] //dernière clé

    let key = keys.shift()
    if (!isNaN(Number(key))) key = Number(key) //clé d'index Array
    return this.propFromKey(obj[key], keys.join('.')) //on continue d'itérer

}