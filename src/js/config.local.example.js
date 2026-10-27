/*
 * Copy this to js/config.local.js and put your own values in it. That file is gitignored, so
 * anything here stays out of the repository while still reaching both `npm run preview` and the
 * packaged .wgt — nothing to strip before a push, nothing to put back before a build.
 *
 * Keys are merged over js/config.js one level deep, so you can set weather.latitude without
 * restating the rest of the block. Arrays (apps, inputs) replace the default wholesale.
 */
window.LAUNCHER_LOCAL = {
    // Open-Meteo defaults. Settings ▸ Weather on the TV can override these without a rebuild.
    // Named presets here appear as rows on the Weather page; each must have a label and both
    // coordinates. This file is the place for values specific to your own setup.
    // weather: {
    //     latitude: 20, longitude: 2,
    //     presets: [{ label: 'Home', latitude: 20, longitude: 2 }]
    // },

    // Receives Lab logs; see scripts/devlog-server.mjs.
    // devLogUrl: null,

    // locale: 'fr-FR',
};
