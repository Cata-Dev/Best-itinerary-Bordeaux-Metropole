const { performance } = require('perf_hooks');
const { time, fR, fY, fB } = require('../utils/utils');

module.exports = {

  log: (hookContext) => {
    if (hookContext.type == 'before') hookContext.params.initialTs = performance.now();
    else if (hookContext.type == 'after') console.log(`${time.datetocompact3(performance.timeOrigin+hookContext.params.initialTs, true)} ⟾ ${time.datetocompact3(Date.now(), true)} (${(performance.now()-hookContext.params.initialTs).toFixed(2)}ms) | ${fB(hookContext.method.toUpperCase())} ${hookContext.path}${hookContext.id ? '/'+fY(hookContext.id) : ''} (provider: ${hookContext.params?.provider || 'internal'})`);
    else if (hookContext.type == 'error') console.log(`${time.datetocompact3(performance.timeOrigin+hookContext.params.initialTs, true)} ⟾ ${time.datetocompact3(Date.now(), true)} (${(performance.now()-hookContext.params.initialTs).toFixed(2)}ms) | ${fR(hookContext.method.toUpperCase())} ${hookContext.path}${hookContext.id ? '/'+fY(hookContext.id) : ''} (provider: ${hookContext.params?.provider || 'internal'})`);
    return hookContext;
  },

}