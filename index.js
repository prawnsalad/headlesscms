const Koa = require('koa');
const koaCors = require('@koa/cors');
const Config = require('./libs/config');

async function main() {
    const config = global.config = new Config();
    await config.applyConfigFile(process.env.CONFIG || './config.yml');

    const app = new Koa();

    if (config.get('server.trustProxy')) {
        app.proxy = true;
    }

    app.use(koaCors({
        origin: ctx => {
            let allowedOrigins = config.get('origins.whitelist', []);
            if (!allowedOrigins || allowedOrigins.length === 0) {
                // Allow any Origin to use this server
                return ctx.get('Origin');
            }

            let reqOrigin = (ctx.get('Origin') || '').toLowerCase();
            return allowedOrigins.find(origin => origin.toLowerCase() === reqOrigin);
        },
    }));
    app.use(require('./middleware/apitoken'));
    app.use(require('./middleware/contentpath'));

    let routes = require('./routes/main');
    app.use(routes.routes());
    app.use(routes.allowedMethods());

    app.listen(config.get('server.port', 3000));
}

main();