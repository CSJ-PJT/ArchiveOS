FROM eclipse-temurin:21-jdk AS build
WORKDIR /workspace
COPY settings.gradle build.gradle gradlew gradlew.bat ./
COPY gradle ./gradle
COPY src ./src
RUN ./gradlew clean bootJar --no-daemon

FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=build /workspace/build/libs/*.jar /app/archiveos-ai.jar
EXPOSE 4100
ENTRYPOINT ["java", "-jar", "/app/archiveos-ai.jar"]
