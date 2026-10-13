<script setup lang="ts">
import {
  computed, onMounted, toRefs, WritableComputedRef, watch
} from 'vue';
import { useStore } from 'vuex';
import { useI18n } from '@shell/composables/useI18n';
import LabeledInput from '@components/Form/LabeledInput/LabeledInput.vue';
import LabeledSelect from '@shell/components/form/LabeledSelect.vue';
import Banner from '@components/Banner/Banner.vue';
import { _CREATE, _VIEW } from '@shell/config/query-params';
import merge from 'lodash/merge';
import { get, set, remove } from '@shell/utils/object.js';
import { stringify } from '@shell/utils/error';
import { useFormValidation } from '@shell/composables/useFormValidation';
import * as validators from '../validators';
import CONFIG from '../util/config';
import { useTencentOptions } from '../composables/useTencentOptions';
import NetworkConfig from './NetworkConfig.vue';

defineOptions({ name: 'ClusterConfiguration' });

const emit = defineEmits<{
  (e: 'update:value', value: any): void;
  (e: 'update:podCidr', value: string): void;
  (e: 'update:provisioningCluster', value: any): void;
  (e: 'validationChanged', value: boolean): void;
}>();

const defaultConfig = CONFIG.DEFAULT_TKE_CLUSTER_CONFIG;

interface Props {
  value: any;
  mode: string;
  credentialId?: any;
  provisioningCluster?: any;
  podCidr?: string;
}

const props = withDefaults(defineProps<Props>(), {
  mode:                _CREATE,
  value:               () => ({ spec: {} }),
  credentialId:        null,
  provisioningCluster: () => ({}),
  podCidr:             '',
});

const {
  mode,
  value,
  credentialId,
  provisioningCluster,
} = toRefs(props);

if (value.value && !value.value.spec) {
  value.value.spec = {};
}

const store = useStore();
const { t } = useI18n(store);
const intl = computed(() => store.getters['i18n/t']);

const {
  errors,
  loading,
  options,
  allSubnets,
  fetchRegion,
  fetchClusterOptions,
} = useTencentOptions({ store, intl });

function specComputed<T>(path: string, defaultValue: T): WritableComputedRef<T> {
  return computed({
    get: () => get(value.value, path) ?? defaultValue,
    set: (neu: T) => {
      if (neu === null || neu === undefined) {
        remove(value.value, path);
      } else {
        set(value.value, path, neu);
      }
      emit('update:value', value.value);
    },
  });
}

const clusterName = specComputed<string>('spec.clusterName', '');
const region = specComputed<string>('spec.region', '');
const clusterVersion = specComputed<string>('spec.clusterVersion', '');
const vpcId = specComputed<string>('spec.vpcID', '');
const publicAccess = specComputed<boolean>('spec.endpointAccess.public', true);
const privateAccess = specComputed<boolean>('spec.endpointAccess.private', false);
const securityGroup = specComputed<string>('spec.endpointAccess.securityGroup', '');
const subnetId = specComputed<string>('spec.endpointAccess.subnetID', '');

const displayName = computed({
  get: () => provisioningCluster.value?.metadata?.name || (!isCreate.value ? clusterName.value : '') || '',
  set: (neu: string) => {
    if (!isCreate.value) {
      return;
    }

    const cluster = provisioningCluster.value || {};

    cluster.metadata = cluster.metadata || {};
    cluster.metadata.name = neu;
    clusterName.value = neu;
    emit('update:provisioningCluster', cluster);
  },
});

const { getRules, isFormValid } = useFormValidation(
  t,
  [
    { path: 'clusterName', rules: ['clusterName'] },
    { path: 'region', rules: ['region'] },
    { path: 'clusterVersion', rules: ['clusterVersion'] },
    { path: 'vpc', rules: ['vpc'] },
    { path: 'securityGroup', rules: ['securityGroup'] },
    { path: 'subnet', rules: ['subnet'] },
  ],
  {
    clusterName:    (val: unknown) => validators.clusterName(t, val as string),
    region:         (val: unknown) => validators.region(t, val as string),
    clusterVersion: (val: unknown) => validators.clusterVersion(t, val as string),
    vpc:            (val: unknown) => validators.vpc(t, val as string),
    securityGroup:  (val: unknown) => validators.securityGroup(t, val as string, publicAccess.value),
    subnet:         (val: unknown) => validators.subnet(t, val as string, !publicAccess.value),
  }
);

const isCreate = computed(() => mode.value === _CREATE);
const isView = computed(() => mode.value === _VIEW);

const subnetOptions = computed(() => {
  if (!vpcId.value) {
    return [];
  }

  return allSubnets.value.filter((subnet: any) => subnet.vpcId === vpcId.value);
});

const podCidrOptions = computed(() => (CONFIG.CLUSTER_CIDR_CANDIDATES || []).map((cidr: string) => ({
  label: cidr,
  value: cidr,
})));

function syncClusterName() {
  if (!isCreate.value) {
    return;
  }

  const name = provisioningCluster.value?.metadata?.name || '';

  if (clusterName.value !== name) {
    clusterName.value = name;
  }
}

function handleRegionChange(next: string) {
  if (region.value === next) {
    return;
  }

  region.value = next;

  if (!isCreate.value) {
    return;
  }

  vpcId.value = '';
  securityGroup.value = '';
  subnetId.value = '';
  clusterVersion.value = '';
}

function handleVpcChange(next: string) {
  vpcId.value = next;

  if (!isCreate.value) {
    return;
  }

  subnetId.value = '';
  applyCreateDropdownDefaults();
}

