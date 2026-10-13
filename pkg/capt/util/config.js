const DEFAULT_TKE_CLUSTER_CONFIG = {
  spec: {
    clusterName:    '',
    region:         'ap-guangzhou',
    clusterVersion: '',
    vpcID:          '',
    osName:         '',
    endpointAccess: {
      public:        true,
      private:       false,
      securityGroup: '',
      subnetID:      '',
    },
  },
};

const DEFAULT_MACHINE_POOL_CONFIG = {
  maxSize:        5,
  minSize:        0,
  instanceType:   '',
  osName:         '',
  subnetIDs:      [],
  securityGroups: [],
  keyIDs:         [],
};

const OS_IMAGE = [
  {
    Alias:           'TencentOS Server 3.1 (TK4)',
    ImageId:         'img-eb30mz89',
    OsCustomizeType: 'GENERAL',
    OsName:          'tlinux3.1x86_64',
    SeriesName:      'TencentOS Server 3.1 (TK4)',
    Status:          'online'
  },
  {
    Alias:           'TencentOS Server 4 for x86_64',
    ImageId:         'img-6n21msk1',
    OsCustomizeType: 'GENERAL',
    OsName:          'tlinux4_x86_64_public',
    SeriesName:      'TencentOS Server 4 for x86_64',
    Status:          'online'
  },
  {
    Alias:           'Ubuntu Server 22.04 LTS 64位',
    ImageId:         'img-487zeit5',
    OsCustomizeType: 'GENERAL',
    OsName:          'ubuntu22.04x86_64',
    SeriesName:      'ubuntu22.04x86_64',
    Status:          'online'
  },
  {
    Alias:           'Ubuntu Server 20.04.1 LTS 64bit',
    ImageId:         'img-22trbn9x',
    OsCustomizeType: 'GENERAL',
    OsName:          'ubuntu20.04x86_64',
    SeriesName:      'ubuntu20.04x86_64',
    Status:          'online'
  },
  {
    Alias:           'CentOS 7.8 64bit',
    ImageId:         'img-3la7wgnt',
    OsCustomizeType: 'GENERAL',
    OsName:          'centos7.8.0_x64',
    SeriesName:      'centos7.8.0_x64',
    Status:          'online'
  },
  {
    Alias:           'TencentOS Server 2.4 (TK4)',
    ImageId:         'img-9axl1k53',
    OsCustomizeType: 'GENERAL',
    OsName:          'tlinux2.4(tkernel4)x86_64',
    SeriesName:      'TencentOS Server 2.4 (TK4)',
    Status:          'online'
  },
];

export const INSTANCE_FAMILY_CATEGORY_MAP = {
  S1: 'standard', S2: 'standard', S2ne: 'standard', S3: 'standard', S3ne: 'standard',
  S4: 'standard', S4m: 'standard', S5: 'standard', S5se: 'standard', S5t: 'standard',
  S6: 'standard', S6t: 'standard', SA1: 'standard', SA2: 'standard', SA2a: 'standard',
  SA3: 'standard', SK1: 'standard', SN3ne: 'standard', SR1: 'standard', SW3a: 'standard',
  SW3b: 'standard', SW3ne: 'standard', SA4: 'standard', SA5: 'standard', S8: 'standard',
  SA9: 'standard', S9: 'standard', SA9e: 'standard', S9e: 'standard', S9pro: 'standard',
  RS2t: 'premium', RS3t: 'premium', RS4t: 'premium', RS5t: 'premium',
  C2: 'compute', C3: 'compute', C4: 'compute', C5: 'compute', C6: 'compute', TC3: 'compute', CN3: 'compute',
  I1: 'highio', I2: 'highio', I3: 'highio', I6t: 'highio', IT2: 'highio', IT3: 'highio',
  IT3a: 'highio', IT3b: 'highio', IT3c: 'highio', IT5: 'highio', ITA5: 'highio',
  M1: 'memory', M2: 'memory', M3: 'memory', M4: 'memory', M5: 'memory', M6: 'memory',
  M8: 'memory', M6ce: 'memory', M6mp: 'memory', M6p: 'memory', MA2: 'memory', MA3: 'memory',
  MA4: 'memory', MA5: 'memory', MA9: 'memory', M9: 'memory', MA9e: 'memory',
  HCCG5v: 'highPerformance', HCCIC5: 'highPerformance', HCCPNV4h: 'highPerformance',
  HCCTG5v: 'highPerformance', HCCPNV4sne: 'highPerformance', HCCPNV4sn: 'highPerformance',
  HCCPNV5v: 'highPerformance', HCCPNV5vp: 'highPerformance', HCCPNV5: 'highPerformance',
  HCCPNV5x: 'highPerformance', HCCPNV6: 'highPerformance',
  GI1: 'gpu', GI3X: 'gpu', GN10S: 'gpu', GN10X: 'gpu', GN10Xp: 'gpu', GN6: 'gpu',
  GN6S: 'gpu', GN7: 'gpu', GN8: 'gpu', GNV4: 'gpu', GT4: 'gpu', PNV4: 'gpu',
  PNV4ne: 'gpu', PNV5: 'gpu', GC49: 'gpu', PNV5b: 'gpu', PNV5i: 'gpu', PNV6: 'gpu',
  D1: 'bigData', D2: 'bigData', D3: 'bigData',
  BMD2: 'bareMetal', BMD3: 'bareMetal', BMD3c: 'bareMetal', BMD3s: 'bareMetal',
  BMDA2: 'bareMetal', BMI5: 'bareMetal', BMIA2: 'bareMetal', BMIA2m: 'bareMetal',
  BMM5r: 'bareMetal', BMS4: 'bareMetal', BMSA2: 'bareMetal', BMSC4: 'bareMetal',
  BMM6i: 'bareMetal', BMTGC39me: 'bareMetal', BMGC39me: 'bareMetal', BMG5e: 'bareMetal',
  BMG5n: 'bareMetal', BMG5i: 'bareMetal', BMG5t: 'bareMetal', BMGY5: 'bareMetal',
  BMGNV4: 'bareMetal', BMSA3: 'bareMetal', BMIA3: 'bareMetal', BMS5: 'bareMetal',
  BF1: 'beeFast',
  CHC: 'other', CN10X: 'other', BC1: 'other', BF: 'other', CH2: 'other',
};

// Candidates for Cluster.spec.clusterNetwork.pods.cidrBlocks (TKE ClusterCIDR).
// Must not overlap the selected VPC CIDR.
const CLUSTER_CIDR_CANDIDATES = [
  '172.16.0.0/16',
  '172.17.0.0/16',
  '172.18.0.0/16',
  '172.19.0.0/16',
  '172.20.0.0/16',
  '172.21.0.0/16',
  '10.42.0.0/16',
  '10.43.0.0/16',
  '10.44.0.0/16',
  '10.45.0.0/16',
  '10.244.0.0/16',
  '192.168.0.0/16',
];

export default {
  DEFAULT_TKE_CLUSTER_CONFIG,
  DEFAULT_MACHINE_POOL_CONFIG,
  OS_IMAGE,
  INSTANCE_FAMILY_CATEGORY_MAP,
  CLUSTER_CIDR_CANDIDATES,
};
