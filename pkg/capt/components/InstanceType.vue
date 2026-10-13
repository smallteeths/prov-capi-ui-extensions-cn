<script setup>
import { ref, watch, computed } from 'vue';
import { useStore } from 'vuex';
import { useI18n } from '@shell/composables/useI18n';
import Checkbox from '@components/Form/Checkbox/Checkbox.vue';
import UnitInput from '@shell/components/form/UnitInput.vue';
import LabeledSelect from '@shell/components/form/LabeledSelect.vue';
import SortableTable from '@shell/components/SortableTable/index.vue';
import { _CREATE } from '@shell/config/query-params';
import { INSTANCE_FAMILY_CATEGORY_MAP } from '../util/config';

defineOptions({ name: 'InstanceType' });

const props = defineProps({
  mode: {
    type:    String,
    default: _CREATE
  },
  value: {
    type:    String,
    default: ''
  },
  disabled: {
    type:    Boolean,
    default: false
  },
  loading: {
    type:    Boolean,
    default: false
  },
  options: {
    type:    Array,
    default: () => []
  },
  zoneOptions: {
    type:    Array,
    default: () => []
  },
  rules: {
    type:    Array,
    default: () => []
  }
});

const emit = defineEmits(['update:value']);
const store = useStore();
const { t } = useI18n(store);
const zone = ref('');
const currentInstance = ref({});
const cpu = ref(undefined);
const memory = ref(undefined);
const tableRows = ref([]);

const INSTANCE_TYPE_COLUMNS = computed(() => {
  return [
    {
      name:  'selected',
      label: ' ',
      width: 40,
      align: 'center',
    },
    {
      name:  'instanceSpec',
      label: t('capt.instanceType.table.columns.instanceSpec'),
      value: 'instanceSpec',
      sort:  'instanceSpec'
    },
    {
      name:  'instanceType',
      label: t('capt.instanceType.table.columns.instanceType'),
      value: 'instanceType',
      sort:  'instanceType'
    },
    {
      name:  'instanceFamily',
      label: t('capt.instanceType.table.columns.instanceFamily'),
      value: 'instanceFamily',
      sort:  'instanceFamily'
    },
    {
      name:  'vcpus',
      label: t('capt.instanceType.table.columns.vcpus'),
      value: 'vcpus',
      sort:  'vcpus'
    },
    {
      name:  'memory',
      label: t('capt.instanceType.table.columns.memory'),
      value: 'memory',
      sort:  'memory'
    },
    {
      name:  'zone',
      label: t('capt.instanceType.table.columns.zone'),
      value: 'zone',
      sort:  'zone'
    }
  ];
});
const zoneFilterOptions = computed(() => {
  const zones = [...new Set(
    (props.options || [])
      .map((item) => item.raw?.Zone || item.zone || '')
      .filter(Boolean)
  )];

  const zoneLabelMap = new Map(
    (props.zoneOptions || []).map((item) => [item.value, item.label])
  );

  return [
    {
      label: `${ t('generic.all') }`,
      value: ''
    },
    ...zones.map((item) => {
      return {
        label: zoneLabelMap.get(item) || item,
        value: item
      };
    })
  ];
});

function getInstanceFamilyCategory(instanceFamily) {
  return INSTANCE_FAMILY_CATEGORY_MAP[instanceFamily] || 'other';
}

function formatInstanceSpec(row) {
  const family = row?.raw?.InstanceFamily || '';

  if (!family) {
    return row?.TypeName || '-';
  }

  const category = getInstanceFamilyCategory(family);
  const categoryLabel = t(`capt.instanceType.familyCategory.${ category }`);

  return `${ categoryLabel } ${ family }`;
}

function getRowZone(row) {
  return row?.raw?.Zone || row?.zone || '';
}

function getRowInstanceType(row) {
  return row?.instanceType || row?.value || '';
}

function getRowKey(row) {
  return `${ getRowInstanceType(row) }@@${ getRowZone(row) }`;
}

function normalizeOptionToRow(item) {
  const row = {
    instanceSpec:   formatInstanceSpec(item),
    instanceType:   item.value,
    instanceFamily: item.group || item.raw?.InstanceFamily || '-',
    vcpus:          item.raw?.Cpu ?? '-',
    memory:         item.raw?.Memory ?? '-',
    zone:           item.zone || item.raw?.Zone || '-',
    label:          item.label,
    raw:            item.raw
  };

  return {
    ...row,
    rowKey: getRowKey(row),
  };
}

