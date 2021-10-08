# Transformer

## Usage

The transformer CLI requires that you have created both a [Control Plane Repo](https://github.com/microsoft/multicloud-control-plane-seed) and a [Cluster GitOps Repo](https://github.com/microsoft/multicloud-control-plane-cluster-gitops-seed) from their respective templates.

```shell
# Clone your control plane and gitops repos
git clone <control-plane-repo> ./controlplane
git clone <cluster-gitops-repo> ./gitops

# Update assignments in the control plane
transformer assign ./controlplane
pushd ./controlplane
git commit -am "Updated application assignments"
git push origin
popd

# Render application templates
transformer render ./controlplane ./gitops

# Apply clusters and assignments
transformer apply ./controlplane ./gitops

# Capture the latest control plane commit hash for use with the gitops repo
SHA=$(cd ./controlplane && git rev-parse HEAD)

# Commit and push. Cluster operations will be executed via Flux
pushd ./gitops
git commit -am "Update from commit ${SHA}"
git push origin
popd
```

## [Commands](docs/COMMANDS.md)

A full list of commands can be found [here](docs/COMMANDS.md)

## Features

### Template Rendering

The `render` command populates the placeholders in a template and writes them to the Cluster GitOps Repo. The values are filled in the following order:

- Template parameter default values (lowest priority)
- Application values
- Application deployment overrides (highest priority)

### Application Assignment

The `assign` command reads the contents of a Control Plane Repo and ensures that applications are assigned to the correct clusters. The assignments are written back to the Control Plane Repo.

- Evaluates clusters against the criteria specified by an application
- Removes assignments for clusters that don't match the criteria
- Removes assignments if there are currently more than the number specified
- Keeps existing assignments to ensure an application doesn't incur unnecessary downtime
- Adds new assignments if there are currently fewer than the number specified

### Applying changes

The `apply` command updates a Cluster GitOps Repo based on the clusters and assignments contained in a Control Plane Repo.

- Removes cluster directories that are no longer present
- Creates cluster directories for newly registered clusters
- Adds/removes application entries that have been assigned to a given cluster

## Contributing

This project welcomes contributions and suggestions. Most contributions require you to agree to a
Contributor License Agreement (CLA) declaring that you have the right to, and actually do, grant us
the rights to use your contribution. For details, visit https://cla.opensource.microsoft.com.

When you submit a pull request, a CLA bot will automatically determine whether you need to provide
a CLA and decorate the PR appropriately (e.g., status check, comment). Simply follow the instructions
provided by the bot. You will only need to do this once across all repos using our CLA.

This project has adopted the [Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct/).
For more information see the [Code of Conduct FAQ](https://opensource.microsoft.com/codeofconduct/faq/) or
contact [opencode@microsoft.com](mailto:opencode@microsoft.com) with any additional questions or comments.

## Trademarks

This project may contain trademarks or logos for projects, products, or services. Authorized use of Microsoft
trademarks or logos is subject to and must follow
[Microsoft's Trademark & Brand Guidelines](https://www.microsoft.com/en-us/legal/intellectualproperty/trademarks/usage/general).
Use of Microsoft trademarks or logos in modified versions of this project must not cause confusion or imply Microsoft sponsorship.
Any use of third-party trademarks or logos are subject to those third-party's policies.
