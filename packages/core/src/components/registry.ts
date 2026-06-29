import type { ComponentAdapter } from "./adapter.js";
import type { ComponentDescriptor } from "../model/catalog.js";

export class ComponentRegistry {
  private readonly byType = new Map<string, ComponentAdapter>();
  private readonly byXmlTag = new Map<string, ComponentAdapter>();
  private readonly byTestClass = new Map<string, ComponentAdapter>();
  private readonly byGuiClass = new Map<string, ComponentAdapter>();

  register(adapter: ComponentAdapter): void {
    this.byType.set(adapter.descriptor.type, adapter);
    for (const xmlTag of adapter.descriptor.xmlTags) {
      this.byXmlTag.set(xmlTag, adapter);
    }
    for (const testClass of adapter.descriptor.testClasses) {
      this.byTestClass.set(testClass, adapter);
    }
    for (const guiClass of adapter.descriptor.guiClasses) {
      this.byGuiClass.set(guiClass, adapter);
    }
  }

  lookup(input: { type?: string; xmlTag?: string; testClass?: string; guiClass?: string }): ComponentAdapter | undefined {
    return input.type ? this.byType.get(input.type) :
      input.testClass ? this.byTestClass.get(input.testClass) :
      input.guiClass ? this.byGuiClass.get(input.guiClass) :
      input.xmlTag ? this.byXmlTag.get(input.xmlTag) : undefined;
  }

  descriptors(): ComponentDescriptor[] {
    return [...this.byType.values()].map((adapter) => adapter.descriptor);
  }
}
