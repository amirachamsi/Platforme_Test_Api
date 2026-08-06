package com.bct.back.services;

import com.bct.back.entities.ApiTarget;
import com.bct.back.enums.AuthType;
import com.bct.back.enums.KeyLocation;
import com.bct.back.repositories.ApiTargetRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.List;

@Service
public class ApiTargetService {

    private final ApiTargetRepository repository;

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(3))
            .build();

    public ApiTargetService(ApiTargetRepository repository) {
        this.repository = repository;
    }

    // Simple lecture, sans effet de bord : pas de ping ici (voir pingAndRefresh).
    public List<ApiTarget> findAll() {
        return repository.findAll();
    }

    public ApiTarget findById(Long id) {
        return repository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Cible introuvable (id=" + id + ")"));
    }

    public ApiTarget create(ApiTarget target) {
        target.setId(null); // évite un UPDATE accidentel si un id est déjà présent dans le payload
        return repository.save(target);
    }

    public ApiTarget update(Long id, ApiTarget updated) {
        ApiTarget existing = findById(id);
        existing.setNom(updated.getNom());
        existing.setUrlBase(updated.getUrlBase());
        existing.setAuthType(updated.getAuthType());
        existing.setSecretRef(updated.getSecretRef());
        existing.setKeyName(updated.getKeyName());
        existing.setKeyIn(updated.getKeyIn());
        existing.setTokenUrl(updated.getTokenUrl());
        existing.setClientId(updated.getClientId());
        if (updated.getActif() != null) {
            existing.setActif(updated.getActif()); // Boolean wrapper -> getActif(), pas isActif()
        }
        return repository.save(existing);
    }

    public void delete(Long id) {
        if (!repository.existsById(id)) {
            throw new ResponseStatusException(
                    HttpStatus.NOT_FOUND, "Cible introuvable (id=" + id + ")");
        }
        repository.deleteById(id);
    }

    // Endpoint explicite (ex. POST /api/targets/{id}/ping) : opération à effet de bord,
    // volontairement séparée de findAll() pour ne pas déclencher d'appels HTTP sortants
    // sur un simple GET, et pour rester appelable un par un plutôt qu'en boucle bloquante.
    public ApiTarget pingAndRefresh(Long id) {
        ApiTarget target = findById(id);
        ping(target);
        return repository.save(target);
    }

    // Pings the target's URL (with its auth attached) and updates `actif`.
    // Any response at all (even 4xx) counts as reachable; timeouts, connection
    // errors, or 5xx responses mark it inactive.
    private void ping(ApiTarget target) {
        try {
            String url = target.getUrlBase();
            HttpRequest.Builder requestBuilder;

            if (target.getAuthType() == AuthType.API_KEY
                    && target.getKeyIn() == KeyLocation.QUERY
                    && target.getKeyName() != null && target.getSecretRef() != null) {
                String separator = url.contains("?") ? "&" : "?";
                url = url + separator + target.getKeyName() + "=" + target.getSecretRef();
            }

            requestBuilder = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .timeout(Duration.ofSeconds(3))
                    .GET();

            if (target.getAuthType() == AuthType.BEARER && target.getSecretRef() != null) {
                requestBuilder.header("Authorization", "Bearer " + target.getSecretRef());
            } else if (target.getAuthType() == AuthType.API_KEY
                    && target.getKeyIn() == KeyLocation.HEADER
                    && target.getKeyName() != null && target.getSecretRef() != null) {
                requestBuilder.header(target.getKeyName(), target.getSecretRef());
            }
            // OAUTH2: only the base URL reachability is checked here (no full
            // client-credentials handshake).

            HttpResponse<Void> response = httpClient.send(requestBuilder.build(),
                    HttpResponse.BodyHandlers.discarding());

            target.setActif(response.statusCode() < 500);
        } catch (Exception e) {
            target.setActif(false);
        }
    }
}