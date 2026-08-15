package com.bct.back.services;

import com.bct.back.entities.ApiTarget;
import com.bct.back.entities.Endpoint;
import com.bct.back.entities.Execution;
import com.bct.back.entities.TestCase;
import com.bct.back.enums.AuthType;
import com.bct.back.enums.ExecutionMode;
import com.bct.back.enums.TestStatus;
import com.bct.back.repositories.ExecutionRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Génère un rapport HTML autonome (téléchargeable) à partir d'une Execution k6.
 * Destiné aux développeurs et aux non-techniciens (PM, QA, client).
 */
@Service
@RequiredArgsConstructor
public class ExecutionReportHtmlService {

    private static final DateTimeFormatter DATE_FMT =
            DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm:ss");

    private final ExecutionRepository executionRepository;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Transactional(readOnly = true)
    public byte[] generate(Long executionId) {
        Execution execution = executionRepository.findById(executionId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Exécution introuvable, id=" + executionId));

        TestCase testCase = execution.getTestcase();
        Endpoint endpoint = null;
        ApiTarget target = null;
        if (testCase != null) {
            testCase.getNom();
            endpoint = testCase.getEndpoint();
            if (endpoint != null) {
                endpoint.getNom();
                target = endpoint.getTarget();
                if (target != null) {
                    target.getNom();
                }
            }
        }

        String html = buildHtml(execution, testCase, endpoint, target);
        return html.getBytes(StandardCharsets.UTF_8);
    }

    private String buildHtml(Execution execution, TestCase testCase,
                             Endpoint endpoint, ApiTarget target) {
        String scenario = esc(testCase != null ? nullToDash(testCase.getNom()) : "Scénario inconnu");
        String method = endpoint != null && endpoint.getMethode() != null
                ? endpoint.getMethode().name() : "—";
        String fullUrl = buildFullUrl(endpoint, target);
        String envLabel = buildEnvLabel(target);
        String techAccount = buildTechAccount(target);
        String start = execution.getDateDebut() != null
                ? execution.getDateDebut().format(DATE_FMT) : "—";
        String end = execution.getDateFin() != null
                ? execution.getDateFin().format(DATE_FMT) : "—";
        String duration = formatDuration(execution.getDateDebut(), execution.getDateFin());
        TestStatus statut = execution.getStatut();
        String statusClass = statusCss(statut);
        String statusLabel = statut != null ? statut.name() : "INCONNU";
        String statusIcon = statusIcon(statut);

        Integer seuil = testCase != null ? testCase.getSeuilMs() : null;
        Double maxErr = testCase != null ? testCase.getTauxErreurMax() : null;
        Integer p95 = execution.getP95MesureMs();
        Double err = execution.getTauxErreurMesure();
        int total = n(execution.getReqTotal());
        int ok = n(execution.getReqReussies());
        int fail = n(execution.getReqEchouees());
        double successPct = total > 0 ? (ok * 100.0 / total) : 0;

        boolean p95Ok = seuil == null || p95 == null || p95 <= seuil;
        boolean errOk = maxErr == null || err == null || err <= maxErr;
        boolean successOk = total == 0 || successPct >= 50;

        String expectedCode = testCase != null && testCase.getExpectedCode() != null
                ? testCase.getExpectedCode()
                : (endpoint != null && endpoint.getCodeAttendu() != null
                ? String.valueOf(endpoint.getCodeAttendu()) : null);

        List<StatusCount> codes = parseStatusCodes(execution.getRapportK6Json());
        JsonNode durationVals = metricValues(execution.getRapportK6Json(), "http_req_duration");
        Map<String, Boolean> thresholds = parseThresholds(execution.getRapportK6Json());

        String executive = buildExecutiveSummary(
                scenario, total, ok, successPct, p95, seuil, err, maxErr, statut);

        StringBuilder sb = new StringBuilder(48_000);
        sb.append("<!DOCTYPE html>\n<html lang=\"fr\">\n<head>\n");
        sb.append("<meta charset=\"UTF-8\">\n");
        sb.append("<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n");
        sb.append("<title>Rapport — ").append(scenario).append("</title>\n");
        sb.append("<style>\n").append(css()).append("\n</style>\n</head>\n<body>\n");

        // --- 1. Header ---
        sb.append("<header class=\"hero\">\n");
        sb.append("<div class=\"hero-top\">\n");
        sb.append("<p class=\"eyebrow\">Rapport de test de performance API</p>\n");
        sb.append("<h1>").append(scenario).append("</h1>\n");
        sb.append("<p class=\"endpoint-line\"><span class=\"method\">").append(esc(method))
                .append("</span> <code>").append(esc(fullUrl)).append("</code></p>\n");
        sb.append("</div>\n");
        sb.append("<div class=\"status-banner ").append(statusClass).append("\">\n");
        sb.append("<span class=\"status-badge\">").append(statusIcon).append(' ')
                .append(esc(statusLabel)).append("</span>\n");
        sb.append("<p class=\"executive\">").append(esc(executive)).append("</p>\n");
        sb.append("</div>\n");
        sb.append("<div class=\"meta-grid\">\n");
        meta(sb, "Environnement", envLabel);
        meta(sb, "Compte technique", techAccount);
        meta(sb, "Début", start);
        meta(sb, "Fin", end);
        meta(sb, "Durée totale", duration);
        meta(sb, "Exécution #", execution.getId() != null ? String.valueOf(execution.getId()) : "—");
        sb.append("</div>\n</header>\n");

        // --- 3. Infos générales ---
        sb.append("<section class=\"card\">\n<h2>Infos générales</h2>\n");
        sb.append("<div class=\"info-grid\">\n");
        info(sb, "Mode de charge", formatMode(execution.getExecutionMode()),
                execution.getExecutionMode() == ExecutionMode.REQUETES
                        ? "Le test s'arrête après un nombre fixe de requêtes."
                        : "Le test envoie du trafic pendant une durée fixe.");
        info(sb, "Utilisateurs virtuels (VUs)",
                execution.getVus() != null ? String.valueOf(execution.getVus()) : "—",
                "Nombre de clients simulés en parallèle pendant le test.");
        if (execution.getExecutionMode() == ExecutionMode.REQUETES) {
            info(sb, "Requêtes demandées",
                    execution.getNombreRequetes() != null
                            ? String.valueOf(execution.getNombreRequetes()) : "—",
                    "Volume total de requêtes que k6 devait envoyer.");
        } else {
            info(sb, "Durée du test",
                    execution.getDureeSec() != null ? execution.getDureeSec() + " s" : "—",
                    "Temps pendant lequel k6 a généré de la charge.");
        }
        info(sb, "Code HTTP attendu", nullToDash(expectedCode),
                "Statut de réponse considéré comme une réussite pour ce scénario.");
        info(sb, "Code(s) obtenu(s)", summarizeCodes(codes),
                "Répartition réelle des codes HTTP observés pendant le run.");
        Integer timeout = testCase != null ? testCase.getTimeoutMs() : null;
        info(sb, "Timeout configuré",
                timeout != null ? timeout + " ms" : "—",
                "Délai max d'attente d'une réponse avant de compter la requête en échec.");
        sb.append("</div>\n</section>\n");

        // --- 4. Attendu vs Mesuré ---
        sb.append("<section class=\"card\">\n<h2>Attendu vs mesuré</h2>\n");
        sb.append("<p class=\"section-lead\">Comparaison entre la cible configurée sur le scénario ")
                .append("et ce que k6 a réellement mesuré.</p>\n");
        sb.append("<div class=\"compare-list\">\n");

        compareRow(sb, "Temps de réponse P95",
                seuil != null ? "< " + seuil + " ms" : "Non défini",
                p95 != null ? p95 + " ms" : "—",
                verdictThree(seuil != null && p95 != null, p95Ok, false),
                "95 % des requêtes ont répondu plus vite que cette durée. Plus c'est bas, mieux c'est.");

        compareRow(sb, "Taux d'erreur",
                maxErr != null ? "≤ " + fmt(maxErr) + " %" : "Non défini",
                err != null ? fmt(err) + " %" : "—",
                verdictThree(maxErr != null && err != null, errOk, false),
                "Pourcentage de requêtes en échec (mauvais code, timeout, erreur réseau).");

        Verdict successVerdict;
        if (total == 0) {
            successVerdict = Verdict.UNKNOWN;
        } else if (fail == 0 || successPct >= 99.9) {
            successVerdict = Verdict.OK;
        } else if (successOk) {
            successVerdict = Verdict.PARTIAL;
        } else {
            successVerdict = Verdict.KO;
        }
        compareRow(sb, "Requêtes réussies",
                "Code HTTP conforme",
                ok + " / " + total + " (" + fmt(successPct) + " %)",
                successVerdict,
                "Part des requêtes dont le code de réponse correspondait à l'attendu.");

        sb.append("</div>\n</section>\n");

        // --- 5. Détail technique k6 (repliable) ---
        sb.append("<section class=\"card\">\n");
        sb.append("<details class=\"tech-details\">\n");
        sb.append("<summary>Voir le détail technique k6</summary>\n");
        sb.append("<div class=\"tech-body\">\n");

        sb.append("<h3>http_req_duration</h3>\n");
        sb.append("<div class=\"metric-cards\">\n");
        metricCard(sb, "Moyenne", formatMs(durationVals, "avg"));
        metricCard(sb, "Médiane", formatMs(durationVals, "med"));
        metricCard(sb, "P90", formatMs(durationVals, "p(90)"));
        metricCard(sb, "P95", p95 != null ? p95 + " ms" : formatMs(durationVals, "p(95)"));
        metricCard(sb, "P99", formatMs(durationVals, "p(99)"));
        metricCard(sb, "Max", formatMs(durationVals, "max"));
        sb.append("</div>\n");

        sb.append("<h3>Volume &amp; erreurs</h3>\n");
        sb.append("<div class=\"metric-cards\">\n");
        metricCard(sb, "http_reqs (total)", total > 0 ? String.valueOf(total) : "—");
        metricCard(sb, "RPS moyen",
                execution.getRpsMoyen() != null ? fmt(execution.getRpsMoyen()) : "—");
        metricCard(sb, "Réussies", String.valueOf(ok));
        metricCard(sb, "Échouées", String.valueOf(fail));
        metricCard(sb, "status_mismatch_rate",
                err != null ? fmt(err) + " %" : "—");
        sb.append("</div>\n");

        if (!thresholds.isEmpty()) {
            sb.append("<h3>Seuils k6 (thresholds)</h3>\n");
            sb.append("<table class=\"simple-table\"><thead><tr>")
                    .append("<th>Seuil</th><th>Verdict k6</th></tr></thead><tbody>\n");
            for (Map.Entry<String, Boolean> th : thresholds.entrySet()) {
                boolean respected = Boolean.TRUE.equals(th.getValue());
                sb.append("<tr><td>").append(esc(th.getKey())).append("</td><td class=\"")
                        .append(respected ? "ok" : "ko").append("\">")
                        .append(respected ? "✅ Respecté" : "❌ Non respecté")
                        .append("</td></tr>\n");
            }
            sb.append("</tbody></table>\n");
        }
        sb.append("</div>\n</details>\n</section>\n");

        // --- 6. Endpoint ---
        sb.append("<section class=\"card\">\n<h2>Endpoint testé</h2>\n");
        sb.append("<p class=\"endpoint-line\"><span class=\"method\">").append(esc(method))
                .append("</span> <code>").append(esc(fullUrl)).append("</code></p>\n");

        if (!codes.isEmpty()) {
            sb.append("<h3>Codes HTTP observés</h3>\n");
            sb.append("<table class=\"simple-table\"><thead><tr>")
                    .append("<th>Code</th><th>Occurrences</th><th>Commentaire</th>")
                    .append("</tr></thead><tbody>\n");
            for (StatusCount sc : codes) {
                String label = "0".equals(sc.code) ? "Aucune réponse" : sc.code;
                String comment;
                if ("0".equals(sc.code)) {
                    comment = "Timeout, DNS, connexion refusée, etc.";
                } else if (expectedCode != null && matchesExpected(sc.code, expectedCode)) {
                    comment = "Conforme au code attendu (" + expectedCode + ")";
                } else if (expectedCode != null) {
                    comment = "Différent du code attendu (" + expectedCode + ")";
                } else {
                    comment = "Code observé pendant le run";
                }
                sb.append("<tr><td>").append(esc(label)).append("</td><td>")
                        .append(sc.count).append("</td><td>").append(esc(comment))
                        .append("</td></tr>\n");
            }
            sb.append("</tbody></table>\n");
        }

        String bodyPreview = sanitizeBody(testCase != null ? testCase.getJSONBody() : null,
                endpoint != null ? endpoint.getBody() : null);
        if (bodyPreview != null) {
            sb.append("<h3>Corps de requête (aperçu)</h3>\n");
            sb.append("<pre class=\"code-block\">").append(esc(bodyPreview)).append("</pre>\n");
        }

        String headersPreview = sanitizeHeaders(
                endpoint != null ? endpoint.getHeaders() : null,
                endpoint != null ? endpoint.getContentType() : null,
                target);
        if (headersPreview != null) {
            sb.append("<h3>Headers pertinents</h3>\n");
            sb.append("<pre class=\"code-block\">").append(esc(headersPreview)).append("</pre>\n");
        }
        sb.append("</section>\n");

        // --- 7. Glossaire ---
        sb.append("<section class=\"card glossary\">\n");
        sb.append("<h2>Glossaire &amp; notes de lecture</h2>\n");
        sb.append("<dl>\n");
        gloss(sb, "P95",
                "Temps sous lequel 95 % des requêtes ont répondu. Indicateur courant de latence « pire cas fréquent ».");
        gloss(sb, "RPS",
                "Requêtes par seconde : débit moyen réellement produit pendant le test.");
        gloss(sb, "VU",
                "Utilisateur virtuel : un client simulé qui envoie des requêtes en parallèle des autres.");
        gloss(sb, "Seuil k6 (threshold)",
                "Règle déclarée dans le script (ex. P95 &lt; 1000 ms). k6 indique s'il a été respecté.");
        gloss(sb, "Taux d'erreur",
                "Pourcentage de requêtes non conformes au code HTTP attendu ou sans réponse.");
        gloss(sb, "Timeout",
                "Délai maximum d'attente d'une réponse avant d'abandonner la requête.");
        sb.append("</dl>\n");
        sb.append("<div class=\"notes\">\n");
        sb.append("<p><strong>Règle de statut global</strong> — ")
                .append("<span class=\"tag ok\">REUSSIE</span> : tous les seuils sont respectés. ")
                .append("<span class=\"tag partial\">PARTIELLE</span> : au moins un seuil dépassé ")
                .append("mais ≥ 50 % des requêtes réussissent. ")
                .append("<span class=\"tag ko\">ECHOUEE</span> : échec majeur ")
                .append("(seuils non respectés et faible taux de réussite).</p>\n");
        sb.append("<p><strong>Attention</strong> — Les valeurs « attendues » proviennent de la ")
                .append("configuration <em>actuelle</em> du scénario. Si le scénario a été modifié ")
                .append("après l'exécution, la cible affichée peut différer de celle utilisée au moment du run.</p>\n");
        sb.append("</div>\n</section>\n");

        sb.append("<footer class=\"page-footer\">Rapport généré automatiquement à partir des résultats k6");
        if (execution.getCorrelationId() != null) {
            sb.append(" · corrélation ").append(esc(execution.getCorrelationId()));
        }
        sb.append("</footer>\n</body>\n</html>\n");
        return sb.toString();
    }

    // --- domain helpers ---

    private String buildExecutiveSummary(String scenario, int total, int ok, double successPct,
                                         Integer p95, Integer seuil, Double err, Double maxErr,
                                         TestStatus statut) {
        String name = scenario != null ? scenario : "L'API";
        if (total == 0) {
            return name + " n'a produit aucune requête mesurable lors de cette exécution. "
                    + "Le test n'a pas pu être évalué correctement.";
        }

        String speedPart;
        if (p95 != null && seuil != null) {
            if (p95 <= seuil) {
                speedPart = "avec un temps de réponse P95 de " + p95
                        + " ms, sous la limite acceptée de " + seuil + " ms";
            } else {
                speedPart = "mais avec un temps de réponse P95 de " + p95
                        + " ms, au-dessus de la limite acceptée de " + seuil + " ms";
            }
        } else if (p95 != null) {
            speedPart = "avec un temps de réponse P95 de " + p95 + " ms";
        } else {
            speedPart = "sans mesure de latence exploitable";
        }

        String errorPart;
        if (err != null && err <= 0.05) {
            errorPart = "sans erreur significative";
        } else if (err != null && maxErr != null && err <= maxErr) {
            errorPart = "avec un taux d'erreur de " + fmt(err)
                    + " %, encore dans la limite de " + fmt(maxErr) + " %";
        } else if (err != null) {
            errorPart = "avec un taux d'erreur de " + fmt(err) + " %";
        } else {
            errorPart = "sans taux d'erreur mesuré";
        }

        String outcome;
        if (statut == TestStatus.REUSSIE) {
            outcome = "Le test est une réussite.";
        } else if (statut == TestStatus.PARTIELLE) {
            outcome = "Le test est partiellement réussi : certains objectifs ne sont pas atteints.";
        } else if (statut == TestStatus.ECHOUEE) {
            outcome = "Le test est en échec.";
        } else {
            outcome = "Le statut du test n'a pas pu être déterminé.";
        }

        return name + " a répondu correctement à " + fmt(successPct) + " % des "
                + total + " requêtes envoyées (" + ok + " réussies), " + speedPart
                + ", " + errorPart + ". " + outcome;
    }

    private String buildFullUrl(Endpoint endpoint, ApiTarget target) {
        if (endpoint == null) return "—";
        String base = target != null && target.getUrlBase() != null ? target.getUrlBase().trim() : "";
        String path = endpoint.getChemin() != null ? endpoint.getChemin().trim() : "";
        if (base.endsWith("/") && path.startsWith("/")) {
            return base.substring(0, base.length() - 1) + path;
        }
        if (!base.isEmpty() && !path.startsWith("/") && !base.endsWith("/")) {
            return base + "/" + path;
        }
        return base + path;
    }

    private String buildEnvLabel(ApiTarget target) {
        if (target == null) return "Non renseigné";
        String nom = target.getNom() != null ? target.getNom() : "Cible";
        String url = target.getUrlBase() != null ? target.getUrlBase() : "";
        return url.isBlank() ? nom : nom + " — " + url;
    }

    private String buildTechAccount(ApiTarget target) {
        if (target == null) return "Non renseigné";
        AuthType auth = target.getAuthType() != null ? target.getAuthType() : AuthType.NONE;
        String targetName = target.getNom() != null ? target.getNom() : "cible";
        return switch (auth) {
            case NONE -> "Cible « " + targetName + " » (sans authentification)";
            case BEARER -> "Cible « " + targetName + " » (Bearer token — masqué)";
            case API_KEY -> {
                String keyName = target.getKeyName() != null ? target.getKeyName() : "clé API";
                yield "Cible « " + targetName + " » (API Key « " + keyName + " » — valeur masquée)";
            }
            case OAUTH2 -> {
                String client = target.getClientId() != null ? target.getClientId() : "client OAuth2";
                yield "Cible « " + targetName + " » (OAuth2 client_id=" + client + " — secret masqué)";
            }
        };
    }

    private String formatMode(ExecutionMode mode) {
        if (mode == null) return "—";
        return mode == ExecutionMode.REQUETES ? "Nombre de requêtes fixe" : "Durée fixe";
    }

    private String formatDuration(LocalDateTime start, LocalDateTime end) {
        if (start == null || end == null) return "—";
        Duration d = Duration.between(start, end);
        long sec = Math.max(0, d.getSeconds());
        if (sec < 60) return sec + " s";
        long min = sec / 60;
        long rem = sec % 60;
        return min + " min " + rem + " s";
    }

    private String statusCss(TestStatus statut) {
        if (statut == TestStatus.REUSSIE) return "status-ok";
        if (statut == TestStatus.PARTIELLE) return "status-partial";
        if (statut == TestStatus.ECHOUEE) return "status-ko";
        return "status-unknown";
    }

    private String statusIcon(TestStatus statut) {
        if (statut == TestStatus.REUSSIE) return "✅";
        if (statut == TestStatus.PARTIELLE) return "⚠️";
        if (statut == TestStatus.ECHOUEE) return "❌";
        return "•";
    }

    // --- HTML fragments ---

    private void meta(StringBuilder sb, String label, String value) {
        sb.append("<div class=\"meta-item\"><span class=\"meta-label\">")
                .append(esc(label)).append("</span><strong>")
                .append(esc(value)).append("</strong></div>\n");
    }

    private void info(StringBuilder sb, String label, String value, String hint) {
        sb.append("<div class=\"info-item\"><span class=\"info-label\">")
                .append(esc(label)).append("</span><strong>")
                .append(esc(value)).append("</strong>");
        if (hint != null) {
            sb.append("<small>").append(esc(hint)).append("</small>");
        }
        sb.append("</div>\n");
    }

    private void compareRow(StringBuilder sb, String metric, String expected, String actual,
                             Verdict verdict, String hint) {
        String icon = switch (verdict) {
            case OK -> "✅";
            case PARTIAL -> "⚠️";
            case KO -> "❌";
            case UNKNOWN -> "—";
        };
        String rowClass = switch (verdict) {
            case OK -> "row-ok";
            case PARTIAL -> "row-partial";
            case KO -> "row-ko";
            case UNKNOWN -> "";
        };
        sb.append("<div class=\"compare-row ").append(rowClass).append("\">\n");
        sb.append("<div class=\"compare-main\">\n");
        sb.append("<span class=\"compare-metric\">").append(esc(metric)).append("</span>\n");
        sb.append("<span class=\"compare-expected\">Cible : ").append(esc(expected)).append("</span>\n");
        sb.append("<span class=\"compare-actual\">Mesuré : ").append(esc(actual)).append("</span>\n");
        sb.append("<span class=\"compare-verdict\" aria-label=\"Verdict\">")
                .append(icon).append("</span>\n");
        sb.append("</div>\n");
        sb.append("<p class=\"compare-hint\">").append(esc(hint)).append("</p>\n");
        sb.append("</div>\n");
    }

    private Verdict verdictThree(boolean comparable, boolean ok, boolean partial) {
        if (!comparable) return Verdict.UNKNOWN;
        if (ok) return Verdict.OK;
        if (partial) return Verdict.PARTIAL;
        return Verdict.KO;
    }

    private void metricCard(StringBuilder sb, String label, String value) {
        sb.append("<div class=\"metric-card\"><span>").append(esc(label))
                .append("</span><strong>").append(esc(value)).append("</strong></div>\n");
    }

    private void gloss(StringBuilder sb, String term, String def) {
        sb.append("<div class=\"gloss-item\"><dt>").append(esc(term))
                .append("</dt><dd>").append(esc(def)).append("</dd></div>\n");
    }

    // --- parsing / sanitize ---

    private JsonNode metricValues(String rapportJson, String metricName) {
        try {
            if (rapportJson == null || !rapportJson.trim().startsWith("{")) return null;
            JsonNode values = objectMapper.readTree(rapportJson)
                    .path("metrics").path(metricName).path("values");
            return values.isMissingNode() || values.isNull() ? null : values;
        } catch (Exception e) {
            return null;
        }
    }

    private String formatMs(JsonNode values, String key) {
        if (values == null || !values.has(key) || values.get(key).isNull()) return "—";
        return Math.round(values.get(key).asDouble()) + " ms";
    }

    private Map<String, Boolean> parseThresholds(String rapportJson) {
        Map<String, Boolean> result = new LinkedHashMap<>();
        try {
            if (rapportJson == null || !rapportJson.trim().startsWith("{")) return result;
            JsonNode metrics = objectMapper.readTree(rapportJson).path("metrics");
            if (!metrics.isObject()) return result;
            Iterator<Map.Entry<String, JsonNode>> it = metrics.fields();
            while (it.hasNext()) {
                Map.Entry<String, JsonNode> metric = it.next();
                JsonNode thresholds = metric.getValue().path("thresholds");
                if (!thresholds.isObject()) continue;
                Iterator<Map.Entry<String, JsonNode>> th = thresholds.fields();
                while (th.hasNext()) {
                    Map.Entry<String, JsonNode> entry = th.next();
                    result.put(metric.getKey() + " → " + entry.getKey(),
                            entry.getValue().path("ok").asBoolean(false));
                }
            }
        } catch (Exception ignored) {
            // empty
        }
        return result;
    }

    private List<StatusCount> parseStatusCodes(String rapportJson) {
        List<StatusCount> result = new ArrayList<>();
        try {
            if (rapportJson == null || !rapportJson.trim().startsWith("{")) return result;
            JsonNode checks = objectMapper.readTree(rapportJson).path("root_group").path("checks");
            if (!checks.isArray()) return result;
            String prefix = "actual status observed: ";
            for (JsonNode check : checks) {
                String name = check.path("name").asText("");
                if (name.startsWith(prefix)) {
                    result.add(new StatusCount(name.substring(prefix.length()),
                            check.path("passes").asInt(0)));
                }
            }
            result.sort((a, b) -> Integer.compare(b.count, a.count));
        } catch (Exception ignored) {
            // empty
        }
        return result;
    }

    private String summarizeCodes(List<StatusCount> codes) {
        if (codes.isEmpty()) return "—";
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < codes.size(); i++) {
            if (i > 0) sb.append(", ");
            StatusCount sc = codes.get(i);
            sb.append("0".equals(sc.code) ? "aucune réponse" : sc.code)
                    .append(" ×").append(sc.count);
        }
        return sb.toString();
    }

