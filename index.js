const Koa = require('koa');
const Config = require('./libs/config');

const config = global.config = new Config();
const app = new Koa();

let middlewares = require('./middleware/apitoken');
app.use(middlewares);

let routes = require('./routes/main');
app.use(routes.routes());
app.use(routes.allowedMethods());

app.listen(config.get('server.port', 3000));