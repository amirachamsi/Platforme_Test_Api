package com.bct.back.services;

import com.bct.back.entities.Endpoint;
import com.bct.back.entities.ApiTarget;
import com.bct.back.enums.AuthType;
import com.bct.back.enums.KeyLocation;
import com.bct.back.repositories.EndpointRepository;
import com.bct.back.repositories.ApiTargetRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import com.bct.back.entities.PingResult;
import com.bct.back.repositories.PingResultRepository;
import java.time.LocalDateTime;


import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional
public class EndpointService {
    private final EndpointRepository apiEndpointRepository;
    private final ApiTargetRepository apiTargetRepository;
    private final PingResultRepository pingResultRepository;
    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .build();

    @Transactional(readOnly = true)
    public List<Endpoint> findAll() {
        return apiEndpointRepository.findByDeletedFalse();
    }

    @Transactional(readOnly = true)
    public List<Endpoint> findByTargetId(Long targetId) {
        return apiEndpointRepository.findByTargetIdAndDeletedFalse(targetId);
    }

    @Transactional(readOnly = true)
    public Endpoint findById(Long id) {
        return apiEndpointRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Endpoint introuvable, id=" + id));
    }

    @Transactional
    public Endpoint create(Endpoint endpoint) {
        if (endpoint.getTarget() != null && endpoint.getTarget().getId() != null) {
            ApiTarget target = apiTargetRepository.findById(endpoint.getTarget().getId())
                    .orElseThrow(() -> new RuntimeException("ApiTarget introuvable avec l'id : " + endpoint.getTarget().getId()));
            endpoint.setTarget(target);
        }
        endpoint.setDeleted(false);
        return apiEndpointRepository.save(endpoint);
    }

    public Endpoint update(Long id, Endpoint payload) {
        Endpoint existing = findById(id);

        existing.setNom(payload.getNom());
        existing.setMethode(payload.getMethode());
        existing.setChemin(payload.getChemin());
        existing.setHeaders(payload.getHeaders());
        existing.setParams(payload.getParams());
        existing.setContentType(payload.getContentType());
        existing.setBody(payload.getBody());
        existing.setCodeAttendu(payload.getCodeAttendu());
        existing.setTempsMaxMs(payload.getTempsMaxMs());
        if (payload.getTarget() != null && payload.getTarget().getId() != null) {
            existing.setTarget(resolveTarget(payload.getTarget()));
        }

        return apiEndpointRepository.save(existing);
    }

    public void delete(Long id) {
        Endpoint endpoint = findById(id);
        endpoint.setDeleted(true);
        apiEndpointRepository.save(endpoint);
    }

    // Le frontend envoie `target: { id }`; on résout la véritable entité gérée par JPA
    // afin d'éviter une tentative d'insertion d'une ApiTarget "fantôme".
    private ApiTarget resolveTarget(ApiTarget targetRef) {
        if (targetRef == null || targetRef.getId() == null) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST, "La cible (target.id) est obligatoire.");
        }
        return apiTargetRepository.findById(targetRef.getId())
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Cible API introuvable, id=" + targetRef.getId()));
    }

// Add to EndpointService's constructor-injected fields:
//     private final PingResultRepository pingResultRepository;
//
// Add imports:
//     import com.bct.back.entities.PingResult;
//     import com.bct.back.repositories.PingResultRepository;
//     import java.time.LocalDateTime;

    public void ping(Long epid) {
        Endpoint ep = apiEndpointRepository.findById(epid).orElseThrow();
        ApiTarget target = ep.getTarget();
        LocalDateTime pingedAt = LocalDateTime.now();

        try {
            String url = ep.getTarget().getUrlBase();
            HttpRequest.Builder requestBuilder;

            if (target.getAuthType() == AuthType.API_KEY
                    && target.getKeyIn() == KeyLocation.QUERY
                    && target.getKeyName() != null && target.getSecretRef() != null) {
                String separator = url.contains("?") ? "&" : "?";
                url = url + separator + target.getKeyName() + "=" + target.getSecretRef();
            }

            requestBuilder = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .timeout(Duration.ofSeconds(10))
                    .GET();

            if (target.getAuthType() == AuthType.BEARER && target.getSecretRef() != null) {
                requestBuilder.header("Authorization", "Bearer " + target.getSecretRef());
            } else if (target.getAuthType() == AuthType.API_KEY
                    && target.getKeyIn() == KeyLocation.HEADER
                    && target.getKeyName() != null && target.getSecretRef() != null) {
                requestBuilder.header(target.getKeyName(), target.getSecretRef());
            }

            HttpResponse<Void> response = httpClient.send(requestBuilder.build(),
                    HttpResponse.BodyHandlers.discarding());

            // Was hardcoded to `statusCode == 200 || 201`. codeAttendu is the same field
            // TestCase execution already compares against — using it here too means
            // "active/inactive" actually reflects whether this endpoint is behaving as
            // configured, not just "responded to something." No expected code configured
            // yet ⇒ fall back to the old default so existing endpoints don't all flip
            // to "inactive" the moment this deploys.
            Integer expectedCode = ep.getCodeAttendu();
            boolean ok = expectedCode != null
                    ? response.statusCode() == expectedCode
                    : (response.statusCode() == 200 || response.statusCode() == 201);
            ep.setStatus(ok);
            apiEndpointRepository.save(ep);

            pingResultRepository.save(PingResult.builder()
                    .endpoint(ep)
                    .pingedAt(pingedAt)
                    .success(ok)
                    .statusCode(response.statusCode())
                    .message(ok
                            ? "OK"
                            : expectedCode != null
                            ? "Code inattendu : reçu " + response.statusCode() + ", attendu " + expectedCode
                            : "Code de réponse inattendu")
                    .build());

        } catch (Exception e) {
            ep.setStatus(false);
            apiEndpointRepository.save(ep);

            pingResultRepository.save(PingResult.builder()
                    .endpoint(ep)
                    .pingedAt(pingedAt)
                    .success(false)
                    .statusCode(null)
                    .message(e.getClass().getSimpleName() + ": " + e.getMessage())
                    .build());
        }
    }

}