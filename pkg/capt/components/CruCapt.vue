<script setup lang="ts">
import {
  computed, onMounted, ref, watch
} from 'vue';
import { useStore } from 'vuex';
import { useRouter } from 'vue-router';
import { useI18n } from '@shell/composables/useI18n';
import CruResource from '@shell/components/CruResource.vue';
import CruResourceFooter from '@shell/components/CruResourceFooter.vue';
import Loading from '@shell/components/Loading.vue';
import Banner from '@components/Banner/Banner.vue';
import SelectCredential from '@shell/edit/provisioning.cattle.io.cluster/SelectCredential.vue';
import Tab from '@shell/components/Tabbed/Tab.vue';
import Tabbed from '@shell/components/Tabbed/index.vue';
import { _CREATE, _EDIT, _VIEW } from '@shell/config/query-params';
import { DEFAULT_WORKSPACE } from '@shell/config/types';
import { stringify } from '@shell/utils/error';
import { set } from '@shell/utils/object';
import {
  createMachinePoolMachineConfig,
  initInfrastructureCluster,
  loadCapiMachinePools,
  saveCaptResources,
} from '../utils';
import {
  CAPT_CLUSTERS_ROUTE,
  DEFAULT_POD_CIDR,
  TKE_CLUSTER_SCHEMA,
  TKE_MACHINE_POOL_SCHEMA,
  type ClusterValue,
} from '../types/capt';
import InfrastructureClusterConfiguration from './InfrastructureClusterConfiguration.vue';
import MachineConfigCapt from '../machine-config/capt.vue';

defineOptions({ name: 'CruCapt' });

const props = withDefaults(defineProps<{
  mode: string;
  value: ClusterValue;
  provider?: string;
}>(), { provider: 'tkemanagedmachinepool' });

const emit = defineEmits(['update:value']);

const localValue = computed({
  get: () => props.value,
  set: (neu) => emit('update:value', neu),
});

const store = useStore();
const router = useRouter();
const { t } = useI18n(store);

const loading = ref(true);
const errors = ref<any[]>([]);
const credentialId = ref('');
const infrastructureCluster = ref<any>(null);
const infrastructureClusterInitialValue = ref<any>(null);
const infrastructureClusterValid = ref(true);
const machinePools = ref<any[]>([]);
const lastIdx = ref(0);
const cruresource = ref<any>(null);
const podCidr = ref(DEFAULT_POD_CIDR);

const isCreate = computed(() => props.mode === _CREATE);
const isEdit = computed(() => props.mode === _EDIT);
const isView = computed(() => props.mode === _VIEW);
const hasCredential = computed(() => !!credentialId.value);

const storeContext = computed(() => ({
  dispatch: store.dispatch,
  getters:  store.getters,
  t,
}));

const machineConfigSchema = computed(() => {
  return store.getters['management/schemaFor'](TKE_MACHINE_POOL_SCHEMA, true, false);
});

const unremovedMachinePools = computed(() => machinePools.value.filter((pool) => !pool.remove));

const fvFormIsValid = computed(() => {
  if (!hasCredential.value) {
    return false;
  }

  if (!props.value?.metadata?.name) {
    return false;
  }

  if (!infrastructureClusterValid.value) {
    return false;
  }

  if (!unremovedMachinePools.value.length) {
    return false;
  }

  return unremovedMachinePools.value.every((pool) => pool.valid !== false);
});

const doneRoute = computed(() => {
  const cluster = router.currentRoute.value.params.cluster;

  return {
    name:   CAPT_CLUSTERS_ROUTE,
    path:   `/c/${ cluster }/manager/capt-clusters`,
    params: { cluster },
  };
});

function goToHostedList() {
  const cluster = router.currentRoute.value.params.cluster;

  return router.push(`/c/${ cluster }/manager/capt-clusters`);
}

function cancelCredential() {
  goToHostedList();
}

function poolIsValid(pool: any) {
  return pool.valid !== false && !!pool.pool?.name;
}

async function addMachinePool() {
  const config = await createMachinePoolMachineConfig(machineConfigSchema.value, storeContext.value);
  const numCurrentPools = unremovedMachinePools.value.length;
  const name = `pool${ ++lastIdx.value }`;
  const kind = machineConfigSchema.value?.attributes?.kind || 'TKEManagedMachinePool';
  const apiVersion = machineConfigSchema.value?.attributes?.group && machineConfigSchema.value?.attributes?.version
    ? `${ machineConfigSchema.value.attributes.group }/${ machineConfigSchema.value.attributes.version }`
    : 'infrastructure.cluster.x-k8s.io/v1beta1';

  machinePools.value.push({
    id:     name,
    config,
    remove: false,
    create: true,
    update: false,
    valid:  false,
    pool:   {
      name,
      etcdRole:         numCurrentPools === 0,
      controlPlaneRole: numCurrentPools === 0,
      workerRole:       true,
      hostnamePrefix:   '',
      labels:           {},
      quantity:         1,
      machineConfigRef: {
        kind,
        name:       null,
        apiVersion,
      },
      drainBeforeDelete: true,
    },
  });
}

function removeMachinePool(idx: number) {
  const entry = unremovedMachinePools.value[idx];

  if (!entry || unremovedMachinePools.value.length === 1) {
    return;
  }

  if (entry.create) {
    machinePools.value = machinePools.value.filter((pool) => pool !== entry);
  } else {
    entry.remove = true;
  }
}

