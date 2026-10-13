import type { Translator } from './types/capt';

const region = (t: Translator, val: string): string | undefined => {
  return val ? undefined : t('capt.errors.regionRequired');
};

const vpc = (t: Translator, val: string): string | undefined => {
  return val ? undefined : t('capt.errors.vpcRequired');
};

const clusterVersion = (t: Translator, val: string): string | undefined => {
  return val ? undefined : t('capt.errors.clusterVersionRequired');
};

const clusterName = (t: Translator, val: string): string | undefined => {
  return val ? undefined : t('capt.errors.clusterNameRequired');
};

const instanceType = (t: Translator, val: string): string | undefined => {
  return val ? undefined : t('capt.errors.instanceTypeRequired');
};

const osName = (t: Translator, val: string): string | undefined => {
  return val ? undefined : t('capt.errors.osNameRequired');
};

const securityGroups = (t: Translator, val: string[] = []): string | undefined => {
  return val.length > 0 ? undefined : t('capt.errors.securityGroupRequired');
};

const minSize = (t: Translator, val: number | undefined, maxSize?: number): string | undefined => {
  if (val === undefined || val === null || Number.isNaN(val)) {
    return t('capt.errors.minSizeRequired');
  }

  if (val < 0) {
    return t('capt.errors.minSizeInvalid');
  }

  if (typeof maxSize === 'number' && val > maxSize) {
    return t('capt.errors.minSizeGreaterThanMax');
  }

  return undefined;
};

const desiredReplicas = (t: Translator, val: number | undefined, minSize?: number, maxSize?: number): string | undefined => {
  if (val === undefined || val === null || Number.isNaN(Number(val))) {
    return t('capt.errors.replicasRequired');
  }

  const replicas = Number(val);

  if (!Number.isInteger(replicas) || replicas < 0) {
    return t('capt.errors.replicasInvalid');
  }

  if (typeof minSize === 'number' && replicas < minSize) {
    return t('capt.errors.replicasLessThanMin');
  }

  if (typeof maxSize === 'number' && replicas > maxSize) {
    return t('capt.errors.replicasGreaterThanMax');
  }

  return undefined;
};

const maxSize = (t: Translator, val: number | undefined, min?: number): string | undefined => {
  if (val === undefined || val === null || Number.isNaN(val)) {
    return t('capt.errors.maxSizeRequired');
  }

  if (val < 1) {
    return t('capt.errors.maxSizeInvalid');
  }

  if (typeof min === 'number' && val < min) {
    return t('capt.errors.maxSizeLessThanMin');
  }

  return undefined;
};

const securityGroup = (t: Translator, val: string, required: boolean): string | undefined => {
  if (!required) {
    return undefined;
  }

  return val ? undefined : t('capt.errors.securityGroupRequired');
};

const subnet = (t: Translator, val: string, required: boolean): string | undefined => {
  if (!required) {
    return undefined;
  }

  return val ? undefined : t('capt.errors.subnetRequired');
};

export {
  region, vpc, clusterVersion, clusterName, instanceType, osName, securityGroups, minSize, maxSize, desiredReplicas, securityGroup, subnet
};
