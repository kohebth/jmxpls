import { basename } from "node:path";

export type JMeterCommand = {
  executable: string;
  args: string[];
};

export function buildJMeterCliCommand(planPath: string, jtlPath: string, jmeterExecutable = "jmeter"): JMeterCommand {
  return { executable: jmeterExecutable, args: ["-n", "-t", planPath, "-l", jtlPath] };
}

export function isAllowedJMeterArg(arg: string): boolean {
  return !/[;\n\r]/.test(arg) && !arg.includes("&&") && !arg.includes("||");
}

export function isAllowedJMeterExecutable(executable: string): boolean {
  return isAllowedJMeterArg(executable) && ["jmeter", "jmeter.bat", "ApacheJMeter.jar"].includes(basename(executable));
}
