package com.bct.back.services;

import com.bct.back.entities.Endpoint;
import com.bct.back.entities.TestCase;
import com.bct.back.repositories.EndpointRepository;
import com.bct.back.repositories.TestCaseRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional
public class TestCaseService {

    private final TestCaseRepository testCaseRepository;
    private final EndpointRepository apiEndpointRepository;

    @Transactional(readOnly = true)
    public List<TestCase> findAll() {
        return testCaseRepository.findAll();
    }

    @Transactional(readOnly = true)
    public List<TestCase> findByEndpointId(Long endpointId) {
        return testCaseRepository.findByEndpointId(endpointId);
    }

    @Transactional(readOnly = true)
    public TestCase findById(Long id) {
        return testCaseRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Cas de test introuvable, id=" + id));
    }

    public TestCase create(TestCase payload) {
        payload.setId(null);
        payload.setEndpoint(resolveEndpoint(payload.getEndpoint()));
        return testCaseRepository.save(payload);
    }

    public TestCase update(Long id, TestCase payload) {
        TestCase existing = findById(id);

        existing.setNom(payload.getNom());
        existing.setTypeStatus(payload.getTypeStatus());
        if (payload.getTeststatus() != null) {
            existing.setTeststatus(payload.getTeststatus());
        }
        existing.setSeuilMs(payload.getSeuilMs());
        existing.setTauxErreurMax(payload.getTauxErreurMax());
        existing.setTimeoutMs(payload.getTimeoutMs());
        if (payload.getEndpoint() != null && payload.getEndpoint().getId() != null) {
            existing.setEndpoint(resolveEndpoint(payload.getEndpoint()));
        }

        return testCaseRepository.save(existing);
    }

    public void delete(Long id) {
        if (!testCaseRepository.existsById(id)) {
            throw new ResponseStatusException(
                    HttpStatus.NOT_FOUND, "Cas de test introuvable, id=" + id);
        }
        testCaseRepository.deleteById(id);
    }

    private Endpoint resolveEndpoint(Endpoint endpointRef) {
        if (endpointRef == null || endpointRef.getId() == null) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST, "L'endpoint (endpoint.id) est obligatoire.");
        }
        return apiEndpointRepository.findById(endpointRef.getId())
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Endpoint introuvable, id=" + endpointRef.getId()));
    }
}