/* eslint-disable no-console */
const app = require('./app');
const port = app.get('port');
const fs = require('fs');
const https = require('https');

const ssl = !!app.get('ssl').key

const opts = ssl ? {
  key: fs.readFileSync(app.get('ssl').key),
  cert: fs.readFileSync(app.get('ssl').cert)
} : {};



process.on('unhandledRejection', (reason, p) =>
	console.error('Unhandled Rejection at: Promise ', p, reason)
);

if (ssl) {

  const server = https.createServer(opts, app).listen(port)
  app.setup(server)
  server.on('listening', () =>
    console.info('Feathers application started on http://%s:%d', app.get('host'), port)
  );
  

} else {

  app.listen(port).then(() => {
    console.info('Feathers application started on http://%s:%d', app.get('host'), port)
  })

}