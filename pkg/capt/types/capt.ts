import type { ClusterProvisionerContext } from '@shell/core/types';

export const TKE_MACHINE_POOL_SCHEMA = 'infrastructure.cluster.x-k8s.io.tkemanagedmachinepool';
export const TKE_CLUSTER_SCHEMA = 'infrastructure.cluster.x-k8s.io.tkecluster';
export const TKE_INFRA_API_GROUP = 'infrastructure.cluster.x-k8s.io';
export const TKE_INFRA_API_VERSION = 'infrastructure.cluster.x-k8s.io/v1beta1';
export const CAPI_CLUSTER_SCHEMA = 'cluster.x-k8s.io.cluster';
export const CAPI_MACHINE_POOL_SCHEMA = 'cluster.x-k8s.io.machinepool';
// Rancher 2.15 / CAPI >= 1.13 stores Cluster & MachinePool as v1beta2 (refs use apiGroup).
export const CAPI_API_VERSION = 'cluster.x-k8s.io/v1beta2';
export const RANCHER_AUTO_IMPORT_LABEL = 'cluster-api.cattle.io/rancher-auto-import';
// Avoid 192.168.0.0/16 — it commonly conflicts with Tencent VPC CIDRs.
export const DEFAULT_POD_CIDR = '172.16.0.0/16';
export const CAPI_CLUSTER_KIND = 'Cluster';
export const CAPI_MACHINE_POOL_KIND = 'MachinePool';
export const TKE_CLUSTER_KIND = 'TKECluster';
export const TKE_MACHINE_POOL_KIND = 'TKEManagedMachinePool';

/** Custom Manager nav page (does not override Rancher's CAPI Cluster list). */
export const CAPT_CLUSTERS_PAGE = 'capt-clusters';
export const CAPT_CLUSTERS_ROUTE = 'c-cluster-manager-capt-clusters';
export const CAPT_CLUSTERS_CREATE_ROUTE = 'c-cluster-manager-capt-clusters-create';
export const CAPT_CLUSTERS_EDIT_ROUTE = 'c-cluster-manager-capt-clusters-namespace-id';

export type Translator = (key: string, args?: Record<string, any>) => string;

export interface ResourceMetadata {
  name?: string;
  namespace?: string;
  generateName?: string;
  resourceVersion?: string;
  uid?: string;
  labels?: Record<string, string>;
}

export interface InfrastructureRef {
  kind?: string;
  name?: string;
  namespace?: string;
  apiVersion?: string;
}

export interface EndpointAccess {
  public?: boolean;
  securityGroup?: string;
  private?: boolean;
  subnetID?: string;
  IsExtranet?: boolean;
}

export interface TKEClusterSpec {
  clusterName?: string;
  clusterID?: string;
  region?: string;
  clusterUUID?: string;
  clusterVersion?: string;
  vpcID?: string;
  osName?: string;
  controlPlaneEndpoint?: {
    host?: string;
    port?: number;
  };
  endpointAccess?: EndpointAccess;
}

export interface TKEManagedMachinePoolSpec {
  maxSize?: number;
  minSize?: number;
  subnetIDs?: string[];
  securityGroups?: string[];
  providerIDList?: string[];
  osName?: string;
  instanceType?: string;
  keyIDs?: string[];
}

export interface InfrastructureClusterResource {
  id?: string;
  type?: string;
  metadata: ResourceMetadata;
  spec: TKEClusterSpec;
  links?: Record<string, unknown>;
  save: () => Promise<InfrastructureClusterResource>;
  remove?: () => Promise<void>;
}

export interface InfrastructureMachineResource {
  id?: string;
  metadata: ResourceMetadata;
  spec: TKEManagedMachinePoolSpec;
  links?: Record<string, unknown>;
  save: () => Promise<InfrastructureMachineResource>;
  remove?: () => Promise<void>;
}

export interface MachinePool {
  name: string;
  machineConfigRef: InfrastructureRef;
  [key: string]: unknown;
}

export interface RkeConfig {
  infrastructureRef?: InfrastructureRef;
  additionalManifest?: string;
  machineGlobalConfig?: Record<string, unknown>;
  machinePools?: MachinePool[];
}

export interface ClusterValue {
  metadata?: ResourceMetadata;
  spec: {
    rkeConfig?: RkeConfig;
    cloudCredentialSecretName?: string;
    kubernetesVersion?: string;
  };
  save: () => Promise<unknown>;
}

export interface PoolEntry {
  remove?: boolean;
  create?: boolean;
  update?: boolean;
  pool: MachinePool;
  config: InfrastructureMachineResource | null;
  oldConfig?: InfrastructureMachineResource | null;
  capiMachinePool?: any;
}

export interface MachineConfigSchema {
  id?: string;
}

export type StoreContext = Pick<ClusterProvisionerContext, 'dispatch' | 'getters'> & {
  t?: Translator;
  $t?: Translator;
};

export interface CaptSaveOptions {
  clusterName: string;
  namespace?: string;
  infrastructureCluster: InfrastructureClusterResource | null;
  initialInfrastructureCluster?: InfrastructureClusterResource | null;
  pools: PoolEntry[];
  context: StoreContext;
  isEdit?: boolean;
  podCidrBlocks?: string[];
}

export interface SelectOption {
  label: string;
  value: string;
  raw?: any;
  group?: string;
  zone?: string;
}
