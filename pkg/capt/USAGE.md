# Using the extension: provisioning TKE clusters

### Prerequisites

1. **Rancher** `>= 2.15.0` with the **UI Extensions** feature enabled (`ui-extensions-version >= 3.0.0 < 4.0.0`).
2. **Rancher Turtles** installed on the local cluster, with the **Tencent / TKE** infrastructure provider enabled. The provisioner card only appears once Rancher has a `capi.cattle.io.capiprovider` resource named `tke`, `tencent`, or `capt`.
3. A **TKE cloud credential** registered in Rancher. Option lists (region, VPC, version, instance type, security group, subnet, key pair, image) are loaded through `/meta/tke/*`, the same path used by the hosted TKE plugin.

### Creating a cluster

In Rancher, go to **Cluster Management > Create**. A **CAPI TKE** card appears in the cluster-type list (grouped with other CAPI providers) once the prerequisites above are met.

**CAPI Cluster Configuration** (backed by `TKECluster`)

Fields from `cluster-template-tke-after.yaml`:

- `spec.clusterName`
- `spec.region`
- `spec.clusterVersion`
- `spec.vpcID`

Additional CRD fields from `cluster-template-tke.yaml`:

- `spec.osName`
- `spec.endpointAccess.public` / `private`
- `spec.endpointAccess.securityGroup`
- `spec.endpointAccess.subnetID`

**Machine Pools** (backed by `TKEManagedMachinePool`)

Fields from `cluster-template-tke-after.yaml`:

- `spec.maxSize`
- `spec.minSize`
- `spec.instanceType`
- `spec.securityGroups`

Additional CRD fields:

- `spec.osName`
- `spec.subnetIDs`
- `spec.keyIDs`

Save the cluster once all sections validate. The extension creates the `TKECluster` and `TKEManagedMachinePool` resources and wires `provisioning.cattle.io.cluster.spec.rkeConfig.infrastructureRef` to the `TKECluster`.
