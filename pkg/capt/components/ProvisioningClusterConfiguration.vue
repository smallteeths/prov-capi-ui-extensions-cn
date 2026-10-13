<script setup lang="ts">
import { toRefs, watch } from 'vue';
import { _CREATE, _VIEW } from '@shell/config/query-params';

defineOptions({ name: 'ProvisioningClusterConfiguration' });

const emit = defineEmits<{(e: 'update:value', value: any): void, (e: 'validationChanged', value: boolean): void }>();

interface Props {
  value: any;
  mode: string;
}

const props = withDefaults(defineProps<Props>(), {
  mode:  _CREATE,
  value: () => ({})
});

const {
  mode,
  value,
} = toRefs(props);

watch(() => value.value, () => {
  emit('update:value', value.value);
  emit('validationChanged', mode.value === _VIEW || true);
}, { immediate: true });
</script>

<template>
  <div />
</template>
