import { importTypes } from '@rancher/auto-import';
import { IExtension, ModelExtensionConstructor } from '@shell/core/types';
import { StandardProductNames } from '@shell/core/plugin-products-external';
import type { ProductChildCustomPage } from '@shell/core/plugin-products-external';
import { CAPTProvisioner } from './provisioner';
import { CAPTRKE2Cluster } from './model-extension/provisioning.cattle.io.cluster';
import {
  CAPT_CLUSTERS_CREATE_ROUTE,
  CAPT_CLUSTERS_EDIT_ROUTE,
  CAPT_CLUSTERS_PAGE,
} from './types/capt';

export default function(plugin: IExtension): void {
  importTypes(plugin);

  plugin.metadata = require('./package.json');

  plugin.register('provisioner', CAPTProvisioner.ID, CAPTProvisioner);

  plugin.metadata.icon = require('./assets/tke.svg');
  plugin.register('machine-config', CAPTProvisioner.ID, () => import('./machine-config/capt.vue'));

  plugin.addModelExtension('provisioning.cattle.io.cluster', CAPTRKE2Cluster as ModelExtensionConstructor);

  // Dedicated Hosted CAPI (CAPT) list — does not replace Rancher's default CAPI Clusters page.
  const captClustersPage: ProductChildCustomPage = {
    name:      CAPT_CLUSTERS_PAGE,
    labelKey:  'capt.hostedNav.label',
    component: () => import('./pages/CaptClusters.vue'),
    sideMenu:  { weight: 96 },
  };

  plugin.extendProduct(StandardProductNames.MANAGER, [captClustersPage]);

  plugin.addRoutes([
    {
      name:      CAPT_CLUSTERS_CREATE_ROUTE,
      path:      `/c/:cluster/manager/${ CAPT_CLUSTERS_PAGE }/create`,
      component: () => import('./pages/CaptClusterCreateEdit.vue'),
      meta:      { product: 'manager' },
    },
    {
      name:      CAPT_CLUSTERS_EDIT_ROUTE,
      path:      `/c/:cluster/manager/${ CAPT_CLUSTERS_PAGE }/:namespace/:id`,
      component: () => import('./pages/CaptClusterCreateEdit.vue'),
      meta:      { product: 'manager' },
    },
  ]);
}
