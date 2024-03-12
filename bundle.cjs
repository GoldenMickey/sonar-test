const esbuild = require('esbuild');

esbuild.buildSync({
    entryPoints: ['handler.ts'],
    platform: 'node',
    target: 'es2018',
    bundle: true,
    format: 'cjs',
    sourcemap: 'external',
    outdir: 'bundle',
    absWorkingDir: `${__dirname}/src`,
    metafile: true
});