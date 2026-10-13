import { ModelExtensionContext, IClusterModelExtension } from '@shell/core/types';
import { detailTabs, PROVIDER } from '../provisioner';

type ICluster = any;

function isTurtlesImportedCapt(cluster: any): boolean {
  if (!cluster) {
    return false;
  }

  const labels = cluster.labels || cluster.metadata?.labels || {};
  const annotations = cluster.annotations || cluster.metadata?.annotations || {};
  const machineProvider = (cluster.machineProvider || '').toLowerCase();

  // Do NOT use bare isImported — that would hijack every imported cluster (e.g. test2).
  if (labels['provider.cattle.io'] === 'tke') {
    return true;
  }

  if (annotations['ui.rancher/provider'] === PROVIDER) {
    return true;
  }

  if (machineProvider === PROVIDER || machineProvider === 'tke') {
    return true;
  }

  return false;
}

/**
 * Turtles-imported CAPT: re-enable Edit and open CruImported (Day2 / Registries).
 * Requires the Rancher `imported` UI package (linked automatically for local serve).
 */
export class CAPTRKE2Cluster implements IClusterModelExtension {
  private context: ModelExtensionContext;

  constructor(context: ModelExtensionContext) {
    this.context = context;
  }

  useFor(cluster: ICluster) {
    if (isTurtlesImportedCapt(cluster)) {
      return true;
    }

    return cluster?.machineProvider === PROVIDER;
  }

  get detailTabs(): any {
    return detailTabs;
  }

  availableActions(cluster: any, actions: any[]): any[] | undefined {
    if (!isTurtlesImportedCapt(cluster)) {
      return actions;
    }

    const provCluster = cluster;

    return actions.map((action) => {
      if (action.action !== 'goToEdit' && action.action !== 'goToViewConfig') {
        return action;
      }

      const isView = action.action === 'goToViewConfig';

      return {
        ...action,
        enabled: true,
        invoke(this: any) {
          const target = provCluster;

          if (!target) {
            return;
          }

          // Builtin EditImportedGenericCluster (id `imported`) → CruImported.
          const query = { type: 'imported' };

          if (isView) {
            target.goToViewConfig?.(query);
          } else {
            target.goToEdit?.(query);
          }
        },
      };
    });
  }

  machineProviderDisplay(_cluster: any): string {
    try {
      return this.context.t('capt.label');
    } catch (e) {
      return 'CAPI TKE';
    }
  }
}
