const Router = require('@koa/router');
const Cache = require('../libs/cache');
const Resources = require('../libs/resources');

const resourceCache = new Cache({
    max: 100 * 1024 * 1024, // very roughly a 100mb cache
    length: (item, key) => item.size,
    maxAge: 1000 * 60 * 10 // 10 min
});

const searchCache = new Cache({
    max: 100 * 1024 * 1024, // very roughly a 100mb cache
    length: (item, key) => item.size,
    maxAge: 1000 * 60 * 1 // 1 min
});

const cacheResponseHeaderName = 'cms-cache-hit';
const router = new Router();
module.exports = router;

/**
 * Query string params:
 * - tags=tag1,tag2 search for resources with all these tags
 * - include=tags,body include these fields in the search results
 * - pathdepth=4 search this many folders deep. 0 = unlimited
 * - path=/folder/ the folder to search in. default is the root folder
 */
router.get('/_api/search', async (ctx) => {
    let isFresh = false;

    // If we're searching by tags, create an object where it's keys are the tag names
    let tags = (ctx.query.tags || '').split(',')
        .reduce((cur, val) => {
            if (val) cur[val] = true;
            return cur;
        }, {});

    // Include any extra fields, create an object where it's keys are the tag names
    let include = (ctx.query.include || '').split(',')
        .reduce((cur, val) => {
            if (val) cur[val] = true;
            return cur;
        }, {});

    let pathDepth = parseInt(ctx.query.pathdepth, 10);
    if (isNaN(pathDepth)) {
        pathDepth = 0;
    }

    let results = await searchCache.get(ctx.url, async () => {
        isFresh = true;

        let resources = new Resources.Collection(config.get('content.path'), ctx.state.apiToken);
        await resources.loadPolicies();
        return resources.search(ctx.query.path || '/', {
            tags,
            pathDepth,
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
        return r;
    });

    ctx.body = {
        resources: results,
    };
    ctx.response.set({
        [cacheResponseHeaderName]: !isFresh,
    });
});


router.get('/*', async (ctx, next) => {
    // trim leading and trailing forward slashes, defaulting to 'home' if it's empty
    let resPath = ctx.path.replace(/^\/|\/$/g, '') || 'home';
    let isFresh = false;
    let resource = await resourceCache.get(resPath, async () => {
        isFresh = true;
        let resources = new Resources.Collection(config.get('content.path'), ctx.state.apiToken);
        await resources.loadPolicies();

        let res = await resources.get(resPath);
        return res ? res : undefined;
    });

    if (!resource) {
        ctx.body = 'not found';
        ctx.response.status = 404;
    } else {
        ctx.body = resource.parsedBody();
        ctx.response.set({
            [cacheResponseHeaderName]: !isFresh,
        });
    }
});
