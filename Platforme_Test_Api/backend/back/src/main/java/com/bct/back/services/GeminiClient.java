package com.bct.back.services;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

@Service
public class GeminiClient {

    // Set via env var, e.g. GEMINI_API_KEY — never hardcode, never send to the frontend.
    @Value("${gemini.api-key}")
    private String apiKey;

    @Value("${gemini.model:gemini-2.0-flash}")
    private String model;

    private final HttpClient httpClient = HttpClient.newHttpClient();
    private final ObjectMapper objectMapper = new ObjectMapper();

    /**
     * Calls Gemini's generateContent with a responseSchema constraint so the
     * model is forced to return JSON matching our shape, rather than relying on
     * prompt instructions alone (which LLMs don't always follow precisely).
     * Returns the raw JSON text — AiReportService is responsible for parsing it.
     */
    public String generateStructuredReport(String prompt) {
        try {
            ObjectNode body = objectMapper.createObjectNode();
            ArrayNode contents = body.putArray("contents");
            ObjectNode userContent = contents.addObject();
            userContent.put("role", "user");
            userContent.putArray("parts").addObject().put("text", prompt);

            ObjectNode generationConfig = body.putObject("generationConfig");
            generationConfig.put("responseMimeType", "application/json");
            generationConfig.set("responseSchema", buildSchema());

            String url = "https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent";

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .timeout(Duration.ofSeconds(30))
                    .header("Content-Type", "application/json")
                    .header("x-goog-api-key", apiKey)
                    .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(body)))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() != 200) {
                throw new IllegalStateException("Gemini a répondu " + response.statusCode() + ": " + response.body());
            }

            JsonNode root = objectMapper.readTree(response.body());
            String text = root.path("candidates").path(0).path("content").path("parts").path(0).path("text").asText();
            if (text.isBlank()) {
                throw new IllegalStateException("Réponse Gemini vide (candidate manquant ou filtré).");
            }
            return text;

        } catch (Exception e) {
            throw new IllegalStateException("Échec de l'appel à Gemini: " + e.getMessage(), e);
        }
    }

    private ObjectNode buildSchema() {
        ObjectNode schema = objectMapper.createObjectNode();
        schema.put("type", "OBJECT");
        ObjectNode properties = schema.putObject("properties");

        properties.putObject("summary").put("type", "STRING");

        ObjectNode severity = properties.putObject("severity");
        severity.put("type", "STRING");
        ArrayNode severityEnum = severity.putArray("enum");
        severityEnum.add("FAIBLE");
        severityEnum.add("MOYEN");
        severityEnum.add("ELEVE");

        for (String field : new String[]{"strengths", "risks", "recommendations"}) {
            ObjectNode arr = properties.putObject(field);
            arr.put("type", "ARRAY");
            arr.putObject("items").put("type", "STRING");
        }

        ArrayNode required = schema.putArray("required");
        required.add("summary");
        required.add("severity");
        required.add("strengths");
        required.add("risks");
        required.add("recommendations");

        return schema;
    }
}