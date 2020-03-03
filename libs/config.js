const _ = require('lodash');
const fs = require('fs').promises;
const yaml = require('js-yaml');

module.exports = class Config {
    constructor() {
        this.data = Object.assign(Object.create(null), {
            server: {
                port: 3000,
                trustProxy: false,
            },
            origins: {
                whitelist: [],
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

    applyConfig(obj) {
        this.data = _.merge(this.data, obj);
    }

    async applyConfigFile(filename) {
        try {
            let rawConfig = await fs.readFile(filename, {encoding: 'utf8'});
            let confObj = yaml.safeLoad(rawConfig);
            this.applyConfig(confObj);
        } catch (err) {
            if (err.code === 'ENOENT') {
                console.error('Config file does not exist:', filename);
            } else {
                console.error('Error reading config file:', err.message);
            }
        }
    }

    get(key, def) {
        let val = _.get(this.data, key);
        return typeof val === 'undefined' ?
            def :
            val;
    }
}