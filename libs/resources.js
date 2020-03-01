const fs = require('fs').promises;
const path = require('path');
const frontmatter = require('front-matter');
const MarkdownIt = require('markdown-it')
const yaml = require('js-yaml');

class ResourceCollection {
    constructor(path, policyToken) {
        this.sitePath = path;
        this.defaultType = config.get('content.defaultExtension', 'md');
        this.policyToken = policyToken || '';
        this.policy = {
            name: 'published',
            scope: 'published',
        };
    }

    path(resource) {
        return path.join(this.sitePath, resource);
    }

    async loadPolicies() {
        let rawPolicyFile;
        try {
            rawPolicyFile = await fs.readFile(this.path('.config/policies.yml'), {encoding: 'utf8'});
        } catch (err) {
            if (err.code !== 'ENOENT') {
                // An error other than not existing, log it
                console.error('Error reading resource', err.stack);
            }

            return;
        }

        let policies;
        try {
            policies = yaml.safeLoad(rawPolicyFile);
        } catch (err) {
            console.error('Error parsing policy file', err.stack);
            return;
        }

        if (!policies) {
            return;
        }

        let policy = policies[this.policyToken || 'default'];
        if (!policy) {
            return;
        }

        this.policy = {
            name: policy.name,
            scope: policy.scope,
        };

        console.log('Using policy', this.policy);
    }

    async get(resPath) {
        let fullResPath = resPath;

        // If the last part of the resource path does not include an extension, ie. file.ext, then
        // auto add the default extension
        let parts = fullResPath.split(/\/|\\/);
        let lastPart = parts[parts.length - 1];
        if (lastPart && !lastPart.includes('.')) {
            fullResPath += '.' + this.defaultType;
        }

        // Ignore any dotfiles and prevent walking back directories
        if (parts.find(p => p[0] === '.')) {
            return null;
        }

        let data;
        try {
            data = await fs.readFile(this.path(fullResPath), {encoding: 'utf8'});
        } catch (err) {
            if (err.code !== 'ENOENT') {
                // An error other than not existing, log it
                console.error('Error reading resource', err.stack);
            }
        }

        if (!data) {
            return null;
        }

        let fm = frontmatter(data);
        let resource = Resource.fromFrontmatter(fm);
        resource.path = fullResPath;

        if (!this.canAccess(resource)) {
            return null;
        }

        return resource;
    }

    canAccess(resource) {
        if (this.policy.scope === 'none') {
            return false;
        }

        if (this.policy.scope === 'all') {
            return true;
        }

        if (this.policy.scope === 'published') {
            if (!resource.published || resource.published.constructor !== Date) {
                console.log('Resource contains invalid published date:', resource.path);
                return false;
            }

            if (resource.published < (new Date())) {
                return true;
            } else {
                return false;
            }
        }

        return false;
    }

    async search(searchPath, searchOpts={}) {
        // Don't go crazy searching hugely deep folder structures by default
        if (!searchOpts.pathDepth) {
            searchOpts.pathDepth = 5;
        }

        let depth = 0;
        let walk = async (dirPath, callback) => {
            if (searchOpts.pathDepth && depth > searchOpts.pathDepth) {
                return;
            }

            depth++;

            let dir = [];
            try {
                dir = await fs.readdir(this.path(dirPath));
            } catch (err) {
                // ignore errors; it's because we couldn't read the directory
            }

            for (let i=0; i<dir.length; i++) {
                let dirItem = dir[i];
                // Ignore dotfiles
                if (dirItem[0] === '.') {
                    continue;
                }

                let itemPath = path.join(dirPath, dirItem);

                let stat = await fs.stat(this.path(itemPath));
                if (stat.isDirectory()) {
                    await walk(itemPath, callback);
                } else {
                    await callback(itemPath);
                }
            }

            depth--;
        };

        let found = [];
        let trimmedSearchPath = searchPath.replace(/^\/|\/$/g, '');
        await walk(trimmedSearchPath, async (resourcePath) => {
            let resource = await this.get(resourcePath);
            if (!resource) {
                return;
            }

            // If any tags are given, only include resources with those tags
            if (searchOpts.tags && Object.keys(searchOpts.tags).length > 0) {
                let keys = Object.keys(searchOpts.tags);
                for (let i=0; i<keys.length; i++) {
                    let tag = keys[i];
                    if (typeof resource.tags[tag] === 'undefined') {
                        return;
                    }
                }
            }

            found.push(resource);
        });

        return found;
    }
}

class Resource {
    constructor() {
        this.path = '';
        // page(html), content(markdown), structure(json/yaml)
        this.type = 'page';
        this.format = 'html';
        this.created = new Date();
        this.published = null;
        this.tags = Object.create(null);
        this.title = '';
        this.snippet = '';
        this.body = '';
        // Size of the content file
        this.size = 0;
    }

    static fromFrontmatter(fm, path) {
        let attribs = fm.attributes;
        let resource = new Resource();
        resource.path = path || '';
        resource.type = attribs.type;
        resource.format = attribs.format;
        resource.created = attribs.created;
        resource.published = attribs.published;
        resource.tags = attribs.tags;
        resource.title = attribs.title;
        resource.snippet = attribs.snippet;
        resource.body = fm.body;
        resource.size = (fm.frontmatter || '').length + (fm.body || '').length;
        return resource;
    }

    parsedBody() {
        if (this.type === 'structure') {
            return this.structureToJson();
        }

        if (this.format === 'markdown') {
            try {
                let md = new MarkdownIt({
                    html: true,
                    linkify: true,
                    typographer: true,
                });
                return md.render(this.body);
            } catch (err) {
                console.error('Error rendering markdown resource');
                return null;
            }
        }

        return this.body;
    }

    structureToJson() {
        if (this.type !== 'structure') {
            return null;
        }

        if (this.format === 'json') {
            try {
                let structure = JSON.parse(this.body);
                return structure;
            } catch (err) {
                console.error('Error reading resource as structure:', err.message);
                return null;
            }
        } else {
            try {
                let structure = yaml.safeLoad(this.body);
                return structure;
            } catch (err) {
                console.error('Error reading resource as structure:', err.message);
                return null;
            }
        }
    }
}

module.exports.Collection = ResourceCollection;
module.exports.Resource = Resource;