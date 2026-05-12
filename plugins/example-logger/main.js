export default {
  onLoad(api) {
    api.log('Example Logger loaded. Will log every entity save to .plugin-logs/example-logger.log');
    api.writeLog('Plugin started.');

    let saveCount = 0;

    api.registerHook('onEntitySave', (entity) => {
      saveCount++;
      const msg = `#${saveCount} saved — type: ${entity.type}, name: "${entity.name}", world: ${entity.world}`;
      api.log(msg);
      api.writeLog(msg);
    });
  },

  onUnload() {},
};
