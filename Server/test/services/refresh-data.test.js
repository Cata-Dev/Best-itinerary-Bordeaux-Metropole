const assert = require('assert');
const app = require('../../src/app');

describe('\'refreshData\' service', () => {
  it('registered the service', () => {
    const service = app.service('refresh-data');

    assert.ok(service, 'Registered the service');
  });
});
