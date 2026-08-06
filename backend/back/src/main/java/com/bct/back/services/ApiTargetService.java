package com.bct.back.services;


import com.bct.back.entities.*;
import com.bct.back.repositories.ApiTargetRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.List;

@Service
public class ApiTargetService {

    private static final Logger log = LoggerFactory.getLogger(ApiTargetService.class);

    private final ApiTargetRepository repository;

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(8))
            .build();

    public ApiTargetService(ApiTargetRepository repository) {
        this.repository = repository;
    }

    // Returns every target, pinging each one first so `actif` is up to date
    public List<ApiTarget> findAll() {
        List<ApiTarget> targets = repository.findAll();
        for (ApiTarget target : targets) {
            ping(target);
        }
        return repository.saveAll(targets);
    }

    public ApiTarget findById(Long id) {
        return repository.findById(id)
                .orElseThrow(() -> new RuntimeException("Cible introuvable (id=" + id + ")"));
    }

    public ApiTarget create(ApiTarget target) {
        return repository.save(target);
    }

    public ApiTarget update(Long id, ApiTarget updated) {
        ApiTarget existing = findById(id);
        existing.setNom(updated.getNom());
        existing.setUrlBase(updated.getUrlBase());
        existing.setEndpoint(updated.getEndpoint());
        existing.setHttpMethod(updated.getHttpMethod());
        existing.setAuthType(updated.getAuthType());
        existing.setSecretRef(updated.getSecretRef());
        existing.setKeyName(updated.getKeyName());
        existing.setKeyIn(updated.getKeyIn());
        existing.setTokenUrl(updated.getTokenUrl());
        existing.setClientId(updated.getClientId());
        existing.setActif(updated.isActif());
        return repository.save(existing);
    }

    public void delete(Long id) {
        repository.deleteById(id);
    }

    // Pings the target's endpoint (urlBase + endpoint, using its configured
    // HTTP method and auth) and updates `actif`. Any response at all (even
    // 4xx) counts as reachable; timeouts, connection errors, or 5xx
    // responses mark it inactive.
    private void ping(ApiTarget target) {
        try {
            String url = target.getUrlBase();
            if (target.getEndpoint() != null && !target.getEndpoint().isBlank()) {
                String base = url.endsWith("/") ? url.substring(0, url.length() - 1) : url;
                String path = target.getEndpoint().startsWith("/") ? target.getEndpoint() : "/" + target.getEndpoint();
                url = base + path;
            }

            if (target.getAuthType() == AuthType.API_KEY
                    && target.getKeyIn() == KeyLocation.QUERY
                    && target.getKeyName() != null && target.getSecretRef() != null) {
                String separator = url.contains("?") ? "&" : "?";
                url = url + separator + target.getKeyName() + "=" + target.getSecretRef();
            }

            HttpMethod method = target.getHttpMethod() == null ? HttpMethod.GET : target.getHttpMethod();
            HttpRequest.Builder requestBuilder = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .timeout(Duration.ofSeconds(8))
                    .method(method.name(), HttpRequest.BodyPublishers.noBody());

            if (target.getAuthType() == AuthType.BEARER && target.getSecretRef() != null) {
                requestBuilder.header("Authorization", "Bearer " + target.getSecretRef());
            } else if (target.getAuthType() == AuthType.API_KEY
                    && target.getKeyIn() == KeyLocation.HEADER
                    && target.getKeyName() != null && target.getSecretRef() != null) {
                requestBuilder.header(target.getKeyName(), target.getSecretRef());
            }
            // OAUTH2: only endpoint reachability is checked here (no full
            // client-credentials handshake).

            HttpResponse<Void> response = httpClient.send(requestBuilder.build(),
                    HttpResponse.BodyHandlers.discarding());

            target.setActif(response.statusCode() < 500);
            log.info("Ping {} {} -> {}", method, url, response.statusCode());
        } catch (Exception e) {
            log.warn("Ping failed for target '{}' ({}): {}", target.getNom(), target.getUrlBase(), e.toString());
            target.setActif(false);
        }
    }
}


