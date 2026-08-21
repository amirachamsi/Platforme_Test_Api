package com.bct.back.services;

import com.bct.back.entities.AiReport;
import com.bct.back.entities.Endpoint;
import com.bct.back.entities.Execution;
import com.bct.back.entities.TestCase;
import com.bct.back.enums.ExecutionMode;
import com.bct.back.repositories.AiReportRepository;
import com.bct.back.repositories.ExecutionRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class AiReportService {

    private final AiReportRepository aiReportRepository;
    private final ExecutionRepository executionRepository;
    private final GeminiClient geminiClient;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Transactional
    public AiReport getOrGenerate(Long executionId) {
        return aiReportRepository.findByExecutionId(executionId)
                .orElseGet(() -> generate(executionId));
    }

    private AiReport generate(Long executionId) {
        Execution execution = executionRepository.findById(executionId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Exécution introuvable, id=" + executionId));

        String prompt = buildPrompt(execution);

        String rawJson;
        try {
            rawJson = geminiClient.generateStructuredReport(prompt);
        } catch (Exception e) {
            // Nothing to cache if the call itself failed — surface a clean error
            // instead of a bare 500, and let the user retry (won't get stuck with
            // a bad cached row).
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Impossible de générer le rapport IA : " + e.getMessage());
        }

        AiReport report;
        try {
            JsonNode node = objectMapper.readTree(rawJson);
            report = AiReport.builder()
                    .execution(execution)
                    .generatedAt(LocalDateTime.now())
                    .severity(node.path("severity").asText("MOYEN"))
                    .summary(node.path("summary").asText(""))
                    .strengthsJson(objectMapper.writeValueAsString(toList(node.path("strengths"))))
                    .risksJson(objectMapper.writeValueAsString(toList(node.path("risks"))))
                    .recommendationsJson(objectMapper.writeValueAsString(toList(node.path("recommendations"))))
                    .rawResponse(rawJson)
                    .build();
        } catch (Exception e) {
            // Gemini returned something that wasn't valid JSON despite the schema
            // constraint — still persist a usable (if degraded) report rather than
            // erroring out every time this execution's report is viewed.
            report = AiReport.builder()
                    .execution(execution)
                    .generatedAt(LocalDateTime.now())
                    .severity("MOYEN")
                    .summary("Le rapport n'a pas pu être structuré automatiquement. Réponse brute ci-dessous.")
                    .strengthsJson("[]")
                    .risksJson("[]")
                    .recommendationsJson("[]")
                    .rawResponse(rawJson)
                    .build();
        }

        return aiReportRepository.save(report);
    }

    private List<String> toList(JsonNode arrayNode) {
        List<String> list = new ArrayList<>();
        for (JsonNode n : arrayNode) {
            list.add(n.asText());
        }
        return list;
    }

    private String buildPrompt(Execution execution) {
        TestCase testCase = execution.getTestcase();
        Endpoint endpoint = testCase != null ? testCase.getEndpoint() : null;

        StringBuilder sb = new StringBuilder();
        sb.append("Tu es un ingénieur QA/Performance expérimenté. Analyse ce résultat de test de charge k6 ")
                .append("et rédige un rapport clair, honnête et actionnable, entièrement en français.\n\n");

        sb.append("Contexte du scénario :\n");
        if (testCase != null) {
            sb.append("- Nom : ").append(testCase.getNom()).append("\n");
            sb.append("- Code HTTP attendu configuré : ").append(testCase.getExpectedCode()).append("\n");
            sb.append("- Seuil de temps de réponse configuré (P95) : ").append(testCase.getSeuilMs()).append(" ms\n");
            sb.append("- Taux d'erreur max toléré configuré : ").append(testCase.getTauxErreurMax()).append(" %\n");
        }
        if (endpoint != null) {
            sb.append("- Endpoint testé : ").append(endpoint.getMethode()).append(" ").append(endpoint.getChemin()).append("\n");
        }

        sb.append("\nRésultats mesurés lors de cette exécution :\n");
        sb.append("- Statut global : ").append(execution.getStatut()).append("\n");
        sb.append("- P95 mesuré : ").append(execution.getP95MesureMs()).append(" ms\n");
        sb.append("- Taux d'erreur mesuré : ").append(execution.getTauxErreurMesure()).append(" %\n");
        sb.append("- Requêtes totales : ").append(execution.getReqTotal()).append("\n");
        sb.append("- Requêtes réussies : ").append(execution.getReqReussies()).append("\n");
        sb.append("- Requêtes échouées : ").append(execution.getReqEchouees()).append("\n");
        sb.append("- RPS moyen : ").append(execution.getRpsMoyen()).append("\n");
        sb.append("- VUs utilisés : ").append(execution.getVus()).append("\n");

        if (execution.getExecutionMode() == ExecutionMode.REQUETES) {
            sb.append("- Mode : nombre de requêtes fixe (").append(execution.getNombreRequetes()).append(" requêtes)\n");
        } else {
            sb.append("- Mode : durée fixe (").append(execution.getDureeSec()).append(" secondes)\n");
        }

        String codeBreakdown = extractStatusCodeBreakdown(execution.getRapportK6Json());
        if (codeBreakdown != null) {
            sb.append("- Codes de réponse observés : ").append(codeBreakdown).append("\n");
        }

        sb.append("\nRédige une analyse concise et utile pour une équipe technique : mets en avant les points ")
                .append("positifs réels (n'invente pas de compliments s'il n'y en a pas), les risques ou anomalies ")
                .append("concrets révélés par ces chiffres, et des recommandations précises et actionnables — ")
                .append("pas de conseils génériques comme 'surveillez les performances'.");

        return sb.toString();
    }

    /** Same parsing approach as the frontend's observedStatusCodes getter, run server-side for the prompt. */
    private String extractStatusCodeBreakdown(String rapportK6Json) {
        if (rapportK6Json == null) return null;
        try {
            JsonNode root = objectMapper.readTree(rapportK6Json);
            Map<String, Long> counts = new LinkedHashMap<>();
            String prefix = "actual status observed: ";
            for (JsonNode check : root.path("root_group").path("checks")) {
                String name = check.path("name").asText("");
                if (name.startsWith(prefix)) {
                    counts.merge(name.substring(prefix.length()), check.path("passes").asLong(0), Long::sum);
                }
            }
            if (counts.isEmpty()) return null;
            return counts.entrySet().stream()
                    .map(e -> e.getKey() + " × " + e.getValue())
                    .collect(Collectors.joining(", "));
        } catch (Exception e) {
            return null;
        }
    }
}