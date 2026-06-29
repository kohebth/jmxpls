export type JMeterCommand = {
  executable: string;
  args: string[];
};

export function buildJMeterCliCommand(planPath: string, jtlPath: string, jmeterExecutable = "jmeter"): JMeterCommand {
  return { executable: jmeterExecutable, args: ["-n", "-t", planPath, "-l", jtlPath] };
}

export function isAllowedJMeterArg(arg: string): boolean {
  return !arg.includes(";") && !arg.includes("&&") && !arg.includes("||");
}
