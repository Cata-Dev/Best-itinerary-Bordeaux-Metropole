/* eslint-disable no-console */
const logger = require('./logger');
const app = require('./app');
const port = app.get('port');
const fs = require('fs');
const https = require('https');

const ssl = !!app.get('ssl').key

const opts = ssl ? {
  key: fs.readFileSync(app.get('ssl').key),
  cert: fs.readFileSync(app.get('ssl').cert)
} : {};
const server = ssl ? https.createServer(opts, app).listen(port) : app.listen(port);;
if (ssl) app.setup(server);

process.on('unhandledRejection', (reason, p) =>
	logger.error('Unhandled Rejection at: Promise ', p, reason)
);

server.on('listening', () =>
	logger.info('Feathers application started on http://%s:%d', app.get('host'), port)
);
