import { normalizeName } from '@shell/utils/kube';
import { DEFAULT_WORKSPACE } from '@shell/config/types';
import { set, diff, isEmpty } from '@shell/utils/object';
import { handleConflict } from '@shell/plugins/dashboard-store/normalize';
import {
  TKE_MACHINE_POOL_SCHEMA,
  TKE_CLUSTER_SCHEMA,
  TKE_INFRA_API_GROUP,
  TKE_INFRA_API_VERSION,
  CAPI_CLUSTER_SCHEMA,
  CAPI_MACHINE_POOL_SCHEMA,
  CAPI_API_VERSION,
  CAPI_CLUSTER_KIND,
  CAPI_MACHINE_POOL_KIND,
  TKE_CLUSTER_KIND,
  TKE_MACHINE_POOL_KIND,
  RANCHER_AUTO_IMPORT_LABEL,
  DEFAULT_POD_CIDR,
  InfrastructureClusterResource,
  InfrastructureMachineResource,
  ClusterValue,
  MachineConfigSchema,
  PoolEntry,
  StoreContext,
  CaptSaveOptions,
} from './types/capt';

export function tkeClusterResourceName(clusterName: string): string {
  return `${ clusterName }-tke`;
}

export function machinePoolResourceName(clusterName: string, poolName: string): string {
  return `${ clusterName }-${ poolName }`.slice(0, 63).toLowerCase();
}

function formatErrorMessage(context: StoreContext, key: string, e?: any): string {
  const error = e instanceof Error || e?.message ? e.message : String(e);
  const t = context.t || context.$t;

  return t ? t(key, { error }) : `${ key }: ${ error }`;
}

function isConflictError(e: any): boolean {
  const code = e?.status ?? e?._status ?? e?.code;
  const message = (e?.message || e?._message || String(e || '')).toLowerCase();

  return code === 409 || code === '409' || message.includes('the object has been modified');
}

async function ensureSteveResource(
  resource: any,
  type: string,
  context: StoreContext,
  metadata: { name?: string; namespace?: string; labels?: Record<string, string> } = {},
): Promise<any> {
  if (resource && typeof resource.save === 'function') {
    return resource;
  }

  const data = serializeResource(resource) || {};
  const created = await context.dispatch('management/create', {
    type:     data.type || type,
    metadata: {
      ...(data.metadata || {}),
      ...metadata,
      namespace: metadata.namespace || data.metadata?.namespace || DEFAULT_WORKSPACE,
      name:      metadata.name || data.metadata?.name,
      labels:    {
        ...(data.metadata?.labels || {}),
        ...(metadata.labels || {}),
      },
    },
    spec: data.spec || {},
  });

  return created;
}

function cleanSteveCreatePayload(type: string, apiVersion: string, kind: string, resource: {
  metadata?: Record<string, any>;
  spec?: Record<string, any>;
}): Record<string, any> {
  const metadata: Record<string, any> = {
    name:      resource.metadata?.name,
    namespace: resource.metadata?.namespace,
  };

  if (resource.metadata?.labels && Object.keys(resource.metadata.labels).length) {
    metadata.labels = resource.metadata.labels;
  }

  if (resource.metadata?.annotations && Object.keys(resource.metadata.annotations).length) {
    metadata.annotations = resource.metadata.annotations;
  }

  return {
    type,
    apiVersion,
    kind,
    metadata,
    spec: resource.spec || {},
  };
}

