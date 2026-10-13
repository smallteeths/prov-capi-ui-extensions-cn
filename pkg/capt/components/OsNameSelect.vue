<script setup>
import { useStore } from 'vuex';
import { computed, ref, watch } from 'vue';
import LabeledSelect from '@shell/components/form/LabeledSelect.vue';
import { queryFromTencent } from '../util/request';
import CONFIG from '../util/config';

const props = defineProps({
  value: {
    type:    String,
    default: '',
  },
  mode: {
    type:    String,
    default: 'create',
  },
  disabled: {
    type:    Boolean,
    default: false,
  },
  rules: {
    type:    Array,
    default: () => [],
  },
  cloudCredentialId: {
    type:    String,
    default: '',
  },
  zoneId: {
    type:    String,
    default: '',
  },
  arch: {
    type:    String,
    default: '',
  },
});

const emit = defineEmits(['update:value']);
const state = ref({
  imageOptionsLoading: false,
  errors:              [],
});

const options = ref({
  imageOptions: {
    arm:   [],
    amd64: [],
  },
});

const store = useStore();
const selectedFamily = ref('');

function getImageArch(item = {}) {
  const text = `${ item.OsName || '' } ${ item.Alias || '' }`.toLowerCase();

  if (
    text.includes('arm64') ||
    text.includes('arm_64') ||
    text.includes('(arm64)')
  ) {
    return 'arm';
  }

  return 'amd64';
}

function getImageFamily(item = {}) {
  const text = `${ item.OsName || '' } ${ item.Alias || '' }`.toLowerCase();

  if (text.includes('ubuntu')) {
    return 'ubuntu';
  }
  if (text.includes('centos') && !text.includes('tencentos')) {
    return 'centos';
  }
  if (text.includes('redhat') || text.includes('red hat')) {
    return 'redhat';
  }
  if (text.includes('kylin')) {
    return 'kylin';
  }
  if (text.includes('linux') && !text.includes('tencentos')) {
    return 'linux';
  }
  if (text.includes('tencentos')) {
    return 'tencentos';
  }

  return 'other';
}

function getFamilyLabel(family) {
  const map = {
    ubuntu:    'Ubuntu',
    centos:    'CentOS',
    redhat:    'RedHat',
    kylin:     'Kylin',
    linux:     'Linux',
    tencentos: 'TencentOS',
    other:     'Other',
  };

  return map[family] || family;
}

function extractVersionParts(text = '') {
  const lower = String(text).toLowerCase();
  const match = lower.match(/(\d+)(?:[._](\d+))?(?:[._](\d+))?/);

  if (!match) {
    return [0, 0, 0];
  }

  return [
    Number(match[1] || 0),
    Number(match[2] || 0),
    Number(match[3] || 0),
  ];
}

function compareVersionDesc(a, b) {
  const aText = `${ a.label || '' } ${ a.value || '' }`;
  const bText = `${ b.label || '' } ${ b.value || '' }`;

  const aParts = extractVersionParts(aText);
  const bParts = extractVersionParts(bText);

  for (let i = 0; i < 3; i++) {
    if (aParts[i] !== bParts[i]) {
      return bParts[i] - aParts[i];
    }
  }

  return a.label.localeCompare(b.label, 'zh-Hans-CN');
}

function buildImageOptions(imageList = []) {
  const grouped = {
    arm:   {},
    amd64: {},
  };

  imageList.forEach((item) => {
    if (!item.Status || item.Status !== 'online') {
      return;
    }
    // TODO: re-enable when tlinux4.0(tkernel5)x86_64_uefi is supported
    if (item.OsName === 'tlinux4.0(tkernel5)x86_64_uefi') {
      return;
    }
    const arch = getImageArch(item);
    const family = getImageFamily(item);

    if (!grouped[arch][family]) {
      grouped[arch][family] = [];
    }

    const exists = grouped[arch][family].some((x) => x.value === item.OsName);

    if (!exists) {
      grouped[arch][family].push({
        label: item.Alias || item.OsName || '',
        value: item.OsName || '',
        raw:   item,
      });
    }
  });

  const familyOrder = ['tencentos', 'ubuntu', 'redhat', 'centos', 'kylin', 'linux', 'other'];

  const toGroups = (archMap) => Object.keys(archMap)
    .sort((a, b) => {
      const ai = familyOrder.indexOf(a);
      const bi = familyOrder.indexOf(b);

      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    })
    .map((family) => ({
      label:    getFamilyLabel(family),
      value:    family,
      children: archMap[family].sort(compareVersionDesc),
    }));

  return {
    arm:   toGroups(grouped.arm),
    amd64: toGroups(grouped.amd64),
  };
}

