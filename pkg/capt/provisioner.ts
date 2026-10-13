import { IClusterProvisioner, ClusterProvisionerContext } from '@shell/core/types';
import {
  createMachinePoolMachineConfig, initInfrastructureCluster, saveMachinePoolConfigs, cleanupMachinePoolConfigs, saveInfrastructureCluster, saveCaptResources
} from './utils';
import { TKE_CLUSTER_SCHEMA, TKE_MACHINE_POOL_SCHEMA, InfrastructureClusterResource } from './types/capt';
import CruCapt from './components/CruCapt.vue';
import InfrastructureClusterConfiguration from './components/InfrastructureClusterConfiguration.vue';
import ProvisioningClusterConfiguration from './components/ProvisioningClusterConfiguration.vue';
import { detailTabs } from './detail-tabs';

export { detailTabs };

export const PROVIDER = 'tkemanagedmachinepool';

export class CAPTProvisioner implements IClusterProvisioner {
  static ID = PROVIDER

  constructor(private context: ClusterProvisionerContext) {
    context.dispatch('plugins/mapDriver', { name: this.id, to: 'tke' }, { root: true });
  }

  get id(): string {
    return CAPTProvisioner.ID;
  }

  get machineConfigSchema(): { [key: string]: any } {
    return this.context.getters['management/schemaFor'](TKE_MACHINE_POOL_SCHEMA, true, false);
  }

  get clusterSchema(): { [key: string]: any } {
    return this.context.getters['management/schemaFor'](TKE_CLUSTER_SCHEMA, true, false);
  }

  get createMachinePoolMachineConfig(): () => Promise<{[key: string]: any}> {
    return async() => await createMachinePoolMachineConfig(this.machineConfigSchema, this.context);
  }

  get saveMachinePoolConfigs(): (pools: any[], cluster: any) => Promise<void> {
    return async(pools: any[], cluster: any) => await saveMachinePoolConfigs(pools, cluster, this.context);
  }

  get cleanupMachinePools(): (pools: any[]) => Promise<void> {
    return async(pools: any[]) => await cleanupMachinePoolConfigs(pools);
  }

  get saveInfrastructureCluster(): (value: any, infrastructureCluster: any, isEdit: boolean, initialInfrastructureCluster?: any) => Promise<void> {
    return async(value, infrastructureCluster, isEdit, initialInfrastructureCluster) => {
      await saveInfrastructureCluster(value, infrastructureCluster, this.context, isEdit, initialInfrastructureCluster);
    };
  }

  get initInfrastructureCluster(): (value: any) => Promise<InfrastructureClusterResource | {} | undefined> {
    const clusterSchemaType = this.clusterSchema?.id || TKE_CLUSTER_SCHEMA;

    return async(value) => await initInfrastructureCluster(value, clusterSchemaType, this.context);
  }

  get icon(): any {
    return require('./assets/tke.svg');
  }

  get group(): string {
    return 'capi';
  }

  get label(): string {
    return this.context.t('capt.label');
  }

  get description(): string {
    return this.context.t('capt.description');
  }

  get component(): any {
    return CruCapt;
  }

  get hidden(): boolean {
    return false;
  }

  get extensionInfrastructureSection(): any {
    return InfrastructureClusterConfiguration;
  }

  get extensionInfrastructureSectionProps(): (context: {
    infrastructureCluster?: any;
    mode?: string;
    credentialId?: string;
    provisioningCluster?: any;
  }) => Record<string, any> {
    return ({
      infrastructureCluster,
      mode,
      credentialId,
      provisioningCluster
    }) => ({
      value: infrastructureCluster,
      mode,
      credentialId,
      provisioningCluster,
    });
  }

  get extensionProvisioningSection(): any {
    return ProvisioningClusterConfiguration;
  }

  get extensionProvisioningSectionProps(): (context: {
    mode?: string;
    provisioningCluster?: any;
  }) => Record<string, any> {
    return ({
      mode,
      provisioningCluster
    }) => ({
      value: provisioningCluster,
      mode,
    });
  }

  get detailTabs(): any {
    return detailTabs;
  }

  get showImport(): boolean {
    return false;
  }

  get isUpstreamCAPIProvider(): boolean {
    return true;
  }

  /**
   * Turtles-imported PCs may resolve to this provisioner via annotation/provider.
   * Force adjustSubTypeForHostedProvisioner back to `imported` so Cluster Management
   * Edit does not open CruCapt (Hosted CAPI only).
   */
  shouldUseProvisionerEditForm(): boolean {
    return false;
  }

  registerSaveHooks(
    registerBeforeHook: (fn: () => Promise<void>, name: string, priority?: number) => void,
  ): void {
    const context = this.context;

    // Fallback if the RKE2 wizard path is used without CruCapt: still write CAPI resources.
    registerBeforeHook(async function(this: any) {
      const clusterName = this.value?.metadata?.name;

      if (!clusterName) {
        return;
      }

      await saveCaptResources({
        clusterName,
        namespace:                      this.value.metadata?.namespace,
        infrastructureCluster:        this.infrastructureCluster,
        initialInfrastructureCluster: this.infrastructureClusterInitialValue,
        pools:                        this.machinePools || [],
        context,
        isEdit:                       this.isEdit,
      });
    }, 'save-capt-capi-resources', 3);
  }

  registerInitHooks(registerInitHook: (fn: () => Promise<void>, name: string) => void, cluster: any): void {
    const runInitInfrastructureCluster = this.initInfrastructureCluster;
    const context = this.context;

    registerInitHook(async function(this: any) {
      this.infrastructureCluster = await runInitInfrastructureCluster(cluster);

      const loaded = this.infrastructureCluster;

      this.infrastructureClusterInitialValue = loaded && typeof loaded.toJSON === 'function' ? await context.dispatch('management/clone', { resource: loaded }) : null;
    }, 'init-infrastructure-cluster-for-capi');
  }
}
