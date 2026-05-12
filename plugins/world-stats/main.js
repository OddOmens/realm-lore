export default {
  onLoad(api) {
    api.log('World Stats loaded.');

    api.registerPanel({
      panelId:   'world-stats',
      panelFile: 'panel.jsx',
      navLabel:  'World Stats',
      navIcon:   'BarChart2',
    });
  },

  onUnload() {},
};
