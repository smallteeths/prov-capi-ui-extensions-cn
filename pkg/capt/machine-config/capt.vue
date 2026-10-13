<script setup lang="ts">
import {
  computed, ref, toRefs, watch, WritableComputedRef
} from 'vue';
import { useStore } from 'vuex';
import { useI18n } from '@shell/composables/useI18n';
import { useFormValidation } from '@shell/composables/useFormValidation';
import { Banner } from '@components/Banner';
import LabeledInput from '@components/Form/LabeledInput/LabeledInput.vue';
import LabeledSelect from '@shell/components/form/LabeledSelect.vue';
import { stringify } from '@shell/utils/error';
import { _CREATE } from '@shell/config/query-params';
import { MACHINE_POOL_DEFAULTS } from './constants';
import * as validators from '../validators';
import { useTencentOptions } from '../composables/useTencentOptions';
import InstanceType from '../components/InstanceType.vue';
import OsNameSelect from '../components/OsNameSelect.vue';
import LabeledMultiSelect from '../components/LabeledMultiSelect.vue';

defineOptions({ name: 'MachineConfigCapt' });

const emit = defineEmits(['validationChanged', 'update:value']);

interface Props {
  value: Record<string, any>;
  uuid: string;
  // Pool entry from CruCapt. Desired size is stored on entry.pool.quantity
  // and later written to MachinePool.spec.replicas.
  entry?: Record<string, any>;
  infrastructureCluster?: Record<string, any>;
  cluster?: Record<string, any>;
  credentialId: string;
  mode?: string;
}

const props = withDefaults(defineProps<Props>(), {
  infrastructureCluster: () => ({}),
  cluster:               () => ({}),
  entry:                 undefined,
  mode:                  _CREATE,
});

const {
  value,
  credentialId,
  infrastructureCluster,
  mode,
} = toRefs(props);

const store = useStore();
const { t } = useI18n(store);
const intl = computed(() => store.getters['i18n/t']);

const {
  errors,
  loading,
  options,
  allSubnets,
  instanceTypeSet,
  fetchMachineOptions,
} = useTencentOptions({ store, intl });

function ensureSpec(): Record<string, any> {
  const model = (value.value && typeof value.value === 'object') ? value.value : {};

  if (model !== value.value) {
    emit('update:value', model);
  }

  model.spec = model.spec || {};

  return model.spec;
}

const isNew = computed(() => !value.value?.metadata?.creationTimestamp);

const spec: WritableComputedRef<Record<string, any>> = computed({
  get() {
    const s = ensureSpec();

    if (isNew.value) {
      if (s.maxSize === undefined) {
        s.maxSize = MACHINE_POOL_DEFAULTS.maxSize;
      }
      if (s.minSize === undefined) {
        s.minSize = MACHINE_POOL_DEFAULTS.minSize;
      }
      if (!Array.isArray(s.subnetIDs)) {
        s.subnetIDs = [...MACHINE_POOL_DEFAULTS.subnetIDs];
      }
      if (!Array.isArray(s.securityGroups)) {
        s.securityGroups = [...MACHINE_POOL_DEFAULTS.securityGroups];
      }
      if (!Array.isArray(s.keyIDs)) {
        s.keyIDs = [...MACHINE_POOL_DEFAULTS.keyIDs];
      }
      if (s.instanceType === undefined) {
        s.instanceType = MACHINE_POOL_DEFAULTS.instanceType;
      }
      if (s.osName === undefined) {
        s.osName = MACHINE_POOL_DEFAULTS.osName;
      }
    } else {
      if (!Array.isArray(s.subnetIDs)) {
        s.subnetIDs = [];
      }
      if (!Array.isArray(s.securityGroups)) {
        s.securityGroups = [];
      }
      if (!Array.isArray(s.keyIDs)) {
        s.keyIDs = [];
      }
    }

    return s;
  },
  set(neu: Record<string, any>) {
    value.value.spec = neu;
  },
});

watch(() => spec.value, () => {
  emit('update:value', value.value);
}, { deep: true });

const instanceType = computed({
  get: () => spec.value.instanceType || '',
  set: (val: string) => {
    spec.value.instanceType = val;
  }
});

