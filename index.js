const Koa = require('koa');
const Config = require('./libs/config');

async function main() {
    const config = global.config = new Config();
    await config.applyConfigFile(process.env.CONFIG || './config.yml');

    const app = new Koa();

    if (config.get('server.trustProxy')) {
        app.proxy = true;
    }

    app.use(require('./middleware/apitoken'));
    app.use(require('./middleware/contentpath'));

    let routes = require('./routes/main');
    app.use(routes.routes());
    app.use(routes.allowedMethods());

    app.listen(config.get('server.port', 3000));
}

main();