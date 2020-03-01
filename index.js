const Koa = require('koa');
const Config = require('./libs/config');

const config = global.config = new Config();
const app = new Koa();

app.use(require('./middleware/apitoken'));
app.use(require('./middleware/contentpath'));

let routes = require('./routes/main');
app.use(routes.routes());
app.use(routes.allowedMethods());

app.listen(config.get('server.port', 3000));