function normalizeCurrentInstance(instance) {
  if (!instance || !Object.keys(instance).length) {
    return null;
  }

  const row = {
    instanceSpec:   instance.instanceSpec || formatInstanceSpec(instance),
    instanceType:   instance.instanceType || instance.value || '-',
    instanceFamily: instance.instanceFamily || instance.group || instance.raw?.InstanceFamily || '-',
    vcpus:          instance.vcpus ?? instance.raw?.Cpu ?? '-',
    memory:         instance.memory ?? instance.raw?.Memory ?? '-',
    zone:           instance.zone || instance.raw?.Zone || '-',
    label:          instance.label,
    raw:            instance.raw
  };

  return {
    ...row,
    rowKey: getRowKey(row),
  };
}

function formatTableRows() {
  let list = props.options || [];

  if (zone.value) {
    list = list.filter((item) => {
      return (item.raw?.Zone || item.zone || '') === zone.value;
    });
  }

  if (cpu.value) {
    list = list.filter((item) => item.raw?.Cpu === cpu.value);
  }

  if (memory.value) {
    list = list.filter((item) => item.raw?.Memory === memory.value);
  }

  tableRows.value = list.map((item) => normalizeOptionToRow(item));
}

function toggleInstanceType(row, checked) {
  if (!checked) {
    if (selectedRowKey.value === row.rowKey) {
      emit('update:value', '');
      currentInstance.value = {};
    }

    return;
  }

  emit('update:value', row.instanceType);
  // 把当前 currentInstance 传递给父组件
  currentInstance.value = row;
}

function runRules(rules, value) {
  if (!Array.isArray(rules)) {
    return;
  }

  rules.forEach((rule) => {
    if (typeof rule === 'function') {
      rule(value);
    }
  });
}
// 补全父组件传来的 currentInstance 数据
const normalizedCurrentInstance = computed(() => {
  return normalizeCurrentInstance(currentInstance.value);
});

const resolvedCurrentInstance = computed(() => {
  if (!props.value) {
    return null;
  }

  // 如果用户手动选择了这 normalizedCurrentInstance 中的 currentInstance 就会设置值
  // 根据当前的 currentInstance 来返回 resolvedCurrentInstance 就好
  if (
    normalizedCurrentInstance.value &&
    getRowInstanceType(normalizedCurrentInstance.value) === props.value
  ) {
    return normalizedCurrentInstance.value;
  }

  // 父组件只会传来 instanceType，当第一次选择实例类型时，currentInstance 为空，
  // 所以这里需要根据父组件 instanceType 来匹配
  // 因为父组件只会传来 instanceType 所以匹配到第一个就好，不用考虑 zone
  const matches = (props.options || [])
    .filter((item) => item.value === props.value)
    .map((item) => normalizeOptionToRow(item));

  if (matches.length > 0) {
    return matches[0];
  }

  return null;
});

const selectedRowKey = computed(() => {
  return resolvedCurrentInstance.value?.rowKey || '';
});

// 只提供显示的信息
const selectedInstanceInfo = computed(() => {
  const selected = resolvedCurrentInstance.value;

  if (!selected) {
    return null;
  }

  return {
    instanceSpec:   selected.instanceSpec || '-',
    instanceType:   selected.instanceType || props.value || '-',
    instanceFamily: selected.instanceFamily || '-',
    vcpus:          selected.vcpus ?? '-',
    memory:         selected.memory ?? '-',
    // disabeld 状态时根据用户返回的 instanceType 来回显 zone 并不准确
    // 所以回显时 zone 不做显示
    zone:           props.disabled ? '-' : (selected.zone || '-'),
  };
});

watch(zone, formatTableRows);
watch(cpu, formatTableRows);
watch(memory, formatTableRows);
watch(() => props.options, (options = []) => {
  const exists = zoneFilterOptions.value.some((item) => item.value === zone.value);

  if (!exists) {
    zone.value = '';
  }

  formatTableRows(options);
}, { deep: true, immediate: true });

watch(
  () => [props.value],
  () => {
    runRules(props.rules, props.value);
  },
  {
    immediate: true,
    deep:      true
  }
);
</script>

