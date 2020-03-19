// Add logging functions to requests
module.exports = async (ctx, next) => {
    function log(...args) {
        console.log('req.' + ctx.id, ...args);
    }
    log.debug = (...args) => {
        console.error('req.' + ctx.id, ...args);
    };
    log.error = (...args) => {
        console.error('req.' + ctx.id, ...args);
    };
    ctx.log = log;

    await next();
};