FROM gradle:8.10.2-jdk21 AS build
WORKDIR /workspace
COPY settings.gradle build.gradle ./
COPY src ./src
RUN gradle clean bootJar --no-daemon

FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=build /workspace/build/libs/*.jar /app/archiveos-ai.jar
EXPOSE 4100
ENTRYPOINT ["java", "-jar", "/app/archiveos-ai.jar"]
