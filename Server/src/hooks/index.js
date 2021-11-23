const { performance } = require('perf_hooks');
const { time, fR, fY, fB } = require('../utils/utils');

module.exports = {

  log: (hookContext) => {
    if (hookContext.type == 'before') hookContext.params.beforeTs = performance.now();
    else if (hookContext.type == 'after') console.log(`${time.datetocompact(Date.now())} | (${(performance.now()-hookContext.params.beforeTs).toFixed(2)}ms) ${fB(hookContext.method.toUpperCase())} ${hookContext.path}${hookContext.id ? '/'+fY(hookContext.id) : ''} (provider: ${hookContext.params?.provider || 'internal'})`);
    else if (hookContext.type == 'error') console.log(`${time.datetocompact(Date.now())} | (${(performance.now()-hookContext.params.beforeTs).toFixed(2)}ms) ${fR(hookContext.method.toUpperCase())} ${hookContext.path}${hookContext.id ? '/'+fY(hookContext.id) : ''} (provider: ${hookContext.params?.provider || 'internal'})`);
    return hookContext;
  },

}