async function resourceExists(type: string, namespace: string, name: string, context: StoreContext): Promise<boolean> {
  try {
    await context.dispatch('management/find', {
      type,
      id:  `${ namespace }/${ name }`,
      opt: { force: true, watch: false },
    });

    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Create/update namespaced CAPI resources via Steve with an explicit POST body.
 * Avoids Resource.save() accidentally treating a new named object as an update.
 */
async function upsertNamespacedSteveResource(options: {
  type: string;
  apiVersion: string;
  kind: string;
  namespace: string;
  name: string;
  spec: Record<string, any>;
  labels?: Record<string, string>;
  context: StoreContext;
  isEdit?: boolean;
}): Promise<any> {
  const {
    type, apiVersion, kind, namespace, name, spec, labels, context, isEdit = false
  } = options;

  const schema = context.getters['management/schemaFor'](type);

  if (!schema?.links?.collection) {
    throw new Error(`Schema or collection link missing for ${ type }`);
  }

  const exists = await resourceExists(type, namespace, name, context);
  const payload = cleanSteveCreatePayload(type, apiVersion, kind, {
    metadata: {
      name, namespace, labels
    },
    spec,
  });

  // Prefer collection URL without /namespace — Steve resolves namespace from metadata.
  // Fallback to namespaced collection URL used by Resource._collectionUrl().
  const urls = [
    schema.links.collection,
    `${ schema.links.collection.replace(/\/$/, '') }/${ namespace }`,
  ];

  let lastError: any;

  if (exists || isEdit) {
    try {
      const current = await context.dispatch('management/find', {
        type,
        id:  `${ namespace }/${ name }`,
        opt: { force: true, watch: false },
      });
      const model = await context.dispatch('management/clone', { resource: current });

      model.metadata = model.metadata || {};
      model.metadata.labels = {
        ...(model.metadata.labels || {}),
        ...(labels || {}),
      };
      model.spec = spec;

      return await model.save();
    } catch (e) {
      lastError = e;
    }
  }

  for (const url of urls) {
    try {
      const res = await context.dispatch('management/request', {
        opt: {
          url,
          method:  'post',
          data:    payload,
          headers: {
            'content-type': 'application/json',
            accept:         'application/json',
          },
        },
        type,
      });

      if (res && res.kind !== 'Table') {
        await context.dispatch('management/load', { data: res, invalidatePageCache: false });
      }

      return res;
    } catch (e) {
      lastError = e;
    }
  }

  throw lastError;
}

async function saveWithConflictResolution(
  initial: InfrastructureClusterResource | null | undefined,
  userValue: InfrastructureClusterResource,
  context: StoreContext,
  attempts = 3,
): Promise<InfrastructureClusterResource> {
  const type = (userValue as any).type || TKE_CLUSTER_SCHEMA;
  const id = `${ userValue.metadata.namespace }/${ userValue.metadata.name }`;
  let resource = await ensureSteveResource(userValue, type, context, {
    name:      userValue.metadata?.name,
    namespace: userValue.metadata?.namespace,
    labels:    userValue.metadata?.labels,
  });

  let lastError: any;

  for (let depth = 0; depth < attempts; depth++) {
    try {
      return await resource.save();
    } catch (e) {
      lastError = e;

      if (!isConflictError(e) || !resource.metadata?.name) {
        throw e;
      }

      const server = await context.dispatch('management/find', {
        type,
        id,
        opt: { force: true, watch: false },
      }) as InfrastructureClusterResource;

      if (initial && typeof (initial as any).toJSON === 'function') {
        const conflicts = await handleConflict(
          initial,
          resource,
          server,
          { dispatch: context.dispatch, getters: context.getters },
          'management',
        );

        if (conflicts !== false) {
          throw new Error(Array.isArray(conflicts) ? conflicts.join(', ') : String(conflicts));
        }
      } else {
        resource.metadata.resourceVersion = server?.metadata?.resourceVersion;
      }
    }
  }

  throw lastError;
}

async function patchInfrastructureClusterChanges(
  initial: InfrastructureClusterResource | null | undefined,
  userValue: InfrastructureClusterResource,
  context: StoreContext,
): Promise<boolean> {
  if (!initial || typeof (initial as any).toJSON !== 'function' || typeof (userValue as any).patch !== 'function') {
    await saveWithConflictResolution(initial, userValue, context);

    return true;
  }

  const initialClean = await context.dispatch('management/cleanForDiff', (initial as any).toJSON());
  const userClean = await context.dispatch('management/cleanForDiff', (userValue as any).toJSON());

  const patch = diff(initialClean, userClean);

  delete patch.type;
  delete patch.apiVersion;
  delete patch.kind;
  delete patch.id;
  delete patch.metadata;

  if (isEmpty(patch)) {
    return false;
  }

  await (userValue as any).patch(patch, { headers: { 'content-type': 'application/merge-patch+json' } });

  return true;
}

function serializeResource(resource: any): any {
  return typeof resource?.toJSON === 'function' ? resource.toJSON() : resource;
}

async function machineConfigWasModified(entry: PoolEntry, context: StoreContext): Promise<boolean> {
  const config = entry.config as any;

  if (!config?.metadata?.name) {
    return true;
  }

  try {
    const type = config.type || config._type || TKE_MACHINE_POOL_SCHEMA;
    const id = config.id || `${ config.metadata.namespace || DEFAULT_WORKSPACE }/${ config.metadata.name }`;
    const server = await context.dispatch('management/find', {
      type,
      id,
      opt: { force: true, watch: false },
    });

    const serverClean = await context.dispatch('management/cleanForDiff', serializeResource(server));
    const configClean = await context.dispatch('management/cleanForDiff', serializeResource(config));

    return !isEmpty(diff(serverClean, configClean));
  } catch (e) {
    return true;
  }
}

export async function initInfrastructureCluster(value: ClusterValue, clusterSchema: string, context: StoreContext): Promise<InfrastructureClusterResource | {} | undefined> {
  let config: InfrastructureClusterResource | undefined;
  let configMissing = false;
  const namespace = value.metadata?.namespace || DEFAULT_WORKSPACE;
  const clusterName = value.metadata?.name;

  if (!clusterSchema) {
    // eslint-disable-next-line no-console
    console.warn('initCapiCluster: missing clusterSchema, cluster object creation skipped');
  }

  if (clusterSchema && context.getters['management/canList'](clusterSchema)) {
    try {
      const infraRef = value.spec?.rkeConfig?.infrastructureRef;
      const tkeName = clusterName ? tkeClusterResourceName(clusterName) : undefined;

      if (infraRef?.name && infraRef?.namespace) {
        config = await context.dispatch('management/find', {
          type: clusterSchema,
          id:   `${ infraRef.namespace }/${ infraRef.name }`,
        }) as InfrastructureClusterResource | undefined;
      } else if (tkeName) {
        try {
          config = await context.dispatch('management/find', {
            type: clusterSchema,
            id:   `${ namespace }/${ tkeName }`,
          }) as InfrastructureClusterResource | undefined;
        } catch (e) {
          config = undefined;
        }
      }

      if (!config && clusterName) {
        config = await context.dispatch('management/find', {
          type:     clusterSchema,
          selector: `cluster.x-k8s.io/cluster-name=${ clusterName }`,
        }) as InfrastructureClusterResource | undefined;
      }

      if (!config) {
        configMissing = true;
      }
    } catch (e) {
      configMissing = true;
    }
    if (configMissing) {
      try {
        config = await context.dispatch('management/create', {
          type:     clusterSchema,
          metadata: { namespace }
        }) as InfrastructureClusterResource;
      } catch (e) {
        throw new Error(formatErrorMessage(context, 'capt.errors.creatingInfrastructureClusterConfig', e));
      }
    }
    if (config && typeof (config as any).toJSON === 'function') {
      config = await context.dispatch('management/clone', { resource: config }) as InfrastructureClusterResource;
    }

    if (config) {
      config.spec = removeEmptyFields(config.spec) || {};
    }

    return config;
  }

  throw new Error(formatErrorMessage(context, 'capt.errors.creatingInfrastructureClusterConfig', 'TKECluster schema is unavailable'));
}

export async function loadCapiMachinePools(clusterName: string, namespace: string, context: StoreContext): Promise<PoolEntry[]> {
  if (!clusterName || !context.getters['management/canList']?.(CAPI_MACHINE_POOL_SCHEMA)) {
    return [];
  }

  let machinePools: any[] = [];

  try {
    machinePools = await context.dispatch('management/findAll', {
      type: CAPI_MACHINE_POOL_SCHEMA,
      opt:  {
        force:   true,
        watch:   false,
        filter: {
          'spec.clusterName': clusterName,
          namespace,
        },
      },
    }) || [];
  } catch (e) {
    try {
      const all = await context.dispatch('management/findAll', {
        type: CAPI_MACHINE_POOL_SCHEMA,
        opt:  { force: true, watch: false },
      }) || [];

      machinePools = all.filter((mp: any) => mp.spec?.clusterName === clusterName && mp.metadata?.namespace === namespace);
    } catch (err) {
      return [];
    }
  }

  const out: PoolEntry[] = [];

  for (const mp of machinePools) {
    const infraName = mp.spec?.template?.spec?.infrastructureRef?.name;
    let config: InfrastructureMachineResource | null = null;

    if (infraName && context.getters['management/canList'](TKE_MACHINE_POOL_SCHEMA)) {
      try {
        const found = await context.dispatch('management/find', {
          type: TKE_MACHINE_POOL_SCHEMA,
          id:   `${ namespace }/${ infraName }`,
        });

        config = found ? await context.dispatch('management/clone', { resource: found }) : null;
      } catch (e) {
        config = null;
      }
    }

    const poolName = (mp.metadata?.name || '').replace(new RegExp(`^${ clusterName }-`), '') || mp.metadata?.name || 'pool';

    out.push({
      remove:          false,
      create:          false,
      update:          true,
      pool:            {
        name:             poolName,
        quantity:         mp.spec?.replicas ?? 1,
        machineConfigRef: {
          name: infraName,
          kind: 'TKEManagedMachinePool',
          apiVersion: TKE_INFRA_API_VERSION,
        },
      },
      config,
      capiMachinePool: mp,
    });
  }

  return out;
}

export async function createMachinePoolMachineConfig(machineConfigSchema: MachineConfigSchema | undefined, context: StoreContext): Promise<InfrastructureMachineResource | Record<string, never>> {
  const machineConfigType = machineConfigSchema?.id || TKE_MACHINE_POOL_SCHEMA;

  await context.dispatch('management/waitForSchema', { type: machineConfigType });

  const createConfig = await context.dispatch('management/create', {
    type:     machineConfigType,
    metadata: { namespace: DEFAULT_WORKSPACE }
  }) as InfrastructureMachineResource | undefined;

  const config = createConfig || {};

  return config;
}

export async function saveMachinePoolConfigs(pools: PoolEntry[], cluster: ClusterValue, context: StoreContext): Promise<void> {
  const clusterName = cluster.metadata?.name || 'cluster';
  const namespace = cluster.metadata?.namespace || DEFAULT_WORKSPACE;

  await saveTkeManagedMachinePools(pools, clusterName, namespace, context);
}

async function saveTkeManagedMachinePools(
  pools: PoolEntry[],
  clusterName: string,
  namespace: string,
  context: StoreContext,
): Promise<void> {
  for (const entry of pools) {
    if (entry.remove) {
      continue;
    }

    entry.pool.name = normalizeName(entry.pool.name) || 'pool';
    const resourceName = machinePoolResourceName(clusterName, entry.pool.name);

    try {
      if (!entry.config) {
        throw new Error(`Missing machine config for pool "${ entry.pool.name }"`);
      }

      entry.config.metadata = entry.config.metadata || {};
      entry.config.metadata.namespace = namespace;
      entry.config.metadata.name = resourceName;
      entry.config.metadata.labels = {
        ...(entry.config.metadata.labels || {}),
        'cluster.x-k8s.io/cluster-name': clusterName,
      };

      const config = await ensureSteveResource(entry.config, TKE_MACHINE_POOL_SCHEMA, context, {
        name:      resourceName,
        namespace,
        labels:    entry.config.metadata.labels,
      });

      if (!config) {
        throw new Error(`Missing machine config for pool "${ entry.pool.name }"`);
      }

      entry.config = config;

      if (entry.create || !config.id) {
        const neu = await config.save();

        entry.config = neu;
        entry.pool.machineConfigRef = {
          ...(entry.pool.machineConfigRef || {}),
          name:       neu.metadata.name,
          kind:       'TKEManagedMachinePool',
          apiVersion: TKE_INFRA_API_VERSION,
        };
        entry.create = false;
        entry.update = true;
      } else if (entry.update) {
        if (!await machineConfigWasModified(entry, context)) {
          continue;
        }

        // Managed machine pools are mutable; patch/save in place.
        const neu = await config.save();

        entry.config = neu;
        entry.pool.machineConfigRef = {
          ...(entry.pool.machineConfigRef || {}),
          name:       neu.metadata.name,
          kind:       'TKEManagedMachinePool',
          apiVersion: TKE_INFRA_API_VERSION,
        };
      }
    } catch (e) {
      throw new Error(formatErrorMessage(context, 'capt.errors.savingMachineConfig', e));
    }
  }
}

async function saveCapiMachinePools(
  pools: PoolEntry[],
  clusterName: string,
  namespace: string,
  context: StoreContext,
  isEdit = false,
): Promise<void> {
  for (const entry of pools) {
    if (entry.remove) {
      continue;
    }

    const poolName = normalizeName(entry.pool.name) || 'pool';
    const resourceName = machinePoolResourceName(clusterName, poolName);
    const infraName = entry.config?.metadata?.name || resourceName;
    const minSize = Number(entry.config?.spec?.minSize);
    const maxSize = Number(entry.config?.spec?.maxSize);
    const replicas = Number(entry.pool?.quantity ?? 1);

    entry.pool.quantity = replicas;

    if (Number.isFinite(minSize) && replicas < minSize) {
      throw new Error(formatErrorMessage(context, 'capt.errors.replicasLessThanMin'));
    }

    if (Number.isFinite(maxSize) && replicas > maxSize) {
      throw new Error(formatErrorMessage(context, 'capt.errors.replicasGreaterThanMax'));
    }

    try {
      entry.capiMachinePool = await upsertNamespacedSteveResource({
        type:       CAPI_MACHINE_POOL_SCHEMA,
        apiVersion: CAPI_API_VERSION,
        kind:       CAPI_MACHINE_POOL_KIND,
        namespace,
        name:       resourceName,
        labels:     { 'cluster.x-k8s.io/cluster-name': clusterName },
        context,
        isEdit,
        spec:       {
          clusterName,
          replicas,
          template: {
            spec: {
              clusterName,
              bootstrap: {
                dataSecretName: '',
              },
              // CAPI v1beta2 ContractVersionedObjectReference uses apiGroup (not apiVersion).
              infrastructureRef: {
                apiGroup: TKE_INFRA_API_GROUP,
                kind:     TKE_MACHINE_POOL_KIND,
                name:     infraName,
              },
            },
          },
        },
      });
    } catch (e) {
      throw new Error(formatErrorMessage(context, 'capt.errors.savingCapiMachinePool', e));
    }
  }
}

async function saveCapiCluster(
  clusterName: string,
  namespace: string,
  tkeClusterName: string,
  context: StoreContext,
  podCidrBlocks: string[] = [DEFAULT_POD_CIDR],
  isEdit = false,
): Promise<any> {
  const tkeReady = await resourceExists(TKE_CLUSTER_SCHEMA, namespace, tkeClusterName, context);

  if (!tkeReady) {
    throw new Error(formatErrorMessage(
      context,
      'capt.errors.savingCapiCluster',
      `TKECluster ${ namespace }/${ tkeClusterName } was not found before creating CAPI Cluster`,
    ));
  }

  // CAPI v1beta2 ObjectReference-style refs require apiGroup + kind + name.
  const tkeRef = {
    apiGroup: TKE_INFRA_API_GROUP,
    kind:     TKE_CLUSTER_KIND,
    name:     tkeClusterName,
  };

  try {
    return await upsertNamespacedSteveResource({
      type:       CAPI_CLUSTER_SCHEMA,
      apiVersion: CAPI_API_VERSION,
      kind:       CAPI_CLUSTER_KIND,
      namespace,
      name:       clusterName,
      labels:     { [RANCHER_AUTO_IMPORT_LABEL]: 'true' },
      context,
      isEdit,
      spec:       {
        clusterNetwork: {
          pods: { cidrBlocks: podCidrBlocks },
        },
        infrastructureRef: tkeRef,
        controlPlaneRef:   tkeRef,
      },
    });
  } catch (e) {
    throw new Error(formatErrorMessage(context, 'capt.errors.savingCapiCluster', e));
  }
}

export async function cleanupMachinePoolConfigs(pools: PoolEntry[]): Promise<void> {
  for (const entry of pools) {
    if (entry.remove) {
      if (entry.capiMachinePool?.remove) {
        try {
          await entry.capiMachinePool.remove();
        } catch (e) {
          // eslint-disable-next-line no-console
          console.warn('capt: failed to remove CAPI MachinePool for removed pool', e);
        }
      }

      if (entry.config?.remove) {
        try {
          await entry.config.remove();
        } catch (e) {
          // eslint-disable-next-line no-console
          console.warn('capt: failed to remove machine config for removed pool', e);
        }
      }
    }

    if (entry.oldConfig?.remove) {
      try {
        await entry.oldConfig.remove();
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('capt: failed to remove replaced machine pool', e);
      }
      entry.oldConfig = null;
    }
  }
}

export async function saveInfrastructureCluster(value: ClusterValue, infrastructureCluster: InfrastructureClusterResource | null, context: StoreContext, isEdit = false, initialInfrastructureCluster: InfrastructureClusterResource | null = null): Promise<InfrastructureClusterResource | null> {
  if (!infrastructureCluster) {
    return null;
  }

  const clusterName = normalizeName(value.metadata?.name || '') || value.metadata?.name;
  const namespace = value.metadata?.namespace || DEFAULT_WORKSPACE;

  if (!clusterName) {
    throw new Error(formatErrorMessage(context, 'capt.errors.clusterNameRequired'));
  }

  infrastructureCluster.metadata = infrastructureCluster.metadata || {};
  infrastructureCluster.metadata.namespace = namespace;
  infrastructureCluster.metadata.name = tkeClusterResourceName(clusterName);
  infrastructureCluster.metadata.labels = {
    ...(infrastructureCluster.metadata as any).labels,
    'cluster.x-k8s.io/cluster-name': clusterName,
  };

  if (!isEdit || !infrastructureCluster.spec?.clusterName) {
    set(infrastructureCluster, 'spec.clusterName', clusterName);
  }

  try {
    if (isEdit) {
      await patchInfrastructureClusterChanges(initialInfrastructureCluster, infrastructureCluster, context);

      return infrastructureCluster;
    }

    return await saveWithConflictResolution(initialInfrastructureCluster, infrastructureCluster, context);
  } catch (e) {
    throw new Error(formatErrorMessage(context, 'capt.errors.savingInfrastructureCluster', e));
  }
}

export function isCaptCapiCluster(resource: any): boolean {
  const ref = resource?.spec?.infrastructureRef;

  return ref?.kind === TKE_CLUSTER_KIND ||
    (ref?.apiGroup === TKE_INFRA_API_GROUP && (ref?.kind || '').toLowerCase() === 'tkecluster');
}

async function safeDeleteResource(resource: any): Promise<void> {
  if (!resource) {
    return;
  }

  try {
    if (typeof resource.remove === 'function') {
      await resource.remove();
    }
  } catch (e: any) {
    const status = e?.status ?? e?._status ?? e?.code;

    if (status === 404 || status === '404') {
      return;
    }
    throw e;
  }
}

async function forceRemoveFinalizers(resource: any, context: StoreContext): Promise<void> {
  if (!resource?.metadata?.name) {
    return;
  }

  try {
    const live = await context.dispatch('management/find', {
      type: resource.type,
      id:   resource.id || `${ resource.metadata.namespace }/${ resource.metadata.name }`,
      opt:  { force: true, watch: false },
    });

    if (live?.metadata?.finalizers?.length && typeof live.patch === 'function') {
      await live.patch({ metadata: { finalizers: null } }, { headers: { 'content-type': 'application/merge-patch+json' } });
    }
  } catch (e) {
    // best-effort
  }
}

/**
 * Delete CAPT-related resources for a CAPI Cluster.
 * Order: MachinePool -> TKEManagedMachinePool -> Cluster -> TKECluster
 * (TKECluster last, with finalizer cleanup if it sticks).
 */
export async function deleteCaptClusterResources(cluster: any, context: StoreContext): Promise<void> {
  const clusterName = cluster?.metadata?.name;
  const namespace = cluster?.metadata?.namespace || DEFAULT_WORKSPACE;

  if (!clusterName) {
    return;
  }

  const tkeName = tkeClusterResourceName(clusterName);

  // MachinePools for this cluster
  try {
    const allMp = await context.dispatch('management/findAll', {
      type: CAPI_MACHINE_POOL_SCHEMA,
      opt:  { force: true, watch: false },
    }) || [];

    for (const mp of allMp.filter((m: any) => m.spec?.clusterName === clusterName && m.metadata?.namespace === namespace)) {
      await safeDeleteResource(mp);
    }
  } catch (e) {
    // schema may be missing
  }

  // TKEManagedMachinePools (by naming convention + label)
  try {
    const allPools = await context.dispatch('management/findAll', {
      type: TKE_MACHINE_POOL_SCHEMA,
      opt:  { force: true, watch: false },
    }) || [];

    for (const pool of allPools.filter((p: any) => {
      const ns = p.metadata?.namespace === namespace;
      const byLabel = p.metadata?.labels?.['cluster.x-k8s.io/cluster-name'] === clusterName;
      const byName = (p.metadata?.name || '').startsWith(`${ clusterName }-`);

      return ns && (byLabel || byName);
    })) {
      await safeDeleteResource(pool);
    }
  } catch (e) {
    // ignore
  }

  // CAPI Cluster
  await safeDeleteResource(cluster);

  // TKECluster (may need finalizer strip)
  try {
    let tke: any;

    try {
      tke = await context.dispatch('management/find', {
        type: TKE_CLUSTER_SCHEMA,
        id:   `${ namespace }/${ tkeName }`,
        opt:  { force: true, watch: false },
      });
    } catch (e) {
      tke = null;
    }

    if (tke) {
      try {
        await safeDeleteResource(tke);
      } catch (e) {
        await forceRemoveFinalizers(tke, context);
        await safeDeleteResource(tke);
      }
    }
  } catch (e) {
    // ignore missing
  }
}

/**
 * Persist CAPT as upstream CAPI resources (not provisioning.cattle.io.Cluster):
 * TKECluster -> TKEManagedMachinePool -> Cluster -> MachinePool
 * and label the CAPI Cluster for Turtles auto-import.
 */
export async function saveCaptResources(options: CaptSaveOptions): Promise<void> {
  const {
    infrastructureCluster,
    initialInfrastructureCluster = null,
    pools,
    context,
    isEdit = false,
    podCidrBlocks = [DEFAULT_POD_CIDR],
  } = options;

  const clusterName = normalizeName(options.clusterName) || options.clusterName;
  const namespace = options.namespace || DEFAULT_WORKSPACE;

  if (!clusterName) {
    throw new Error(formatErrorMessage(context, 'capt.errors.clusterNameRequired'));
  }

  const value: ClusterValue = {
    metadata: { name: clusterName, namespace },
    spec:     {},
    save:     async() => undefined,
  };

  const savedInfra = await saveInfrastructureCluster(
    value,
    infrastructureCluster,
    context,
    isEdit,
    initialInfrastructureCluster,
  );
  const tkeClusterName = savedInfra?.metadata?.name || tkeClusterResourceName(clusterName);

  await saveTkeManagedMachinePools(pools, clusterName, namespace, context);
  await saveCapiCluster(clusterName, namespace, tkeClusterName, context, podCidrBlocks, isEdit);
  await saveCapiMachinePools(pools, clusterName, namespace, context, isEdit);
  await cleanupMachinePoolConfigs(pools);
}

export function removeEmptyFields(input: any): any {
  if (Array.isArray(input)) {
    const cleanedArray = input
      .map((item) => removeEmptyFields(item))
      .filter((item) => item !== undefined);

    return cleanedArray.length ? cleanedArray : undefined;
  }

  if (input && typeof input === 'object') {
    const cleanedObject = Object.entries(input as Record<string, unknown>).reduce((acc: Record<string, unknown>, [key, val]) => {
      const cleanedValue = removeEmptyFields(val);

      if (cleanedValue !== undefined) {
        acc[key] = cleanedValue;
      }

      return acc;
    }, {});

    return Object.keys(cleanedObject).length ? cleanedObject : undefined;
  }

  if (input === undefined || input === null || input === '') {
    return undefined;
  }

  return input;
}
