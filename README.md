# CAPI UI Extensions (Tencent)

Rancher Dashboard extensions that add [Cluster API (CAPI)](https://cluster-api.sigs.k8s.io/) provisioning support for Tencent Cloud TKE, via [Rancher Turtles](https://github.com/rancher/turtles). This repo ships one extension, **CAPT** (`pkg/capt`), which adds a "CAPI TKE" cluster provisioner backed by [Cluster API Provider Tencent](https://github.com/TencentCloud/cluster-api-provider-tencent).

The project structure follows [prov-capi-ui-extensions](https://github.com/rancher/prov-capi-ui-extensions) (`pkg/capa`). Form layout and Tencent Cloud option fetching follow `dashboard/pkg/tke-cn` (`CruTke`). The persisted fields follow `cluster-api-provider-tencent` `templates/upgrade/cluster-template-tke-after.yaml` plus the extra CRD fields used by `templates/cluster-template-tke.yaml`.

## Repository layout

```
pkg/capt/                                  the CAPT (TKE) provisioner extension package
  index.ts                                 extension entry point
  provisioner.ts                           IClusterProvisioner implementation (CAPTProvisioner)
  model-extension/
    provisioning.cattle.io.cluster.ts      IClusterModelExtension implementation
  components/                              TKECluster form (basic + network)
  machine-config/                          TKEManagedMachinePool form
  types/capt.ts                            TypeScript types mirroring the CAPT CRDs
  validators.ts                            field-level form validation
  utils.ts                                 save/init logic for the infrastructure cluster and machine pool configs
  util/request.js                          queryFromTencent (/meta/tke/*)
  l10n/                                    UI strings
```

## Local development

```sh
yarn install
yarn dev          # serves the extension(s) under pkg/ for local testing against a Rancher instance
yarn build
yarn build-pkg
yarn lint
```
