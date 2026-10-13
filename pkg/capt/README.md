# CAPI Tencent (CAPT) Provisioning

Provisions and manages Tencent Cloud TKE clusters via Cluster API from the Rancher UI.

## Cluster Management nav

Adds a dedicated **Hosted CAPI Clusters** custom page under Cluster Management (`manager`). It lists only `cluster.x-k8s.io.Cluster` resources whose `infrastructureRef` is a `TKECluster`, and does **not** replace Rancher's built-in CAPI Clusters list/edit.

Create/Edit of CAPT infrastructure opens `CruCapt` on this page only.

Turtles-imported PCs: Cluster Management Edit uses `type=imported` so the Rancher **imported**
UI package loads **CruImported** (Day 2 / version management / registries). Local `yarn serve`
of this repo auto-links `dashboard/pkg/imported` into `./pkg/imported` (see root `vue.config.js`);
without that package the edit page falls through to Rke2Config. CAPT infrastructure stays on the
Hosted CAPI page.

Delete cascades:

- `MachinePool`
- `TKEManagedMachinePool`
- `Cluster`
- `TKECluster` (strips finalizers if stuck)

## Provisioning

This extension also registers a CAPI provisioner that writes upstream CAPI resources (not `provisioning.cattle.io.Cluster`):

1. `TKECluster` (`infrastructure.cluster.x-k8s.io/v1beta1`) — `{name}-tke`
2. `TKEManagedMachinePool` — `{name}-{pool}`
3. `Cluster` (`cluster.x-k8s.io/v1beta1`) — labeled `cluster-api.cattle.io/rancher-auto-import=true` for Turtles
4. `MachinePool` (`cluster.x-k8s.io/v1beta1`) — refs each managed machine pool

These resources match `cluster-api-provider-tencent` templates:

- `templates/upgrade/cluster-template-tke-after.yaml`
- `templates/cluster-template-tke.yaml`

See [USAGE.md](./USAGE.md) for the create/edit walkthrough.
