const fs = require('fs-extra');
const os = require('os');
const path = require('path');
const Router = require('@koa/router');
const Cache = require('../libs/cache');
const ResourceCache = require('../libs/resourcecache');
const git = require('nodegit');

const cacheResponseHeaderName = 'cms-cache-hit';
const router = new Router();
module.exports = router;

// Search results cache
const searchCache = new Cache({
    max: 100 * 1024 * 1024, // very roughly a 100mb cache
    length: (item, key) => item.size,
    maxAge: 1000 * 60 * 1 // 1 min
});

// Convert 'item1,item2,item3' into {item1:true,item2:true,item3:true}
function strListToObject(list, splitOn=',') {
    return list.split(splitOn)
    .reduce((cur, val) => {
        if (val) cur[val] = true;
        return cur;
    }, {});
}

router.get('/_api/gitpull', async (ctx) => {
    let cachedCol = await ResourceCache.getCollection(ctx.state.contentPath, ctx.state.apiToken);
    let collection = cachedCol.value;
    let gitconf;
    
    try {
        gitconf = await collection.loadConfigFile('git.yml');
    } catch (err) {
        ctx.log.error(err);
        ctx.body = 'Git is not enabled for this site';
        ctx.response.status = 503;
        return;
    }

    if (!gitconf || !gitconf.repository || !gitconf.repository.url) {
        ctx.body = {error: 'No repository configured'};
        ctx.response.status = 503;
        return;
    }

    // Create a temporary folder for us to clone the repo into
    let tempPath = await fs.mkdtemp(path.join(os.tmpdir(), 'nodecms-'));

    try {
        let cloneOpts = new git.CloneOptions();
        cloneOpts.checkoutBranch = gitconf.repository.branch || 'master';
        ctx.log(1, 'git.Clone', [gitconf.repository.url, tempPath]);
        await git.Clone(gitconf.repository.url, tempPath);
    } catch (err) {
        ctx.log.error('Error cloning Git repository:', err.stack);
        ctx.body = {error: 'Could not clone Git repository'};
        ctx.response.status = 503;
        return;
    }

    // We might need to read a specific folder from the git repo
    let newSrcPath = path.join(tempPath, gitconf.repository.folder || '');

    // Delete the .config/git .yml file as that should only be set on the server directly
    ctx.log(2, 'fs.remove', [path.join(newSrcPath, '.config/git.yml')]);
    await fs.remove(path.join(newSrcPath, '.config/git.yml'));

    // Move our existing live folder as a backup
    let backupSuffix = (new Date()).toISOString().replace(/[-T:Z]|\.\d+/g, '');
    let currentSitePath = trimSlash(collection.sitePath);
    let backupPath = currentSitePath + '_' + backupSuffix;
    ctx.log(3, 'fs.move', [currentSitePath, backupPath]);
    await fs.move(currentSitePath, backupPath);

    // Move our new content to the current live location
    ctx.log(4, 'fs.move', [trimSlash(newSrcPath), currentSitePath]);
    await fs.move(trimSlash(newSrcPath), currentSitePath);

    // Restore .config/git.yml config
    ctx.log(5, 'fs.copy', [path.join(backupPath, '.config/git.yml'), path.join(currentSitePath, '.config/git.yml')]);
    await fs.copy(path.join(backupPath, '.config/git.yml'), path.join(currentSitePath, '.config/git.yml'));

    // Clean up any temp folders
    ctx.log(6, 'fs.remove', [tempPath]);
    await fs.remove(tempPath);

    ctx.body = {error: null};

    function trimSlash(i) {
        return i.replace(/\/$/, '');
    }
});

/**
 * Query string params:
 * - tags=tag1,tag2 search for resources with all these tags
 * - include=tags,body,inject include these fields in the search results
 * - pathdepth=4 search this many folders deep. 0 = unlimited
 * - path=/folder/ the folder to search in. default is the root folder
 */
router.get('/_api/search', async (ctx) => {
    let isFresh = false;

    // If we're searching by tags
    let tags = strListToObject(ctx.query.tag || ctx.query.tags || '')

    // Include any extra fields
    let include = strListToObject(ctx.query.include || '');

    // Search for a specific type
    let types = strListToObject(ctx.query.type || ctx.query.types || '');

    let pathDepth = parseInt(ctx.query.pathdepth, 10);
    if (isNaN(pathDepth)) {
        pathDepth = 0;
    }

    let cacheKey = ctx.state.contentPath + ':' + ctx.state.apiToken + ':' + ctx.url;
    let results = await searchCache.get(cacheKey, async () => {
        isFresh = true;

        let cachedCol = await ResourceCache.getCollection(ctx.state.contentPath, ctx.state.apiToken);
        let collection = cachedCol.value;
        return collection.search(ctx.query.path || '/', {
            tags,
            pathDepth,
            types,
        });
    });

    // Don't include all the resource fields by default
    results = results.map(res => {
        let r = {
            path: res.path,
            title: res.title,
            snippet: res.snippet,
            published: res.published,
            type: res.type,
            format: res.format,
        };
        if (include.tags) {
            r.tags = res.tags || {};
        }
        if (include.body) {
            r.body = res.parsedBody();
        }
        if (include.inject) {
            r.inject_header = res.inject_header || '';
            r.inject_footer = res.inject_footer || '';
        }
        return r;
    });

    ctx.body = {
        resources: results,
    };
    ctx.response.set({
        [cacheResponseHeaderName]: !isFresh,
    });
});

router.get('/_api/get', async (ctx, next) => {
    let paths = (ctx.query.paths || '').split(',');
    let resources = [];

    let cachedCol = await ResourceCache.getCollection(ctx.state.contentPath, ctx.state.apiToken);
    let collection = cachedCol.value;

    for (let i=0; i<paths.length; i++) {
        let path = paths[i];

        // trim leading and trailing forward slashes, defaulting to 'home' if it's empty
        let resPath = path.replace(/^\/|\/$/g, '') || 'home';
        let cachedRes = await ResourceCache.getResource(collection, resPath);
        let resource = cachedRes.value;

        if (resource) {
            resources.push({
                ...resource,
                body: resource.parsedBody(),
            });
        }
    }

    ctx.body = {
        resources,
    };
});

router.get('/*', async (ctx, next) => {
    // trim leading and trailing forward slashes, defaulting to 'home' if it's empty
    let resPath = ctx.state.stripPath().replace(/^\/|\/$/g, '') || 'home';

    let cachedCol = await ResourceCache.getCollection(ctx.state.contentPath, ctx.state.apiToken);
    let cachedResource = await ResourceCache.getResource(cachedCol.value, resPath);
    let resource = cachedResource.value;

    if (!resource) {
        ctx.body = 'not found';
        ctx.response.status = 404;
    } else {
        ctx.body = resource.parsedBody();
        ctx.response.set({
            [cacheResponseHeaderName]: !cachedResource.fresh,
        });
    }
});
