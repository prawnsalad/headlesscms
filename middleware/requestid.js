// Generate a request ID on each request
module.exports = async (ctx, next) => {
    ctx.id = Date.now() + '_' + (Math.random()*1e18).toString(36).substr(0,6);
    await next();
};