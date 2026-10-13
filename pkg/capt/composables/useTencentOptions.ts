import { ref } from 'vue';
import { queryFromTencent } from '../util/request';
import type { SelectOption } from '../types/capt';

interface TencentOptions {
  regionOptions: SelectOption[];
  versionOptions: SelectOption[];
  zoneOptions: SelectOption[];
  vpcOptions: SelectOption[];
  subnetOptions: SelectOption[];
  securityGroupOptions: SelectOption[];
  keyPairOptions: SelectOption[];
}

interface SubnetOption extends SelectOption {
  vpcId?: string;
  zone?: string;
}

export function useTencentOptions({ store, intl }: { store: any; intl: { value?: (key: string) => string } }) {
  const errors = ref<unknown[]>([]);
  const loading = ref({
    regions:        false,
    versions:       false,
    zones:          false,
    vpcs:           false,
    subnets:        false,
    securityGroups: false,
    instanceTypes:  false,
    keyPairs:       false,
  });
  const options = ref<TencentOptions>({
    regionOptions:        [],
    versionOptions:       [],
    zoneOptions:          [],
    vpcOptions:           [],
    subnetOptions:        [],
    securityGroupOptions: [],
    keyPairOptions:       [],
  });
  const allSubnets = ref<SubnetOption[]>([]);
  const instanceTypeSet = ref<Record<string, SelectOption[]>>({});

  function pushError(err: unknown) {
    if (!err) {
      return;
    }
    errors.value = [...errors.value, err];
  }

  async function fetchRegion(cloudCredentialId: string) {
    loading.value.regions = true;
    try {
      const res = await queryFromTencent({
        resource:       'regions',
        cloudCredentialId,
        store,
        externalParams: {},
      });

      options.value.regionOptions = (res?.Response?.RegionInstanceSet || []).map((region: any) => ({
        label: intl.value ? intl.value(`capt.regions.${ region.RegionName }`) : region.RegionName,
        value: region.RegionName,
      }));
    } catch (err) {
      options.value.regionOptions = [];
      pushError(err);
    }
    loading.value.regions = false;
  }

  async function fetchClusterVersion(cloudCredentialId: string, regionId: string) {
    loading.value.versions = true;
    try {
      const res = await queryFromTencent({
        resource:       'versions',
        cloudCredentialId,
        store,
        externalParams: { regionId },
      });

      options.value.versionOptions = (res?.Response?.VersionInstanceSet || []).map((item: any) => ({
        label: item.Version,
        value: item.Version,
      }));
    } catch (err) {
      options.value.versionOptions = [];
      pushError(err);
    }
    loading.value.versions = false;
  }

  async function fetchZone(cloudCredentialId: string, regionId: string) {
    loading.value.zones = true;
    try {
      const res = await queryFromTencent({
        resource:       'zones',
        cloudCredentialId,
        store,
        externalParams: { regionId },
      });

      options.value.zoneOptions = (res?.Response?.ZoneSet || []).map((zone: any) => ({
        label: zone.ZoneName,
        value: zone.Zone,
      }));
    } catch (err) {
      options.value.zoneOptions = [];
      pushError(err);
    }
    loading.value.zones = false;
  }

  async function fetchVpc(cloudCredentialId: string, regionId: string) {
    loading.value.vpcs = true;
    try {
      const res = await queryFromTencent({
        resource:       'vpcs',
        cloudCredentialId,
        store,
        externalParams: { regionId },
      });

      options.value.vpcOptions = (res?.Response?.VpcSet || []).map((vpc: any) => ({
        label: vpc.VpcName,
        value: vpc.VpcId,
        raw:   vpc,
      }));
    } catch (err) {
      options.value.vpcOptions = [];
      pushError(err);
    }
    loading.value.vpcs = false;
  }

  async function fetchSubnets(cloudCredentialId: string, regionId: string) {
    loading.value.subnets = true;
    try {
      const res = await queryFromTencent({
        resource:       'subnets',
        cloudCredentialId,
        store,
        externalParams: { regionId },
      });

      allSubnets.value = (res?.Response?.SubnetSet || []).map((subnet: any) => ({
        ...subnet,
        label: subnet.SubnetName,
        value: subnet.SubnetId,
        vpcId: subnet.VpcId,
        zone:  subnet.Zone,
      }));
    } catch (err) {
      allSubnets.value = [];
      pushError(err);
    }
    loading.value.subnets = false;
  }

  async function fetchSecurityGroup(cloudCredentialId: string, regionId: string) {
    loading.value.securityGroups = true;
    try {
      const res = await queryFromTencent({
        resource:       'securityGroups',
        cloudCredentialId,
        store,
        externalParams: { regionId },
      });

      options.value.securityGroupOptions = (res?.Response?.SecurityGroupSet || []).map((securityGroup: any) => ({
        label: securityGroup.SecurityGroupName,
        value: securityGroup.SecurityGroupId,
      }));
    } catch (err) {
      options.value.securityGroupOptions = [];
      pushError(err);
    }
    loading.value.securityGroups = false;
  }

  async function fetchInstanceTypes(cloudCredentialId: string, regionId: string) {
    loading.value.instanceTypes = true;
    try {
      const res = await queryFromTencent({
        resource:       'zoneInstanceConfigInfos',
        cloudCredentialId,
        store,
        externalParams: { regionId },
      });
      const allInstances = res?.Response?.InstanceTypeQuotaSet || [];
      const out: Record<string, SelectOption[]> = {};

      allInstances.forEach((instance: any) => {
        if (instance.Status !== 'SELL' || instance.InstanceChargeType !== 'POSTPAID_BY_HOUR') {
          return;
        }

        const item: SelectOption = {
          value: instance.InstanceType,
          label: `${ instance.TypeName } (CPU ${ instance.Cpu } Memory ${ instance.Memory } GiB)`,
          group: instance.InstanceFamily,
          zone:  instance.Zone,
          raw:   instance,
        };

        if (!out[instance.Zone]) {
          out[instance.Zone] = [item];
        } else {
          out[instance.Zone].push(item);
        }
      });
      instanceTypeSet.value = out;
    } catch (err) {
      instanceTypeSet.value = {};
      pushError(err);
    }
    loading.value.instanceTypes = false;
  }

  async function fetchKeyPair(cloudCredentialId: string, regionId: string) {
    loading.value.keyPairs = true;
    try {
      const res = await queryFromTencent({
        resource:       'keyPairs',
        cloudCredentialId,
        store,
        externalParams: { regionId },
      });

      options.value.keyPairOptions = (res?.Response?.KeyPairSet || []).map((keyPair: any) => ({
        label: keyPair.KeyName,
        value: keyPair.KeyId,
      }));
    } catch (err) {
      options.value.keyPairOptions = [];
      pushError(err);
    }
    loading.value.keyPairs = false;
  }

  async function fetchClusterOptions(cloudCredentialId: string, regionId: string) {
    errors.value = [];
    await Promise.all([
      fetchClusterVersion(cloudCredentialId, regionId),
      fetchZone(cloudCredentialId, regionId),
      fetchVpc(cloudCredentialId, regionId),
      fetchSubnets(cloudCredentialId, regionId),
      fetchSecurityGroup(cloudCredentialId, regionId),
    ]);
  }

  async function fetchMachineOptions(cloudCredentialId: string, regionId: string) {
    errors.value = [];
    await Promise.all([
      fetchZone(cloudCredentialId, regionId),
      fetchSubnets(cloudCredentialId, regionId),
      fetchSecurityGroup(cloudCredentialId, regionId),
      fetchInstanceTypes(cloudCredentialId, regionId),
      fetchKeyPair(cloudCredentialId, regionId),
    ]);
  }

  return {
    errors,
    loading,
    options,
    allSubnets,
    instanceTypeSet,
    fetchRegion,
    fetchClusterVersion,
    fetchZone,
    fetchVpc,
    fetchSubnets,
    fetchSecurityGroup,
    fetchInstanceTypes,
    fetchKeyPair,
    fetchClusterOptions,
    fetchMachineOptions,
  };
}
