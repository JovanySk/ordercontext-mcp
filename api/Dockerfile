# ---- Build stage: compile and package the jar with the Maven Wrapper ----
FROM eclipse-temurin:17-jdk AS build
WORKDIR /app

# Download dependencies first so they are cached between builds
COPY mvnw pom.xml ./
COPY .mvn .mvn
RUN chmod +x mvnw && ./mvnw -B -q dependency:go-offline

COPY src src
RUN ./mvnw -B -q package -DskipTests

# ---- Runtime stage: only the JRE and the jar ----
FROM eclipse-temurin:17-jre
WORKDIR /app

RUN useradd --system --create-home appuser
COPY --from=build /app/target/ordercontext-api-*.jar app.jar
USER appuser

EXPOSE 8080
# Default profile uses H2 in memory. For MySQL run with:
#   -e SPRING_PROFILES_ACTIVE=mysql -e DB_URL=... -e DB_USERNAME=... -e DB_PASSWORD=...
ENTRYPOINT ["java", "-jar", "app.jar"]
