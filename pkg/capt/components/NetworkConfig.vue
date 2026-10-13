<script setup>
import { computed } from 'vue';
import LabeledSelect from '@shell/components/form/LabeledSelect.vue';
import { RadioGroup } from '@components/Form/Radio';

const props = defineProps({
  mode: {
    type:     String,
    required: true,
  },
  intl: {
    type:     Function,
    required: true,
  },
  vpcId: {
    type:    String,
    default: '',
  },
  publicAccess: {
    type:    Boolean,
    default: true,
  },
  privateAccess: {
    type:    Boolean,
    default: false,
  },
  securityGroup: {
    type:    String,
    default: '',
  },
  subnetId: {
    type:    String,
    default: '',
  },
  vpcOptions: {
    type:    Array,
    default: () => [],
  },
  subnetOptions: {
    type:    Array,
    default: () => [],
  },
  securityGroupOptions: {
    type:    Array,
    default: () => [],
  },
  vpcLoading: {
    type:    Boolean,
    default: false,
  },
  subnetLoading: {
    type:    Boolean,
    default: false,
  },
  securityGroupLoading: {
    type:    Boolean,
    default: false,
  },
  disabled: {
    type:    Boolean,
    default: false,
  },
  vpcRules: {
    type:    Array,
    default: () => [],
  },
  securityGroupRules: {
    type:    Array,
    default: () => [],
  },
  subnetRules: {
    type:    Array,
    default: () => [],
  },
  podCidr: {
    type:    String,
    default: '',
  },
  podCidrOptions: {
    type:    Array,
    default: () => [],
  },
});

const emit = defineEmits([
  'update:vpcId',
  'update:publicAccess',
  'update:privateAccess',
  'update:securityGroup',
  'update:subnetId',
  'update:podCidr',
]);

const accessOptions = computed(() => [
  {
    label: props.intl('capt.proxy.outer'),
    value: true,
  },
  {
    label: props.intl('capt.proxy.inner'),
    value: false,
  },
]);
</script>

<template>
  <div class="cluster-basic-card mb-10">
    <div class="cluster-basic-card__header">
      <h3 class="cluster-basic-card__title">
        {{ intl('capt.networkConfig.title') }}
      </h3>
      <div class="cluster-basic-card__desc">
        {{ intl('capt.networkConfig.description') }}
      </div>
    </div>
    <div class="row mb-10">
      <div class="col span-6">
        <LabeledSelect
          :value="vpcId"
          data-testid="capt-resource-vpc"
          :loading="vpcLoading"
          required
          :mode="mode"
          :options="vpcOptions"
          option-label="label"
          option-key="value"
          label-key="capt.vpc.label"
          :disabled="disabled"
          :rules="vpcRules"
          @update:value="emit('update:vpcId', $event)"
        />
      </div>
      <div class="col span-6">
        <LabeledSelect
          :value="podCidr"
          data-testid="capt-resource-pod-cidr"
          required
          :mode="mode"
          :options="podCidrOptions"
          option-label="label"
          option-key="value"
          label-key="capt.clusterCidr.label"
          :tooltip="intl('capt.clusterCidr.tooltip')"
          :disabled="disabled"
          @update:value="emit('update:podCidr', $event)"
        />
      </div>
    </div>
    <div class="network-option-card mt-10">
      <div class="network-option-card__title">
        {{ intl('capt.proxy.label') }}
      </div>
      <div class="network-option-card__desc">
        {{ intl('capt.proxy.info') }}
      </div>
      <div class="mt-10">
        <RadioGroup
          :value="publicAccess"
          name="clusterEndpoint"
          :options="[true, false]"
          :labels="accessOptions.map((item) => item.label)"
          :mode="mode"
          :disabled="disabled"
          @update:value="emit('update:publicAccess', $event)"
        />
      </div>
      <div
        v-if="publicAccess"
        class="row mt-10"
      >
        <div class="col span-6">
          <LabeledSelect
            :value="securityGroup"
            data-testid="capt-resource-security-group"
            :loading="securityGroupLoading"
            required
            :mode="mode"
            :options="securityGroupOptions"
            option-label="label"
            option-key="value"
            label-key="capt.securityGroup.label"
            :disabled="disabled"
            :rules="securityGroupRules"
            @update:value="emit('update:securityGroup', $event)"
          />
        </div>
      </div>
      <div
        v-else
        class="row mt-10"
      >
        <div class="col span-6">
          <LabeledSelect
            :value="subnetId"
            data-testid="capt-resource-subnet"
            :loading="subnetLoading"
            required
            :mode="mode"
            :options="subnetOptions"
            option-label="label"
            option-key="value"
            label-key="capt.subnet.label"
            :disabled="disabled"
            :rules="subnetRules"
            @update:value="emit('update:subnetId', $event)"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
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
.network-option-card {
  padding: 14px 16px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--body-bg);
}
.network-option-card__title {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  color: var(--body-text);
  line-height: 1.4;
}
.network-option-card__desc {
  margin-top: 6px;
  color: var(--input-label);
  font-size: 13px;
  line-height: 1.6;
}
</style>
