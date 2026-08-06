package com.bct.back.services;

import com.bct.back.entities.Endpoint;
import com.bct.back.entities.ApiTarget;
import com.bct.back.repositories.EndpointRepository;
import com.bct.back.repositories.ApiTargetRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional
public class EndpointService {

    private final EndpointRepository apiEndpointRepository;
    private final ApiTargetRepository apiTargetRepository;

    @Transactional(readOnly = true)
    public List<Endpoint> findAll() {
        return apiEndpointRepository.findAll();
    }

    @Transactional(readOnly = true)
    public List<Endpoint> findByTargetId(Long targetId) {
        return apiEndpointRepository.findByTargetId(targetId);
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
        if (!apiEndpointRepository.existsById(id)) {
            throw new ResponseStatusException(
                    HttpStatus.NOT_FOUND, "Endpoint introuvable, id=" + id);
        }
        apiEndpointRepository.deleteById(id);
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
}