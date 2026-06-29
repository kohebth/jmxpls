export type JMeterArtifact = {
  version: string;
  url: string;
};

export function jmeterArtifact(version: string): JMeterArtifact {
  return { version, url: `https://archive.apache.org/dist/jmeter/binaries/apache-jmeter-${version}.tgz` };
}
