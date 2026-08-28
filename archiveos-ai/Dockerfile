# syntax=docker/dockerfile:1.7
FROM eclipse-temurin:21-jdk-noble AS build
WORKDIR /workspace
COPY settings.gradle build.gradle gradlew gradlew.bat ./
COPY gradle ./gradle
RUN --mount=type=cache,target=/root/.gradle/caches \
    --mount=type=cache,target=/root/.gradle/wrapper \
    sed -i 's/\r$//' gradlew \
    && chmod +x gradlew \
    && ./gradlew dependencies --no-daemon
COPY src ./src
RUN --mount=type=cache,target=/root/.gradle/caches \
    --mount=type=cache,target=/root/.gradle/wrapper \
    ./gradlew clean bootJar --no-daemon

FROM eclipse-temurin:21-jre-noble
WORKDIR /app
RUN apt-get update \
    && apt-get upgrade -y \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --system archiveos \
    && useradd --system --gid archiveos --home-dir /app --shell /usr/sbin/nologin archiveos
COPY --chown=archiveos:archiveos --from=build /workspace/build/libs/*.jar /app/archiveos-ai.jar
USER archiveos
EXPOSE 4100
ENTRYPOINT ["java", "-jar", "/app/archiveos-ai.jar"]
