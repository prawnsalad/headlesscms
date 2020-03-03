const Cache = require('./cache');
const Resources = require('./resources');

/**
 * Cached resources so that we don't read from disk every time on heavy sites
 */
const resourceCache = new Cache({
    max: 100 * 1024 * 1024, // very roughly a 100mb cache
    length: (item, key) => item.size,
    maxAge: 1000 * 60 * 10 // 10 min
});
async function getResource(collection, resourcePath) {
	let fresh = false;
    let cacheKey = collection.sitePath + ':' + collection.policy.scope + ':' + (resourcePath || '');
    let resource = await resourceCache.get(cacheKey, async () => {
    	fresh = true;
        let res = await collection.get(resourcePath);
        return res ? res : undefined;
    });

    return {
    	value: resource,
    	fresh,
    };
}

/**
 * Cached resource collections so that we don't read from disk every time on heavy sites
 */
const resourceCollectionCache = new Cache({
    max: 100 * 1024 * 1024, // very roughly a 100mb cache
    length: (item, key) => item.size,
    maxAge: 1000 * 60 * 10 // 10 min
});

async function getCollection(path, apiToken) {
	let fresh = false;
    let collection = await resourceCollectionCache.get(path + ':' + apiToken, async () => {
    	let fresh = true;
        let col = new Resources.Collection(path, apiToken);
        await col.loadPolicies();
        return col;
    });

    return {
    	value: collection,
    	fresh,
    };
}

module.exports = {
	getResource,
	getCollection,
};
