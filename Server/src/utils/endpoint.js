module.exports = class Endpoint {

    /**
     * Create a new Endpoint
     * @param {String} name Endpoint's name
     * @param {Number} rate Endpoint's rate of fetch, in seconds
     * @param { () => Promise<boolean> } fetch Endpoint's fetch function
     * @param {Object} model Database model
     */
    constructor(name, rate, fetch, model) {
        this.name = name
        this.rate = rate
        this.lastFetch = null
        this._fetch = fetch
        this.model = model
    }

    get onCooldown() {
        return (Date.now() - (this.lastFetch || 0)) < this.rate * 1000
    }

    /**
     * @type {Boolean}
     */
    get fetching() {
        return !!this._fetchPromise
    }

    /**
     * @type {Promise}
     */
    get fetchPromise() {
        if (this.fetching) return this._fetchPromise
        return new Promise((_, rej) => {
            rej(`No ongoing fetch for ${this.name}.`)
        })
    }

    /**
     * @param {Boolean} force 
     * @param {Boolean} debug 
     */
    async fetch(force = false, debug = false) {
        
        if (this.fetching) throw new Error(`Fetch is ongoing`)
        if (!force && this.onCooldown) throw new Error(`Fetch is on cooldown`)

        if (debug) console.warn(`Refreshing ${this.name}...`)
        /**
         * @type {Promise}
         */
        this._fetchPromise = new Promise(async (resolve, reject) => {
            try {
                const r = await this._fetch()
                this.lastFetch = Date.now()
                resolve(r)
            } catch(_) {
                reject(false)
            } finally {
                this._fetchPromise = null
                if (debug) console.info(`Refreshed ${this.name}.`)
            }
        })

        return this.fetchPromise
    }

}