export type ResourceDescriptor = {
  uriTemplate: string;
  name: string;
  description: string;
};

export class ResourceRegistry {
  private readonly resources = new Map<string, ResourceDescriptor>();

  register(resource: ResourceDescriptor): void {
    this.resources.set(resource.uriTemplate, resource);
  }

  list(): ResourceDescriptor[] {
    return [...this.resources.values()];
  }
}
