// The content path can be dynamic based on parts of the request. Work it out here
// so that it's available to all routes
module.exports = async (ctx, next) => {
    // %h = the website hostname
    // %t = the API token
    // %p = the first part in the path

    // Only use a limited subset of characters for path replacements
    let sanitize = (str) => str.replace(/[^a-z0-9_\-]+/i, '');

    let contentPath = config.get('content.path', './sitedata/');
    let pathNeedsParsing = contentPath.includes('%p');

    if (pathNeedsParsing) {
        let parts = ctx.path.split('/');
        if (parts.length >= 1) {
            let val = sanitize(parts[1] || '_default');
            contentPath = contentPath.replace('%p', val.toLowerCase());
        }
    }

    ctx.state.contentPath = contentPath
        .replace('%h', sanitize(ctx.hostname.toLowerCase()))
        .replace('%t', sanitize(ctx.state.apiToken.toLowerCase()));

    // If we need to strip out the first part of the path since it's used for the content path
    ctx.state.stripPath = () => {
        // We're not using the first directory of the path so leave it as-is
        if (!pathNeedsParsing) {
            return ctx.path;
        }

        // Remove the first /directory/ from the path
        let parts = ctx.path.split('/');
        parts.splice(1, 1);
        return parts.join('/');
    };

    await next();
};

function buildSiteDataPath(ctx) {
    // %h = the website hostname
    // %t = the API token
    // %p = the first part in the path
    let path = config.get('content.path', './sitedata/')
        .replace('%h', ctx.hostname.toLowerCase())
        .replace('%t', ctx.state.apiToken.toLowerCase());

    let parts = ctx.path.split('/');
    if (parts.length >= 1) {
        path = path.replace('%p', (parts[0] || '_default').toLowerCase());
    }

    return path;
}