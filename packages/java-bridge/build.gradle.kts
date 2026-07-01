plugins {
    application
    java
}

group = "io.jmxpls"
version = "0.0.0"

java {
    toolchain {
        languageVersion.set(JavaLanguageVersion.of(17))
    }
}

application {
    mainClass.set("io.jmxpls.bridge.Main")
}

tasks.jar {
    manifest {
        attributes["Main-Class"] = "io.jmxpls.bridge.Main"
    }
    archiveBaseName.set("jmxpls-java-bridge")
}

dependencies {
    testImplementation("org.junit.jupiter:junit-jupiter:5.11.4")
    testRuntimeOnly("org.junit.platform:junit-platform-launcher")
}

tasks.test {
    useJUnitPlatform()
}
