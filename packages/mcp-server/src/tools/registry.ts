export type ToolDescriptor = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
};

export class ToolRegistry {
  private readonly tools = new Map<string, ToolDescriptor>();

  register(tool: ToolDescriptor): void {
    this.tools.set(tool.name, tool);
  }

  list(): ToolDescriptor[] {
    return [...this.tools.values()];
  }
}