async function initExistingPools(existing: any[]) {
  const out: any[] = [];

  for (const pool of existing || []) {
    const type = pool.machineConfigRef?.apiVersion
      ? `${ pool.machineConfigRef.apiVersion.split('/')[0] }.${ (pool.machineConfigRef.kind || '').toLowerCase() }`
      : TKE_MACHINE_POOL_SCHEMA;
    let config = null;

    if (pool.machineConfigRef?.name && store.getters['management/canList'](type)) {
      try {
        const found = await store.dispatch('management/find', {
          type,
          id: `${ props.value.metadata?.namespace }/${ pool.machineConfigRef.name }`,
        });

        config = found ? await store.dispatch('management/clone', { resource: found }) : null;
      } catch (e) {
        config = null;
      }
    }

    out.push({
      id:     `pool${ ++lastIdx.value }`,
      remove: false,
      create: false,
      update: true,
      valid:  true,
      pool:   JSON.parse(JSON.stringify(pool)),
      config,
    });
  }

  machinePools.value = out;
}

async function save(buttonCb?: (ok: boolean) => void) {
  errors.value = [];

  try {
    props.value.metadata = props.value.metadata || {};
    props.value.metadata.namespace = props.value.metadata.namespace || DEFAULT_WORKSPACE;

    const clusterName = props.value.metadata.name;

    if (!clusterName) {
      throw new Error(t('capt.errors.clusterNameRequired'));
    }

    // Persist upstream CAPI resources only. Do not save provisioning.cattle.io.Cluster —
    // Turtles imports from cluster.x-k8s.io.Cluster via rancher-auto-import.
    await saveCaptResources({
      clusterName,
      namespace:                      props.value.metadata.namespace,
      infrastructureCluster:        infrastructureCluster.value,
      initialInfrastructureCluster: infrastructureClusterInitialValue.value,
      pools:                        machinePools.value,
      context:                      storeContext.value,
      isEdit:                       isEdit.value,
      podCidrBlocks:                [podCidr.value || DEFAULT_POD_CIDR],
    });

    buttonCb?.(true);
    await goToHostedList();
  } catch (e) {
    errors.value = [e];
    buttonCb?.(false);
  }
}

watch(credentialId, (neu) => {
  if (neu) {
    set(props.value, 'spec.cloudCredentialSecretName', neu);
  }
});

onMounted(async() => {
  loading.value = true;
  errors.value = [];

  try {
    props.value.metadata = props.value.metadata || {};
    props.value.metadata.namespace = props.value.metadata.namespace || DEFAULT_WORKSPACE;
    credentialId.value = props.value.spec?.cloudCredentialSecretName || '';
    infrastructureCluster.value = await initInfrastructureCluster(props.value, TKE_CLUSTER_SCHEMA, storeContext.value);

    const loaded = infrastructureCluster.value;

    infrastructureClusterInitialValue.value = loaded && typeof loaded.toJSON === 'function'
      ? await store.dispatch('management/clone', { resource: loaded })
      : null;

    const namespace = props.value.metadata.namespace || DEFAULT_WORKSPACE;
    const clusterName = props.value.metadata.name;
    const existingFromCapi = clusterName && !isCreate.value
      ? await loadCapiMachinePools(clusterName, namespace, storeContext.value)
      : [];
    const legacyPools = props.value.spec?.rkeConfig?.machinePools || [];

    if (existingFromCapi.length) {
      machinePools.value = existingFromCapi.map((entry) => ({
        ...entry,
        id:    `pool${ ++lastIdx.value }`,
        valid: true,
      }));
    } else if (legacyPools.length) {
      await initExistingPools(legacyPools);
    } else if (isCreate.value) {
      await addMachinePool();
    }
  } catch (e) {
    errors.value = [e];
  }

  loading.value = false;
});
</script>

<template>
  <Loading v-if="loading" />
  <CruResource
    v-else
    ref="cruresource"
    :resource="value"
    :mode="mode"
    :can-yaml="false"
    :done-route="doneRoute"
    :validation-passed="fvFormIsValid"
    class="cru-capt"
    @error="(err: any) => errors = err"
    @finish="save"
    @cancel="cancelCredential"
  >
    <SelectCredential
      v-model:value="credentialId"
      :mode="isCreate ? _CREATE : _VIEW"
      provider="tke"
      :default-on-cancel="true"
      :showing-form="hasCredential"
      class="mt-20"
      :cancel="cancelCredential"
    />
    <div
      v-if="hasCredential"
      class="mt-10"
    >
      <Banner
        v-for="(err, i) in errors"
        :key="i"
        color="error"
        :label="stringify(err)"
      />
      <InfrastructureClusterConfiguration
        v-model:value="infrastructureCluster"
        v-model:provisioning-cluster="localValue"
        v-model:pod-cidr="podCidr"
        :mode="mode"
        :credential-id="credentialId"
        class="mt-10"
        @validationChanged="(val) => infrastructureClusterValid = val"
      />
      <Tabbed
        ref="pools"
        :side-tabs="true"
        :show-tabs-add-remove="mode !== 'view'"
        class="mb-20 mt-20"
        @addTab="addMachinePool()"
        @removeTab="removeMachinePool($event)"
      >
        <Tab
          v-for="(pool, i) in unremovedMachinePools"
          :key="pool.id"
          :weight="-i"
          :name="pool.id"
          :label="pool.pool.name"
          :error="!poolIsValid(pool)"
        >
          <MachineConfigCapt
            v-model:value="pool.config"
            :entry="pool"
            :uuid="pool.id"
            :mode="mode"
            :credential-id="credentialId"
            :infrastructure-cluster="infrastructureCluster"
            :cluster="value"
            @validationChanged="(val) => pool.valid = val"
          />
        </Tab>
      </Tabbed>
    </div>
    <!-- Own the footer so CruResource's Edit YAML button is not rendered. -->
    <template #form-footer>
      <CruResourceFooter
        v-if="hasCredential && !isView"
        :mode="mode"
        @cancel-confirmed="cancelCredential"
        @finish="save"
      />
    </template>
  </CruResource>
</template>