<template>
  <h3
    v-if="!disabled"
    class="title"
  >
    {{ t('capt.instanceType.table.title') }}
  </h3>
  <p
    v-if="!disabled"
    class="mb-10"
  >
    {{ t('capt.instanceType.table.subtitle') }}
    <a
      href="https://cloud.tencent.com/document/product/457/84660"
      target="_blank"
      rel="noopener noreferrer"
    >
      {{ t('capt.instanceType.table.linkText') }}
    </a>
  </p>
  <SortableTable
    :loading="loading"
    :rows="tableRows"
    :headers="INSTANCE_TYPE_COLUMNS"
    :table-actions="false"
    :row-actions="false"
    :rows-per-page="10"
    :paging="true"
    key-field="rowKey"
    class="mb-20"
  >
    <template #header-left>
      <div class="row">
        <div class="col span-4">
          <LabeledSelect
            v-model:value="zone"
            :mode="mode"
            :options="zoneFilterOptions"
            option-label="label"
            option-key="value"
            :disabled="disabled"
          />
        </div>
        <div class="col span-3">
          <UnitInput
            v-model:value="cpu"
            :mode="mode"
            placeholder-key="capt.instanceType.cpu.label"
            suffix="vCPU"
            type="number"
          />
        </div>
        <div class="col span-3">
          <UnitInput
            v-model:value="memory"
            type="number"
            :mode="mode"
            placeholder-key="capt.instanceType.memory.label"
            suffix="GiB"
          />
        </div>
      </div>
    </template>
    <template #cell:selected="{ row }">
      <Checkbox
        :disabled="disabled"
        :value="selectedRowKey === row.rowKey"
        @update:value="toggleInstanceType(row, $event)"
      />
    </template>
  </SortableTable>
  <div
    v-if="selectedInstanceInfo"
    class="selected-instance-card mb-20"
  >
    <div class="selected-instance-card__header">
      <div class="selected-instance-card__title">
        <i class="icon icon-checkmark" />
        <span>{{ t('capt.instanceType.selected.title') }}</span>
      </div>
    </div>

    <div class="selected-instance-card__grid">
      <div class="info-item">
        <div class="info-item__label">
          {{ t('capt.instanceType.table.columns.instanceSpec') }}
        </div>
        <div class="info-item__value">
          {{ selectedInstanceInfo.instanceSpec }}
        </div>
      </div>

      <div class="info-item">
        <div class="info-item__label">
          {{ t('capt.instanceType.table.columns.instanceType') }}
        </div>
        <div class="info-item__value">
          {{ selectedInstanceInfo.instanceType }}
        </div>
      </div>

      <div class="info-item">
        <div class="info-item__label">
          {{ t('capt.instanceType.table.columns.instanceFamily') }}
        </div>
        <div class="info-item__value">
          {{ selectedInstanceInfo.instanceFamily }}
        </div>
      </div>

      <div class="info-item">
        <div class="info-item__label">
          {{ t('capt.instanceType.table.columns.vcpus') }}
        </div>
        <div class="info-item__value">
          {{ selectedInstanceInfo.vcpus }} vCPU
        </div>
      </div>

      <div class="info-item">
        <div class="info-item__label">
          {{ t('capt.instanceType.table.columns.memory') }}
        </div>
        <div class="info-item__value">
          {{ selectedInstanceInfo.memory }} GiB
        </div>
      </div>

      <div class="info-item">
        <div class="info-item__label">
          {{ t('capt.instanceType.table.columns.zone') }}
        </div>
        <div class="info-item__value">
          {{ selectedInstanceInfo.zone }}
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.title {
  margin: 0 0 10px;
  font-size: 16px;
  font-weight: 700;
  color: #1f2937;
}
.error {
  color: var(--error);
}
.instance-type {
  font-size: 14px;
  display: flex;
  justify-content: flex-start;
  align-items: center;
  color: var(--input-label);
}
.checkbox-outer-container {
  margin-top: 7px;
}
.selected-instance-card {
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 16px 20px;
  &__header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 16px;
    margin-bottom: 16px;
    flex-wrap: wrap;
  }
  &__title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 600;
    color: var(--body-text);
    .icon {
      color: var(--success);
      font-size: 16px;
    }
  }
  &__tip {
    font-size: 12px;
    color: var(--input-label);
    line-height: 1.5;
  }
  &__grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 16px;
  }
}
.info-item {
  min-width: 0;
  &__label {
    font-size: 12px;
    color: var(--input-label);
    margin-bottom: 6px;
    line-height: 1.4;
  }
  &__value {
    font-size: 14px;
    font-weight: 500;
    color: var(--body-text);
    word-break: break-word;
    line-height: 1.5;
  }
}
</style>
