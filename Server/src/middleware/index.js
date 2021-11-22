const { log } = require('../hooks');

// eslint-disable-next-line no-unused-vars
module.exports = function (app) {
  // Add your custom middleware here. Remember that
  // in Express, the order matters.
  app.hooks({
    before: {
    	all: [ log ]
    },
    after: {
    	all: [ log ]
    },
    error: {
    	all: [ log ]
    }
  });
};
