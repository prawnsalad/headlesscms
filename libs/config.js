const _ = require('lodash');

module.exports = class Config {
    constructor() {
        this.data = Object.assign(Object.create(null), {
            server: {
                port: 3000,
            },
            content: {
                // %h = the website hostname
                // %t = the API token
                // %p = the first part in the path (eg. http://cms.com/<first>/content/path)
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