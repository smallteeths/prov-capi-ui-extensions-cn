<script>
import { CAPI, DEFAULT_WORKSPACE } from '@shell/config/types';
import { STATE, AGE } from '@shell/config/table-headers';
import { colorForState, stateDisplay, stateSort } from '@shell/plugins/dashboard-store/resource-class';
import { RcButton } from '@components/RcButton';
import ResourceTable from '@shell/components/ResourceTable';
import Masthead from '@shell/components/ResourceList/Masthead';
import Banner from '@components/Banner/Banner.vue';
import Loading from '@shell/components/Loading';
import { exceptionToErrorsArray } from '@shell/utils/error';
import {
  deleteCaptClusterResources,
  isCaptCapiCluster,
} from '../utils';
import {
  CAPT_CLUSTERS_CREATE_ROUTE,
  CAPT_CLUSTERS_EDIT_ROUTE,
  CAPT_CLUSTERS_PAGE,
  TKE_MACHINE_POOL_SCHEMA,
} from '../types/capt';

export default {
  name: 'CaptClustersList',

  components: {
    ResourceTable, Masthead, Banner, Loading, RcButton
  },

  data() {
    return {
      loading:  true,
      errors:   [],
      resource: CAPT_CLUSTERS_PAGE,
      schema:   null,
    };
  },

  async fetch() {
    this.loading = true;
    this.errors = [];

    try {
      this.schema = this.$store.getters['management/schemaFor'](CAPI.CAPI_CLUSTER, true, false);
      await Promise.all([
        this.$store.dispatch('management/findAll', {
          type: CAPI.CAPI_CLUSTER,
          opt:  { watch: true },
        }),
        this.$store.dispatch('management/findAll', {
          type: CAPI.RANCHER_CLUSTER,
          opt:  { watch: true },
        }).catch(() => []),
        this.$store.dispatch('management/findAll', {
          type: TKE_MACHINE_POOL_SCHEMA,
          opt:  { watch: true },
        }).catch(() => []),
      ]);
    } catch (e) {
      this.errors = exceptionToErrorsArray(e);
    } finally {
      this.loading = false;
    }
  },

  computed: {
    headers() {
      return [
        STATE,
        {
          name:     'name',
          labelKey: 'tableHeaders.name',
          value:    'nameDisplay',
          sort:     ['nameSort'],
          search:   ['nameDisplay', 'metadata.name'],
        },
        {
          name:     'namespace',
          labelKey: 'tableHeaders.namespace',
          value:    'namespace',
          sort:     'namespace',
          width:    140,
        },
        {
          name:     'endpoint',
          labelKey: 'capt.hostedNav.columns.endpoint',
          value:    'endpointDisplay',
          sort:     'endpointDisplay',
        },
        AGE,
      ];
    },

    rows() {
      const all = this.$store.getters['management/all'](CAPI.CAPI_CLUSTER) || [];

      return all.filter((row) => isCaptCapiCluster(row)).map((cluster) => this.toRow(cluster));
    },

    createLocation() {
      return {
        name:   CAPT_CLUSTERS_CREATE_ROUTE,
        params: {
          cluster: this.$route.params.cluster,
          product: 'manager',
        },
      };
    },

    typeDisplay() {
      return this.t('capt.hostedNav.label');
    },
  },

  methods: {
    editLocation(row) {
      return {
        name:   CAPT_CLUSTERS_EDIT_ROUTE,
        params: {
          cluster:   this.$route.params.cluster,
          product:   'manager',
          namespace: row.namespace || DEFAULT_WORKSPACE,
          id:        row.metadata?.name || row.name,
        },
        query: { mode: 'edit' },
      };
    },

    findRancherCluster(cluster) {
      const name = cluster.metadata?.name;
      const namespace = cluster.metadata?.namespace;
      const all = this.$store.getters['management/all'](CAPI.RANCHER_CLUSTER) || [];

      return all.find((rancher) => {
        const labels = rancher.metadata?.labels || {};
        const annotations = rancher.metadata?.annotations || {};
        const labeledName = labels['cluster-api.cattle.io/cluster-name'];
        const labeledNamespace = labels['cluster-api.cattle.io/cluster-namespace'];

        if (labeledName === name && (!labeledNamespace || labeledNamespace === namespace)) {
          return true;
        }

        if (annotations['cluster.x-k8s.io/cluster-name'] === name) {
          return true;
        }

        return rancher.metadata?.name === name && rancher.metadata?.namespace === namespace;
      });
    },

    capiState(cluster) {
      const phase = cluster.status?.phase || '';
      const ready = (cluster.status?.conditions || []).find((condition) => condition.type === 'Ready');
      const failed = phase === 'Failed' || (ready?.status === 'False' && /fail|error/i.test(`${ ready.reason || '' } ${ ready.message || '' }`));
      let key = 'provisioning';
      let transitioning = true;
      let error = false;

      if (phase === 'Deleting') {
        key = 'removing';
      } else if (failed) {
        key = 'failed';
        transitioning = false;
        error = true;
      } else if (phase === 'Provisioned' || ready?.status === 'True') {
        key = 'active';
        transitioning = false;
      } else if (!phase) {
        key = 'pending';
      }

      const color = colorForState(key, error, transitioning);
      const display = stateDisplay(key);

      return {
        stateDisplay:     display,
        stateBackground:  color.replace('text-', 'bg-'),
        stateDescription: transitioning || error ? (ready?.message || '') : '',
        stateSort:        stateSort(color, display),
        stateObj:         {
          name: key, error, transitioning, message: ready?.message || ''
        },
      };
    },

    isUpdatingState(resource) {
      const name = `${ resource?.stateObj?.name || resource?.metadata?.state?.name || resource?.state || '' }`.toLowerCase();
      const display = `${ resource?.stateDisplay || '' }`.toLowerCase();

      return resource?.stateObj?.transitioning === true || name === 'updating' || display === 'updating';
    },

    updatingState() {
      const color = colorForState('updating', false, true);
      const display = stateDisplay('updating');

      return {
        stateDisplay:     display,
        stateBackground:  color.replace('text-', 'bg-'),
        stateDescription: '',
        stateSort:        stateSort(color, display),
        stateObj:         {
          name: 'updating', error: false, transitioning: true, message: ''
        },
      };
    },

    poolsUpdating(cluster) {
      const name = cluster.metadata?.name;
      const namespace = cluster.metadata?.namespace;
      const pools = this.$store.getters['management/all'](TKE_MACHINE_POOL_SCHEMA) || [];

      return pools.some((pool) => {
        const labels = pool.metadata?.labels || {};
        const sameNamespace = !namespace || pool.metadata?.namespace === namespace;
        const sameCluster = labels['cluster.x-k8s.io/cluster-name'] === name;

        return sameNamespace && sameCluster && pool.status?.ready === false;
      });
    },

    toRow(cluster) {
      const endpoint = cluster.spec?.controlPlaneEndpoint || cluster.status?.controlPlaneEndpoint || {};
      const host = endpoint.host || '';
      const port = endpoint.port;
      const endpointDisplay = host ? (port ? `${ host }:${ port }` : host) : '—';
      const self = this;
      const rancher = this.findRancherCluster(cluster);
      let state = rancher ? {
        stateDisplay:     rancher.stateDisplay,
        stateBackground:  rancher.stateBackground,
        stateDescription: rancher.stateDescription || '',
        stateSort:        rancher.stateSort,
        stateObj:         rancher.stateObj,
      } : this.capiState(cluster);

      if (this.isUpdatingState(cluster) && cluster.stateBackground) {
        state = {
          stateDisplay:     cluster.stateDisplay,
          stateBackground:  cluster.stateBackground,
          stateDescription: cluster.stateDescription || '',
          stateSort:        cluster.stateSort,
          stateObj:         cluster.stateObj,
        };
      } else if (this.poolsUpdating(cluster) && !['failed', 'error', 'removing'].includes(`${ state.stateObj?.name || '' }`.toLowerCase())) {
        state = this.updatingState();
      }

      return {
        id:                cluster.id || `${ cluster.metadata?.namespace }/${ cluster.metadata?.name }`,
        type:              cluster.type,
        metadata:          cluster.metadata,
        name:              cluster.metadata?.name,
        nameDisplay:       cluster.nameDisplay || cluster.metadata?.name,
        nameSort:          cluster.nameSort || (cluster.metadata?.name || '').toLowerCase(),
        namespace:         cluster.metadata?.namespace || DEFAULT_WORKSPACE,
        ...state,
        creationTimestamp: cluster.creationTimestamp || cluster.metadata?.creationTimestamp,
        endpointDisplay,
        availableActions:  [
          {
            action:  'edit',
            label:   this.t('action.edit'),
            icon:    'icon icon-edit',
            enabled: true,
            invoke:  () => {
              self.$router.push(self.editLocation(cluster));
            },
          },
          {
            action:   'remove',
            label:    this.t('action.remove'),
            icon:     'icon icon-trash',
            enabled:  true,
            bulkable: true,
            invoke:   async(opts, resources) => {
              await self.removeRows(resources?.length ? resources : [{ _cluster: cluster }]);
            },
          },
        ],
        _cluster: cluster,
      };
    },

    async removeRows(resources) {
      this.errors = [];

      const context = {
        dispatch: this.$store.dispatch,
        getters:  this.$store.getters,
        t:        (...args) => this.t(...args),
      };

      try {
        for (const row of resources) {
          const cluster = row._cluster || row;

          await deleteCaptClusterResources(cluster, context);
        }
      } catch (e) {
        this.errors = exceptionToErrorsArray(e);
      }
    },

    closeError(index) {
      this.errors.splice(index, 1);
    },
  },
};
</script>

<template>
  <Loading v-if="loading" />
  <div v-else>
    <Masthead
      :schema="schema"
      :resource="resource"
      :type-display="typeDisplay"
      :is-creatable="true"
      :create-location="createLocation"
      :create-button-label="t('capt.hostedNav.create')"
      :is-yaml-creatable="false"
      :show-favorite="false"
    >
      <template #createButton>
        <RcButton
          variant="primary"
          size="large"
          data-testid="capt-clusters-create"
          :to="createLocation"
        >
          {{ t('capt.hostedNav.create') }}
        </RcButton>
      </template>
    </Masthead>
    <Banner
      v-for="(err, i) in errors"
      :key="i"
      color="error"
      :label="err"
      :closable="true"
      @close="closeError(i)"
    />
    <ResourceTable
      :schema="schema"
      :rows="rows"
      :headers="headers"
      :loading="loading"
      :groupable="false"
      key-field="id"
      data-testid="capt-clusters-list"
    >
      <template #cell:name="{row}">
        <router-link :to="editLocation(row)">
          {{ row.nameDisplay }}
        </router-link>
      </template>
    </ResourceTable>
  </div>
</template>
