const fs = require('fs');
const path = require('path');

/**
 * Extension-only serve only registers packages under this repo's ./pkg.
 * CruImported lives in dashboard/pkg/imported — link it in when @rancher/shell
 * is yarn-linked to the dashboard monorepo so type=imported works locally.
 */
function ensureLinkedDashboardPkg(name) {
  const shellDir = path.join(__dirname, 'node_modules/@rancher/shell');

  if (!fs.existsSync(shellDir)) {
    return;
  }

  const shellRealPath = fs.realpathSync(shellDir);

  // Not yarn-linked — published/CI shell; host Rancher already ships builtins.
  if (shellRealPath === path.resolve(shellDir)) {
    return;
  }

  const src = path.resolve(shellRealPath, '..', 'pkg', name);
  const dest = path.join(__dirname, 'pkg', name);

  if (!fs.existsSync(src)) {
    return;
  }

  try {
    const st = fs.lstatSync(dest);

    if (st.isSymbolicLink() || st.isDirectory()) {
      return;
    }
  } catch (e) {
    // dest does not exist
  }

  fs.symlinkSync(src, dest, 'dir');
  // eslint-disable-next-line no-console
  console.log(`[capt] linked pkg/${ name } -> ${ src }`);
}

ensureLinkedDashboardPkg('imported');

const config = require('@rancher/shell/vue.config'); // eslint-disable-line @typescript-eslint/no-var-requires

const vueConfig = config(__dirname, {
  excludes: [],
  // excludes: ['fleet', 'example']
});

function addLinkedDashboardNodeModules(webpackConfig) {
  const shellDir = path.join(__dirname, 'node_modules/@rancher/shell');

  if (!fs.existsSync(shellDir)) {
    return;
  }

  const shellRealPath = fs.realpathSync(shellDir);

  if (shellRealPath === path.resolve(shellDir)) {
    return;
  }

  const dashboardNodeModules = path.resolve(shellRealPath, '..', 'node_modules');
  const dashboardImported = path.resolve(shellRealPath, '..', 'pkg', 'imported');

  webpackConfig.resolve = webpackConfig.resolve || {};
  webpackConfig.resolve.modules = webpackConfig.resolve.modules || ['node_modules'];
  webpackConfig.resolve.alias = webpackConfig.resolve.alias || {};

  if (fs.existsSync(dashboardNodeModules) && !webpackConfig.resolve.modules.includes(dashboardNodeModules)) {
    webpackConfig.resolve.modules.push(dashboardNodeModules);
  }

  // CruImported and its children import via @pkg/imported/...
  if (fs.existsSync(dashboardImported)) {
    webpackConfig.resolve.alias['@pkg/imported'] = dashboardImported;
  }
}

/**
 * ts-loader pins rootDir to this repo. Linked dashboard sources (imported +
 * rancher-components) sit outside it and fail with TS6059. Widen rootDir to
 * the common ancestor of this repo and the linked dashboard.
 */
function commonAncestor(paths) {
  const split = paths.map((p) => path.resolve(p).split(path.sep));
  const minLen = Math.min(...split.map((parts) => parts.length));
  const shared = [];

  for (let i = 0; i < minLen; i++) {
    if (split.every((parts) => parts[i] === split[0][i])) {
      shared.push(split[0][i]);
    } else {
      break;
    }
  }

  if (shared.length <= 1) {
    return path.resolve(__dirname, '..');
  }

  return path.join(path.sep, ...shared.slice(1));
}

function widenTsLoaderRootDir(webpackConfig, extraRoots) {
  const rootDir = commonAncestor([__dirname, ...extraRoots]);

  const visit = (rules) => {
    if (!Array.isArray(rules)) {
      return;
    }

    rules.forEach((rule) => {
      visit(rule.oneOf);
      visit(rule.rules);

      const uses = [].concat(rule.use || []);

      uses.forEach((use) => {
        if (!use || !use.loader || !String(use.loader).includes('ts-loader') || !use.options) {
          return;
        }

        use.options.compilerOptions = {
          ...(use.options.compilerOptions || {}),
          rootDir,
        };
      });
    });
  };

  visit(webpackConfig.module && webpackConfig.module.rules);
}

function linkedDashboardRoot() {
  const shellDir = path.join(__dirname, 'node_modules/@rancher/shell');

  if (!fs.existsSync(shellDir)) {
    return null;
  }

  const shellRealPath = fs.realpathSync(shellDir);

  if (shellRealPath === path.resolve(shellDir)) {
    return null;
  }

  return path.resolve(shellRealPath, '..');
}

const originalConfigureWebpack = vueConfig.configureWebpack;

vueConfig.configureWebpack = (webpackConfig) => {
  if (typeof originalConfigureWebpack === 'function') {
    originalConfigureWebpack(webpackConfig);
  }

  addLinkedDashboardNodeModules(webpackConfig);

  const dashboardRoot = linkedDashboardRoot();

  if (dashboardRoot) {
    widenTsLoaderRootDir(webpackConfig, [dashboardRoot]);
  }
};

module.exports = vueConfig;