const osName = computed({
  get: () => spec.value.osName || '',
  set: (val: string) => {
    spec.value.osName = val;
  }
});

const minSize = computed({
  get: () => spec.value.minSize,
  set: (val: number) => {
    spec.value.minSize = Number(val);
  }
});

const maxSize = computed({
  get: () => spec.value.maxSize,
  set: (val: number) => {
    spec.value.maxSize = Number(val);
  }
});

const replicas = computed({
  get() {
    const current = props.entry?.pool?.quantity;

    if (current === undefined || current === null || current === '') {
      return 1;
    }

    return Number(current);
  },
  set(val: number | string) {
    const n = Number(val);

    if (!props.entry?.pool || Number.isNaN(n)) {
      return;
    }

    props.entry.pool.quantity = n;
  },
});

const subnetIDs = computed({
  get: () => spec.value.subnetIDs || [],
  set: (val: string[]) => {
    spec.value.subnetIDs = val || [];
  }
});

const securityGroups = computed({
  get: () => spec.value.securityGroups || [],
  set: (val: string[]) => {
    spec.value.securityGroups = val || [];
  }
});

const keyIDs = computed({
  get: () => spec.value.keyIDs || [],
  set: (val: string[]) => {
    spec.value.keyIDs = val || [];
  }
});

const keyId = computed({
  get: () => (spec.value.keyIDs || [])[0] || '',
  set: (val: string) => {
    spec.value.keyIDs = val ? [val] : [];
  }
});

const createOnlyLocked = computed(() => !isNew.value);

const { getRules, isFormValid } = useFormValidation(
  t,
  [
    { path: 'instanceType', rules: ['instanceType'] },
    { path: 'osName', rules: ['osName'] },
    { path: 'minSize', rules: ['minSize'] },
    { path: 'maxSize', rules: ['maxSize'] },
    { path: 'replicas', rules: ['replicas'] },
  ],
  {
    instanceType: (val: unknown) => validators.instanceType(t, val as string),
    osName:       (val: unknown) => (createOnlyLocked.value ? undefined : validators.osName(t, val as string)),
    minSize:      (val: unknown) => validators.minSize(t, val as number, maxSize.value),
    maxSize:      (val: unknown) => validators.maxSize(t, val as number, minSize.value),
    replicas:     (val: unknown) => validators.desiredReplicas(t, val as number, minSize.value, maxSize.value),
  }
);

const requiredFieldValues = computed(() => ({
  instanceType: instanceType.value,
  osName:       osName.value,
  minSize:      minSize.value,
  maxSize:      maxSize.value,
  replicas:     replicas.value,
}));

const isDataValid = computed(() => {
  return Object.entries(requiredFieldValues.value).every(([path, val]) => {
    return getRules(path).every((rule) => !rule(val));
  });
});

const formValid = computed(() => isFormValid.value && isDataValid.value);

watch(formValid, (valid) => {
  emit('validationChanged', valid);
}, { immediate: true });

const region = computed(() => infrastructureCluster.value?.spec?.region || '');
const vpcId = computed(() => infrastructureCluster.value?.spec?.vpcID || '');

const subnetOptions = computed(() => {
  if (!vpcId.value) {
    return allSubnets.value;
  }

  return allSubnets.value.filter((subnet: any) => subnet.vpcId === vpcId.value);
});

const instanceTypeOptions = computed(() => {
  const all = Object.values(instanceTypeSet.value || {}).flat() as any[];

  return all;
});

function getDefaultInstanceType(list: any[]) {
  const candidates = list
    .map((item) => {
      const cpu = Number(item.raw?.Cpu);
      const memory = Number(item.raw?.Memory);

      if (!cpu || !memory) {
        return null;
      }

      return {
        ...item, cpu, memory
      };
    })
    .filter((item) => item && item.cpu <= 2 && item.memory <= 8)
    .sort((a, b) => (b.memory - a.memory) || (b.cpu - a.cpu));

  return candidates[0] || null;
}

function applyNewPoolDefaults() {
  if (!isNew.value) {
    return;
  }

  if (!spec.value.instanceType) {
    const picked = getDefaultInstanceType(instanceTypeOptions.value);

    if (picked?.value) {
      spec.value.instanceType = picked.value;
    }
  }

  if (!spec.value.subnetIDs?.length && subnetOptions.value.length) {
    spec.value.subnetIDs = [subnetOptions.value[0].value];
  }

  if (!spec.value.securityGroups?.length && options.value.securityGroupOptions.length) {
    spec.value.securityGroups = [options.value.securityGroupOptions[0].value];
  }
}

