<script>
import { CAPI, DEFAULT_WORKSPACE } from '@shell/config/types';
import { _CREATE, _EDIT, _VIEW, MODE } from '@shell/config/query-params';
import Loading from '@shell/components/Loading';
import Banner from '@components/Banner/Banner.vue';
import { exceptionToErrorsArray } from '@shell/utils/error';
import CruCapt from '../components/CruCapt.vue';

export default {
  name: 'CaptClusterCreateEdit',

  components: {
    CruCapt, Loading, Banner
  },

  data() {
    return {
      loading: true,
      errors:  [],
      value:   null,
      mode:    _CREATE,
    };
  },

  async fetch() {
    await this.load();
  },

  methods: {
    async load() {
      this.loading = true;
      this.errors = [];

      try {
        const { namespace, id } = this.$route.params;
        const queryMode = this.$route.query?.[MODE];

        if (!id || id === 'create') {
          this.mode = _CREATE;
          this.value = await this.$store.dispatch('management/create', {
            type:     CAPI.CAPI_CLUSTER,
            metadata: {
              namespace: DEFAULT_WORKSPACE,
              name:      '',
            },
            spec: {},
          });
        } else {
          this.mode = queryMode === _VIEW ? _VIEW : _EDIT;
          this.value = await this.$store.dispatch('management/find', {
            type: CAPI.CAPI_CLUSTER,
            id:   `${ namespace || DEFAULT_WORKSPACE }/${ id }`,
          });
        }
      } catch (e) {
        this.errors = exceptionToErrorsArray(e);
        this.value = null;
      } finally {
        this.loading = false;
      }
    },
  },
};
</script>

<template>
  <Loading v-if="loading" />
  <div v-else-if="errors.length && !value">
    <Banner
      v-for="(err, i) in errors"
      :key="i"
      color="error"
      :label="err"
    />
  </div>
  <CruCapt
    v-else-if="value"
    :value="value"
    :mode="mode"
  />
</template>
