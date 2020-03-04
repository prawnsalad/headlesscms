// Get an API token from either the query or bearer header
module.exports = async (ctx, next) => {
    let apiToken = ctx.query.apitoken || '';

    // Authorization: Bearer <token>
    let auth = (ctx.get('Authorization') || '').split(' ');
    if (auth && auth[0] === 'Bearer' && auth[1]) {
        apiToken = auth[1];
    }

    ctx.state.apiToken = apiToken;

    await next();
};