const currentArch = computed(() => {
  const text = (props.arch || '').toLowerCase();

  return text.includes('arm') ? 'arm' : 'amd64';
});

const familyOptions = computed(() => {
  return (options.value.imageOptions[currentArch.value] || []).map((item) => ({
    label: item.label,
    value: item.value,
  }));
});

const currentImageOptions = computed(() => {
  const group = (options.value.imageOptions[currentArch.value] || []).find((item) => item.value === selectedFamily.value);

  return group?.children || [];
});

function syncFamilyByOsName(osName) {
  if (!osName) {
    selectedFamily.value = '';

    return;
  }

  const groups = options.value.imageOptions[currentArch.value] || [];

  for (const group of groups) {
    const found = group.children?.find((item) => item.value === osName);

    if (found) {
      selectedFamily.value = group.value;

      return;
    }
  }

  selectedFamily.value = '';
}

function handleFamilyChange(family) {
  selectedFamily.value = family;

  const group = (options.value.imageOptions[currentArch.value] || []).find((item) => item.value === family);
  const firstImage = group?.children?.[0];

  emit('update:value', firstImage?.value || '');
}

async function fetchImages(cloudCredentialId, zoneId) {
  state.value.imageOptionsLoading = true;

  try {
    const res = await queryFromTencent({
      resource:       'images',
      cloudCredentialId,
      store,
      externalParams: { zoneId: zoneId || '' },
    });

    const imageList = res?.Response?.OSImageSeriesSet || CONFIG.OS_IMAGE || [];

    options.value.imageOptions = buildImageOptions(imageList);

    syncFamilyByOsName(props.value);

    const groups = options.value.imageOptions[currentArch.value] || [];
    const hasCurrentValue = groups.some((group) => group.children?.some((item) => item.value === props.value));

    if (!hasCurrentValue && groups.length > 0) {
      const firstGroup = groups[0];
      const firstImage = firstGroup?.children?.[0];

      selectedFamily.value = firstGroup?.value || '';

      if (!props.disabled && !props.value) {
        emit('update:value', firstImage?.value || '');
      }
    } else if (!selectedFamily.value && groups.length > 0) {
      selectedFamily.value = groups[0].value;
    }
  } catch (err) {
    state.value.errors = [err];
    options.value.imageOptions = {
      arm:   [],
      amd64: [],
    };
    selectedFamily.value = '';

    if (!props.disabled && !props.value) {
      emit('update:value', '');
    }
  } finally {
    state.value.imageOptionsLoading = false;
  }
}

watch(
  () => [props.cloudCredentialId, props.zoneId],
  async([cloudCredentialId, zoneId]) => {
    if (!cloudCredentialId) {
      options.value.imageOptions = { arm: [], amd64: [] };
      selectedFamily.value = '';

      if (!props.disabled && !props.value) {
        emit('update:value', '');
      }

      return;
    }

    await fetchImages(cloudCredentialId, zoneId);
  },
  { immediate: true }
);

watch(
  () => props.value,
  (val) => {
    syncFamilyByOsName(val);
  },
  { immediate: true }
);
</script>

<template>
  <div class="row mb-10">
    <div class="col span-6">
      <LabeledSelect
        :value="selectedFamily"
        data-testid="capt-resource-os-family"
        :mode="mode"
        :options="familyOptions"
        option-label="label"
        option-key="value"
        label-key="capt.os.label"
        :loading="state.imageOptionsLoading"
        :disabled="disabled"
        @update:value="handleFamilyChange"
      />
    </div>
    <div class="col span-6">
      <LabeledSelect
        :value="value"
        data-testid="capt-resource-os-name"
        required
        :mode="mode"
        :options="currentImageOptions"
        option-label="label"
        option-key="value"
        label-key="capt.image.label"
        :loading="state.imageOptionsLoading"
        :disabled="disabled || !selectedFamily"
        :rules="rules"
        @update:value="$emit('update:value', $event)"
      />
    </div>
  </div>
</template>
