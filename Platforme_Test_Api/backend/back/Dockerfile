# ---------- Étape 1 : build ----------
FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /app

# On copie d'abord le pom.xml seul pour profiter du cache Docker
# (les dépendances ne sont re-téléchargées que si pom.xml change)
COPY pom.xml .
RUN mvn -B dependency:go-offline

# Puis le reste du code source
COPY src ./src
RUN mvn -B clean package -DskipTests

# ---------- Étape 2 : image finale (légère) ----------
FROM eclipse-temurin:17-jre-alpine
WORKDIR /app

# Utilisateur non-root pour la sécurité
RUN addgroup -S spring && adduser -S spring -G spring
USER spring

COPY --from=build /app/target/*.jar app.jar

EXPOSE 8081

ENTRYPOINT ["java", "-jar", "app.jar"]