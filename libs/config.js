const _ = require('lodash');

module.exports = class Config {
    constructor() {
        this.data = Object.assign(Object.create(null), {
            server: {
                port: 3000,
            },
            content: {
                path: './sitedata/',
                defaultExtension: 'md',
                cache: false,
            },
        });
    }

    get(key, def) {
        let val = _.get(this.data, key);
        return typeof val === 'undefined' ?
            def :
            val;
    }
}