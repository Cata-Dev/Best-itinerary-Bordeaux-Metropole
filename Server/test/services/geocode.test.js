const assert = require('assert');
const app = require('../../src/app');

describe('\'geocode\' service', () => {
  it('registered the service', () => {
    const service = app.service('geocode');

    assert.ok(service, 'Registered the service');
  });
});
