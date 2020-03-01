const LruCache = require('lru-cache');

module.exports = class Cache extends LruCache {
    constructor(...args) {
        super(...args);
    }

    async get(key, setterFn) {
        // Cache could be disabled...
        if (!config.get('content.cache', true)) {
            return setterFn();
        }

        let val = super.get(key);
        if (typeof val !== 'undefined') {
            return val;
        }

        val = await setterFn();
        if (typeof val !== 'undefined') {
            this.set(key, val);
        }
        return val;
    }
}