    private boolean matchesExpected(String actual, String expected) {
        if (expected == null || expected.isBlank()) return true;
        String exp = expected.trim().toLowerCase(Locale.ROOT);
        if (exp.endsWith("xx") && exp.length() == 3) {
            return actual.length() == 3 && actual.charAt(0) == exp.charAt(0);
        }
        return actual.equals(expected.trim());
    }

    private String sanitizeBody(String testCaseBody, String endpointBody) {
        String raw = (testCaseBody != null && !testCaseBody.isBlank()) ? testCaseBody : endpointBody;
        if (raw == null || raw.isBlank()) return null;
        String trimmed = raw.trim();
        if (trimmed.length() > 1200) {
            trimmed = trimmed.substring(0, 1200) + "\n… (tronqué)";
        }
        // Mask obvious secret-looking JSON fields.
        return trimmed
                .replaceAll("(?i)(\"(?:password|secret|token|api[_-]?key|authorization)\"\\s*:\\s*\")([^\"]*)(\")",
                        "$1***$3");
    }

    private String sanitizeHeaders(String headersJson, String contentType, ApiTarget target) {
        StringBuilder out = new StringBuilder();
        if (contentType != null && !contentType.isBlank()) {
            out.append("Content-Type: ").append(contentType).append('\n');
        }
        if (target != null && target.getAuthType() != null && target.getAuthType() != AuthType.NONE) {
            switch (target.getAuthType()) {
                case BEARER -> out.append("Authorization: Bearer ***\n");
                case API_KEY -> {
                    String key = target.getKeyName() != null ? target.getKeyName() : "X-Api-Key";
                    out.append(key).append(": ***\n");
                }
                case OAUTH2 -> out.append("Authorization: Bearer *** (OAuth2)\n");
                default -> { }
            }
        }
        if (headersJson != null && !headersJson.isBlank()) {
            try {
                JsonNode node = objectMapper.readTree(headersJson);
                if (node.isObject()) {
                    Iterator<Map.Entry<String, JsonNode>> it = node.fields();
                    while (it.hasNext()) {
                        Map.Entry<String, JsonNode> e = it.next();
                        String key = e.getKey();
                        String val = e.getValue().asText("");
                        if (isSensitiveHeader(key)) {
                            out.append(key).append(": ***\n");
                        } else {
                            out.append(key).append(": ").append(val).append('\n');
                        }
                    }
                } else {
                    out.append(maskHeaderLine(headersJson)).append('\n');
                }
            } catch (Exception e) {
                out.append(maskHeaderLine(headersJson)).append('\n');
            }
        }
        String result = out.toString().trim();
        return result.isEmpty() ? null : result;
    }

