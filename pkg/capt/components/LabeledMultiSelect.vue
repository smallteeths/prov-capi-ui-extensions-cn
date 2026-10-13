<template>
  <div
    class="multi-select labeled-multi-select"
    :class="{ 'labeled-multi-select-focused': isOpen, disabled: disabled }"
  >
    <div
      :class="{ 'is-open': isOpen }"
      @click="toggleDropdown"
    >
      <div
        :class="{ 'labeled-container': true, [mode]: true }"
        :style="{ border: 'none' }"
      >
        <label v-if="hasLabel">
          <t
            v-if="labelKey"
            :k="labelKey"
          />
          <template v-else-if="label">{{ label }}</template>
          <span
            v-if="required || requiredField"
            class="required"
          >*</span>
        </label>
      </div>
      <div class="multiple-input">
        <div
          tabindex="0"
          class="multiple-input-options"
          @focus="onFocusLabeled"
          @blur="onBlurLabeled"
        >
          <span
            v-if="selectedItems.length === 0"
            class="placeholder"
          >
            {{ props.placeholder }}
          </span>
          <v-dropdown
            v-for="item in selectedItems"
            :key="item.value"
            theme="selected-item-tooltip-cn"
            placement="top"
            :triggers="['hover', 'focus']"
            :delay="{ show: 150, hide: 0 }"
          >
            <span class="selected-item">
              <span class="item">
                {{ item.label }}
              </span>
              <span
                v-if="!disabled"
                class="remove-item"
                @click.stop="removeItem(item)"
              >×</span>
            </span>
            <template #popper>
              <div class="selected-item-tooltip">
                {{ item.label }}
              </div>
            </template>
          </v-dropdown>
        </div>
        <div class="multiple-input-actions">
          <span
            class="arrow"
            :class="{ 'arrow-up': isOpen }"
          >
            <i
              class="icon icon-chevron-down cluster-select__arraw"
              :class="[isOpen ? 'icon-chevron-up' : 'icon-chevron-down']"
            />
          </span>
        </div>
      </div>
      <LabeledTooltip
        v-if="!!validationMessage"
        :value="validationMessage"
      />
      <i
        v-if="loading"
        class="icon icon-spinner icon-spin icon-lg"
      />
    </div>
    <div
      v-if="isOpen"
      class="dropdown"
    >
      <div>
        <div
          v-if="options.length === 0"
          class="on-options"
        >
          {{ intl('labelSelect.noOptions.empty') }}
        </div>
        <div v-else>
          <div
            v-for="option in options"
            :key="option.value"
            class="option"
            :class="{ selected: isSelected(option) }"
            @click="toggleOption(option)"
          >
            <div>
              {{ option.label }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useStore } from 'vuex';
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { _VIEW } from '@shell/config/query-params';
import { LabeledTooltip } from '@components/LabeledTooltip';
import _ from 'lodash';

const props = defineProps({
  options: {
    type:      Array,
    default:   () => [],
    validator: (options) => options.every((opt) => 'value' in opt && 'label' in opt)
  },
  rules: {
    default:   () => [],
    type:      Array,
    // we only want functions in the rules array
    validator: (rules) => rules.every((rule) => ['function'].includes(typeof rule))
  },
  value: {
    type:    Array,
    default: () => []
  },
  placeholder: {
    type:    String,
    default: ''
  },
  label: {
    type:    String,
    default: ''
  },
  labelKey: {
    type:    String,
    default: ''
  },
  mode: {
    type:     String,
    required: true
  },
  required: {
    default: false,
    type:    Boolean
  },
  disabled: {
    default: false,
    type:    Boolean
  },
  loading: {
    default: false,
    type:    Boolean
  },
});

const emit = defineEmits(['update:value']);
const store = useStore();
const intl = computed(() => store.getters['i18n/t']);

const isOpen = ref(false);

const state = ref({
  raised:  props.mode === _VIEW || !!`${ props.value }`,
  focused: false,
  blurred: null,
});
const selectedItems = computed(() => {
  return props.options.filter((option) => props.value.includes(option.value));
});

const hasLabel = computed(() => {
  return !!props.label || !!props.labelKey;
});

const requiredField = computed(() => {
  // using "any" for a type on "rule" here is dirty but the use of the optional chaining operator makes it safe for what we're doing here.
  return (props.required || props.rules.some((rule) => rule?.name === 'required'));
});

const validationMessage = computed(() => {
  const requiredRule = props.rules.find((rule) => rule?.name === 'required');
  const ruleMessages = [];

  if (requiredRule && state.value.blurred && !state.value.focused) {
    const message = requiredRule(props.value);

    if (message) {
      return message;
    }
  }

  for (const rule of props.rules) {
    const message = rule(props.value);

    if (message && rule.name !== 'required') {
      ruleMessages.push(message);
    }
  }

  if (ruleMessages.length > 0 && (state.value.blurred || state.value.focused)) {
    return ruleMessages.join(', ');
  } else {
    return undefined;
  }
});

const onFocusLabeled = () => {
  if (props.disabled) {
    return;
  }
  state.value.focused = true;
  state.value.blurred = null;
};