function applyCreateDropdownDefaults() {
  if (!isCreate.value) {
    return;
  }

  if (!clusterVersion.value && options.value.versionOptions.length) {
    clusterVersion.value = options.value.versionOptions[options.value.versionOptions.length - 1].value;
  }

  if (!vpcId.value && options.value.vpcOptions.length) {
    vpcId.value = options.value.vpcOptions[0].value;
  }

  if (publicAccess.value) {
    if (!securityGroup.value && options.value.securityGroupOptions.length) {
      securityGroup.value = options.value.securityGroupOptions[0].value;
    }
  } else if (!subnetId.value && subnetOptions.value.length) {
    subnetId.value = subnetOptions.value[0].value;
  }
}

function handlePublicAccessChange(next: boolean) {
  publicAccess.value = next;
  privateAccess.value = !next;

  if (!isCreate.value) {
    return;
  }

  if (next) {
    subnetId.value = '';
  } else {
    securityGroup.value = '';
  }

  applyCreateDropdownDefaults();
}

watch(() => isFormValid.value, (formValid = true) => {
  emit('validationChanged', formValid);
}, { immediate: true });

watch([
  () => credentialId.value,
  () => region.value,
], async([newCredentialId, newRegion], [oldCredentialId, oldRegion]) => {
  if (isView.value) {
    return;
  }

  errors.value = [];

  if (newCredentialId) {
    await fetchRegion(newCredentialId);
  }

  if (newCredentialId && newRegion) {
    await fetchClusterOptions(newCredentialId, newRegion);
  }

  if (isCreate.value && oldRegion && newRegion !== oldRegion) {
    vpcId.value = '';
    securityGroup.value = '';
    subnetId.value = '';
  }

  if (oldCredentialId && newCredentialId !== oldCredentialId && isCreate.value) {
    vpcId.value = '';
    securityGroup.value = '';
    subnetId.value = '';
  }

  applyCreateDropdownDefaults();
}, { immediate: true });

watch(() => provisioningCluster.value?.metadata?.name, () => {
  syncClusterName();
}, { immediate: true });

onMounted(() => {
  if (mode.value === _CREATE && value.value) {
    // Apply defaults onto the Steve model in-place.
    // Do NOT replace with merge({}, ...) — that drops save()/remove().
    value.value.spec = merge({}, defaultConfig.spec, value.value.spec || {});
    emit('update:value', value.value);
  }
});
</script>

<template>
  <div class="infrastructure-cluster-configuration">
    <Banner
      v-for="(err, i) in errors"
      :key="i"
      color="error"
      :label="stringify(err)"
    />
    <div class="cluster-basic-card mb-10">
      <div class="cluster-basic-card__header">
        <h3 class="cluster-basic-card__title">
          {{ t('capt.basicConfig.title') }}
        </h3>
        <div class="cluster-basic-card__desc">
          {{ t('capt.basicConfig.description') }}
        </div>
      </div>
      <div class="row mt-10">
        <div class="col span-6">
          <LabeledInput
            v-model:value="displayName"
            data-testid="capt-resource-cluster-name"
            :mode="mode"
            required
            :disabled="!isCreate"
            label-key="cluster.name.label"
            :placeholder="t('cluster.name.placeholder')"
            :rules="getRules('clusterName')"
          />
        </div>
        <div class="col span-6">
          <LabeledSelect
            :value="region"
            data-testid="capt-resource-region"
            required
            :mode="mode"
            :options="options.regionOptions"
            option-label="label"
            option-key="value"
            :loading="loading.regions"
            label-key="capt.region.label"
            :disabled="!isCreate"
            :rules="getRules('region')"
            @update:value="handleRegionChange"
          />
        </div>
      </div>
      <div class="row mt-10">
        <div class="col span-6">
          <LabeledSelect
            v-model:value="clusterVersion"
            data-testid="capt-resource-cluster-version"
            :loading="loading.versions"
            required
            :mode="mode"
            :options="options.versionOptions"
            option-label="label"
            option-key="value"
            label-key="capt.version.label"
            :rules="getRules('clusterVersion')"
          />
        </div>
      </div>
    </div>
    <NetworkConfig
      :vpc-id="vpcId"
      :public-access="publicAccess"
      :private-access="privateAccess"
      :security-group="securityGroup"
      :subnet-id="subnetId"
      :pod-cidr="podCidr"
      :pod-cidr-options="podCidrOptions"
      :mode="mode"
      :intl="t"
      :vpc-options="options.vpcOptions"
      :subnet-options="subnetOptions"
      :security-group-options="options.securityGroupOptions"
      :vpc-loading="loading.vpcs"
      :subnet-loading="loading.subnets"
      :security-group-loading="loading.securityGroups"
      :disabled="!isCreate"
      :vpc-rules="getRules('vpc')"
      :security-group-rules="getRules('securityGroup')"
      :subnet-rules="getRules('subnet')"
      @update:vpc-id="handleVpcChange"
      @update:public-access="handlePublicAccessChange"
      @update:security-group="securityGroup = $event"
      @update:subnet-id="subnetId = $event"
      @update:pod-cidr="emit('update:podCidr', $event)"
    />
  </div>
</template>

<style scoped lang="scss">
.infrastructure-cluster-configuration {
  display: flex;
  flex-direction: column;
  gap: var(--gap-md, 16px);
}
.cluster-basic-card {
  padding: 20px;
  border: 1px solid var(--border);
  border-radius: var(--border-radius);
  background: var(--body-bg);
  box-shadow: 0 0 16px var(--shadow);
}
.cluster-basic-card__header {
  margin-bottom: 20px;
}
.cluster-basic-card__title {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
  color: var(--body-text);
  line-height: 1.4;
}
.cluster-basic-card__desc {
  margin-top: 8px;
  max-width: 980px;
  color: var(--input-label);
  font-size: 14px;
  line-height: 1.6;
}
</style>
