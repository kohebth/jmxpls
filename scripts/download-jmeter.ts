export type JMeterArtifact = {
  version: string;
  archiveName: string;
  url: string;
  checksumUrl: string;
};

export const JMETER_COMPATIBILITY_VERSIONS = ["5.4.3", "5.5", "5.6.3"] as const;

export function jmeterArtifact(version: string): JMeterArtifact {
  const archiveName = `apache-jmeter-${version}.tgz`;
  const url = `https://archive.apache.org/dist/jmeter/binaries/${archiveName}`;
  return { version, archiveName, url, checksumUrl: `${url}.sha512` };
}

export function jmeterArtifacts(versions: readonly string[] = JMETER_COMPATIBILITY_VERSIONS): JMeterArtifact[] {
  return versions.map(jmeterArtifact);
}
