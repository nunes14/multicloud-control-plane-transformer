# Commands

```shell
Usage:  [options] [command]

Options:
  -h, --help                                         display help for command

Commands:
  apply <control-plane-repo> <cluster-gitops-repo>   Update the cluster gitops repo from the current control plane
                                                     configuration
  assign <control-plane-repo>                        Generate assignments for applications to clusters
  render <control-plane-repo> <cluster-gitops-repo>  Render application templates to the cluster gitops repo
  help [command]                                     display help for command

```

## apply

```shell
Usage:  apply [options] <control-plane-repo> <cluster-gitops-repo>

Update the cluster gitops repo from the current control plane configuration

Options:
  -h, --help  display help for command

```

## assign

```shell
Usage:  assign [options] <control-plane-repo>

Generate assignments for applications to clusters

Options:
  -h, --help  display help for command

```

## render

```shell
Usage:  render [options] <control-plane-repo> <cluster-gitops-repo>

Render application templates to the cluster gitops repo

Options:
  -h, --help  display help for command

```