watch([
  () => region.value,
  () => credentialId.value,
], async([newRegion, newCredentialId], [oldRegion, oldCredentialId]) => {
  errors.value = [];

  if (region.value && credentialId.value) {
    await fetchMachineOptions(credentialId.value, region.value);

    if (isNew.value && ((oldRegion && newRegion !== oldRegion) || (oldCredentialId && newCredentialId !== oldCredentialId))) {
      spec.value.subnetIDs = [];
      spec.value.securityGroups = [];
      spec.value.keyIDs = [];
      spec.value.instanceType = '';
    }

    applyNewPoolDefaults();
  }
}, { immediate: true });
</script>

<template>
  <div class="machine-config-capt">
    <div v-if="errors?.length">
      <div
        v-for="(err, idx) in errors"
        :key="idx"
      >
        <Banner
          color="error"
          :label="stringify(err)"
        />
      </div>
    </div>
    <div class="cluster-basic-card mb-10">
      <div class="cluster-basic-card__header">
        <h3 class="cluster-basic-card__title">
          {{ t('capt.nodePool.basic.title') }}
        </h3>
        <div class="cluster-basic-card__desc">
          {{ t('capt.nodePool.basic.hint') }}
        </div>
      </div>
      <div class="row mb-10">
        <div class="col span-4">
          <LabeledInput
            v-model:value="minSize"
            :mode="mode"
            type="number"
            required
            min="0"
            label-key="capt.nodePool.minSize.label"
            :rules="getRules('minSize')"
          />
        </div>
        <div class="col span-4">
          <LabeledInput
            v-model:value="replicas"
            :mode="mode"
            type="number"
            required
            min="0"
            label-key="capt.nodePool.replicas.label"
            :rules="getRules('replicas')"
          />
        </div>
        <div class="col span-4">
          <LabeledInput
            v-model:value="maxSize"
            :mode="mode"
            type="number"
            required
            min="1"
            label-key="capt.nodePool.maxSize.label"
            :rules="getRules('maxSize')"
          />
        </div>
      </div>
      <OsNameSelect
        v-model:value="osName"
        :mode="mode"
        :disabled="createOnlyLocked"
        :rules="getRules('osName')"
        :cloud-credential-id="credentialId"
      />
    </div>
    <div class="cluster-basic-card mb-10">
      <InstanceType
        v-model:value="instanceType"
        :mode="mode"
        :loading="loading.instanceTypes"
        :options="instanceTypeOptions"
        :zone-options="options.zoneOptions"
        :rules="getRules('instanceType')"
      />
    </div>
    <div class="cluster-basic-card mb-10">
      <div class="cluster-basic-card__header">
        <h3 class="cluster-basic-card__title">
          {{ t('capt.nodePool.network.title') }}
        </h3>
      </div>
      <div class="row mb-10">
        <div class="col span-6">
          <LabeledMultiSelect
            v-model:value="subnetIDs"
            :mode="mode"
            :disabled="createOnlyLocked"
            :options="subnetOptions"
            :loading="loading.subnets"
            label-key="capt.subnet.label"
            :placeholder="t('capt.subnet.placeholder')"
          />
        </div>
        <div class="col span-6">
          <LabeledMultiSelect
            v-model:value="securityGroups"
            :mode="mode"
            :disabled="createOnlyLocked"
            :options="options.securityGroupOptions"
            :loading="loading.securityGroups"
            label-key="capt.securityGroup.label"
            :placeholder="t('capt.securityGroup.placeholder')"
          />
        </div>
      </div>
      <div class="row">
        <div class="col span-6">
          <LabeledSelect
            v-model:value="keyId"
            :mode="mode"
            :disabled="createOnlyLocked"
            :options="options.keyPairOptions"
            option-label="label"
            option-key="value"
            :loading="loading.keyPairs"
            label-key="capt.keyPair.label"
            :placeholder="t('capt.keyPair.placeholder')"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.machine-config-capt {
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