const onBlurLabeled = () => {
  if (props.disabled) {
    return;
  }
  state.value.focused = false;
  state.value.blurred = Date.now();
};

const toggleDropdown = () => {
  if (props.disabled) {
    return;
  }
  isOpen.value = !isOpen.value;
};

const isSelected = (option) => {
  return _.includes(props.value, option.value);
};

const toggleOption = (option) => {
  const newValue = isSelected(option) ? _.without(props.value, option.value) : _.union(props.value, [option.value]);

  emit('update:value', newValue);
};

const removeItem = (item) => {
  const newValue = _.without(props.value, item.value);

  emit('update:value', newValue);
};

const closeDropdown = (e) => {
  if (!e.target.closest('.labeled-multi-select')) {
    isOpen.value = false;
  }
};

onMounted(() => {
  document.addEventListener('click', closeDropdown);
});

onUnmounted(() => {
  document.removeEventListener('click', closeDropdown);
});
</script>

<style lang='scss' scoped>
.labeled-multi-select-focused {
  border: solid 1px var(--primary) !important;
  border-radius: 4px 4px 0px 0px !important;
}
.disabled {
  background-color: var(--input-disabled-bg) !important;

  .placeholder {
    color: var(--input-disabled-placeholder);
  }
}
.labeled-multi-select {
  position: relative;
  padding-bottom: 1px;
  position: relative;
  box-sizing: border-box;
  width: 100%;
  padding-bottom: 2px;
  background-color: var(--input-bg);
  border-radius: var(--border-radius);
  border: solid var(--border-width) var(--input-border);
  color: var(--input-text);

  &.no-label.compact-input {
    :deep() .vs__actions:after {
      top: -2px;
    }
    .labeled-container {
      padding: 5px 0 1px 10px;
    }
  }

  &.no-label:not(.compact-input) {
    height: $input-height;
    padding-top: 4px;
    :deep() .vs__actions:after {
      top: 0;
    }
  }

  .icon-spinner {
    position: absolute;
    left: calc(50% - .5em);
    top: calc(50% - .5em);
  }

  .labeled-container {
    padding: $input-padding-sm 0 0 $input-padding-sm;
    label {
      margin: 0;
    }
    .selected {
      background-color: transparent;
    }
  }

  .required {
    color: var(--error);
  }

  .multiple-input {
    display: flex;
    background-color: transparent;
    .multiple-input-options {
      display: flex;
      flex: 1 1 auto;
      align-items: center;
      flex-wrap: wrap;
      padding: 0;
      position: relative;
      overflow: hidden;
      min-width: 0;
      height: 30px;
      background-color: transparent;
    }
    .placeholder {
      margin-left: 10px;
      color: var(--input-placeholder);
      font-size: 14px;
      line-height: 18px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      pointer-events: none;
    }
    .multiple-input-actions {
      display: flex;
      padding: 0px 4px;
      pointer-events: none;
      position: relative;
      width: auto;
      flex: 0 0 auto;
      justify-content: flex-end;
      background-color: transparent;
    }
  }

  .hidden-input {
    width: 0;
    height: 0;
    opacity: 0;
    position: absolute;
    pointer-events: none; /* Prevent direct interaction with the input */
  }

  .selected-item {
    background: var(--dropdown-hover-bg);
    padding: 2px 4px;
    border-radius: 2px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 2px;
    max-width: 150px;
    text-overflow: ellipsis;
    white-space: nowrap;
    margin-left: 4px;
    margin-top: 4px;
    height: 25px;
    cursor: pointer;
    .item {
      display: block;
      max-width: 130px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      margin-right: 5px;
    }
    .remove-item {
      cursor: pointer;
      font-size: 12px;
      line-height: 16px;
    }
  }

  .dropdown {
    position: absolute;
    top: 100%;
    left: -1px;
    right: 0;
    border: solid 1px var(--primary);
    border-top: 1px solid transparent;
    border-radius: 0px 0px 4px 4px;
    background: white;
    margin-top: 1px;
    max-height: 200px;
    overflow-y: auto;
    z-index: 1000;
    padding: 10px 0px 5px;
    width: calc(100% + 2px);

    .on-options {
      padding: 10px 10px;
    }
  }

  .option {
    padding: 2px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 3px 5px;
  }

  .option:hover {
    background: var(--dropdown-hover-bg) !important;
    color: var(--input-text);
  }

  .selected {
    background: var(--dropdown-active-bg) !important;
    color: #fff;
  }
}
:deep(.v-popper--theme-selected-item-tooltip-cn .v-popper__inner) {
  position: relative;
  background: var(--body-bg);
  color: var(--body-text);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 8px 10px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
  overflow: visible;
}
:deep(.v-popper--theme-selected-item-tooltip-cn .v-popper__arrow-container) {
  content: '';
  display: block;
  position: absolute;
  left: 50%;
  bottom: -6px;
  width: 10px;
  height: 10px;
  background: var(--body-bg);
  border-right: 1px solid var(--border);
  border-bottom: 1px solid var(--border);
  transform: translateX(-50%) rotate(45deg);
  box-sizing: border-box;
  pointer-events: none;
  z-index: 1;
}
</style>