    private boolean isSensitiveHeader(String key) {
        String k = key.toLowerCase(Locale.ROOT);
        return k.contains("authorization") || k.contains("api-key") || k.contains("apikey")
                || k.contains("secret") || k.contains("token") || k.contains("password");
    }

    private String maskHeaderLine(String raw) {
        return raw.replaceAll("(?i)(authorization\\s*[:=]\\s*Bearer\\s+)\\S+", "$1***")
                .replaceAll("(?i)((?:api[_-]?key|token|secret)\\s*[:=]\\s*)\\S+", "$1***");
    }

    private int n(Integer v) {
        return v != null ? v : 0;
    }

    private String fmt(double v) {
        return String.format(Locale.FRANCE, "%.1f", v);
    }

    private String nullToDash(String v) {
        return v == null || v.isBlank() ? "—" : v;
    }

    private String esc(String raw) {
        if (raw == null) return "";
        return raw
                .replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&#39;");
    }

    private record StatusCount(String code, int count) {}

    private enum Verdict { OK, PARTIAL, KO, UNKNOWN }

    private String css() {
        return """
                :root {
                  --ink: #0f172a;
                  --muted: #64748b;
                  --line: #e2e8f0;
                  --bg: #f1f5f9;
                  --card: #ffffff;
                  --ok: #15803d;
                  --ok-bg: #dcfce7;
                  --partial: #b45309;
                  --partial-bg: #ffedd5;
                  --ko: #b91c1c;
                  --ko-bg: #fee2e2;
                  --navy: #0d2447;
                  --accent: #1d4ed8;
                }
                * { box-sizing: border-box; }
                body {
                  margin: 0;
                  font-family: "Segoe UI", system-ui, -apple-system, sans-serif;
                  color: var(--ink);
                  background: linear-gradient(180deg, #e8eef7 0%, var(--bg) 220px);
                  line-height: 1.5;
                  padding: 32px 20px 48px;
                }
                .hero, .card {
                  max-width: 880px;
                  margin: 0 auto 18px;
                  background: var(--card);
                  border: 1px solid var(--line);
                  border-radius: 16px;
                  padding: 24px 28px;
                  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.05);
                }
                .eyebrow {
                  margin: 0 0 6px;
                  text-transform: uppercase;
                  letter-spacing: 0.06em;
                  font-size: 11px;
                  font-weight: 700;
                  color: var(--muted);
                }
                h1 { margin: 0 0 10px; font-size: 26px; color: var(--navy); }
                h2 { margin: 0 0 12px; font-size: 18px; color: var(--navy); }
                h3 { margin: 18px 0 10px; font-size: 14px; color: var(--navy); }
                .endpoint-line { margin: 0; display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
                .method {
                  display: inline-flex; padding: 2px 8px; border-radius: 6px;
                  background: #dbeafe; color: var(--accent); font-size: 12px; font-weight: 700;
                }
                code, .code-block {
                  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
                  font-size: 12px;
                }
                code {
                  background: #f8fafc; border: 1px solid var(--line);
                  padding: 4px 8px; border-radius: 8px; word-break: break-all;
                }
                .code-block {
                  display: block; background: #0f172a; color: #e2e8f0;
                  padding: 14px; border-radius: 10px; overflow: auto; white-space: pre-wrap;
                }
                .status-banner {
                  margin: 18px 0 16px; padding: 16px 18px; border-radius: 12px;
                }
                .status-ok { background: var(--ok-bg); }
                .status-partial { background: var(--partial-bg); }
                .status-ko { background: var(--ko-bg); }
                .status-unknown { background: #f1f5f9; }
                .status-badge {
                  display: inline-flex; align-items: center; gap: 6px;
                  font-weight: 800; letter-spacing: 0.04em; font-size: 13px;
                  margin-bottom: 8px;
                }
                .status-ok .status-badge { color: var(--ok); }
                .status-partial .status-badge { color: var(--partial); }
                .status-ko .status-badge { color: var(--ko); }
                .executive { margin: 0; font-size: 15px; color: var(--ink); }
                .meta-grid, .info-grid, .metric-cards {
                  display: grid; gap: 12px;
                  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
                }
                .meta-item, .info-item, .metric-card {
                  background: #f8fafc; border: 1px solid var(--line);
                  border-radius: 12px; padding: 12px 14px;
                }
                .meta-label, .info-label, .metric-card span {
                  display: block; font-size: 11px; text-transform: uppercase;
                  letter-spacing: 0.04em; color: var(--muted); margin-bottom: 4px;
                }
                .meta-item strong, .info-item strong, .metric-card strong {
                  font-size: 14px; color: var(--navy); word-break: break-word;
                }
                .info-item small, .compare-hint, .section-lead {
                  display: block; margin-top: 6px; font-size: 12px; color: var(--muted);
                }
                .section-lead { margin: -4px 0 14px; }
                .compare-list { display: flex; flex-direction: column; gap: 10px; }
                .compare-row {
                  border: 1px solid var(--line); border-radius: 12px; padding: 12px 14px;
                  background: #fff;
                }
                .compare-row.row-ok { border-color: #86efac; background: #f0fdf4; }
                .compare-row.row-partial { border-color: #fdba74; background: #fff7ed; }
                .compare-row.row-ko { border-color: #fca5a5; background: #fef2f2; }
                .compare-main {
                  display: grid; gap: 8px;
                  grid-template-columns: 1.4fr 1.2fr 1.2fr auto;
                  align-items: center;
                }
                .compare-metric { font-weight: 700; color: var(--navy); }
                .compare-expected, .compare-actual { font-size: 13px; }
                .compare-verdict { font-size: 20px; text-align: right; }
                .tech-details summary {
                  cursor: pointer; font-weight: 700; color: var(--accent); list-style: none;
                }
                .tech-details summary::-webkit-details-marker { display: none; }
                .tech-details summary::before { content: "▸ "; }
                .tech-details[open] summary::before { content: "▾ "; }
                .tech-body { margin-top: 14px; }
                .simple-table {
                  width: 100%; border-collapse: collapse; font-size: 13px; margin-top: 8px;
                }
                .simple-table th, .simple-table td {
                  border-bottom: 1px solid var(--line); text-align: left; padding: 8px 6px;
                }
                .simple-table th { color: var(--muted); font-size: 11px; text-transform: uppercase; }
                .simple-table .ok { color: var(--ok); font-weight: 700; }
                .simple-table .ko { color: var(--ko); font-weight: 700; }
                .glossary dl { margin: 0; display: grid; gap: 10px; }
                .gloss-item {
                  display: grid; grid-template-columns: 140px 1fr; gap: 10px;
                  padding: 10px 0; border-bottom: 1px solid var(--line);
                }
                .gloss-item dt { font-weight: 700; color: var(--navy); }
                .gloss-item dd { margin: 0; color: var(--muted); font-size: 13px; }
                .notes {
                  margin-top: 16px; padding: 14px; border-radius: 12px;
                  background: #f8fafc; border: 1px dashed var(--line); font-size: 13px;
                }
                .tag {
                  display: inline-block; padding: 1px 7px; border-radius: 999px;
                  font-size: 11px; font-weight: 700;
                }
                .tag.ok { background: var(--ok-bg); color: var(--ok); }
                .tag.partial { background: var(--partial-bg); color: var(--partial); }
                .tag.ko { background: var(--ko-bg); color: var(--ko); }
                .page-footer {
                  max-width: 880px; margin: 8px auto 0; text-align: center;
                  color: var(--muted); font-size: 12px;
                }
                @media (max-width: 720px) {
                  .compare-main { grid-template-columns: 1fr; }
                  .gloss-item { grid-template-columns: 1fr; }
                  body { padding: 16px 12px 32px; }
                  .hero, .card { padding: 18px; }
                }
                @media print {
                  body { background: #fff; padding: 0; }
                  .hero, .card { box-shadow: none; break-inside: avoid; }
                  .tech-details { open: true; }
                }
                """;
    }
}
