package com.bct.back.services;

import com.bct.back.entities.Execution;
import com.bct.back.entities.TestCase;
import com.bct.back.repositories.ExecutionRepository;
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
public class ExecutionService {

    private final ExecutionRepository executionRepository;
    private final TestCaseRepository testCaseRepository;

    @Transactional(readOnly = true)
    public List<Execution> findAll() {
        return executionRepository.findAll();
    }

    @Transactional(readOnly = true)
    public List<Execution> findByTestcaseId(Long testcaseId) {
        return executionRepository.findByTestcaseId(testcaseId);
    }

    @Transactional(readOnly = true)
    public Execution findById(Long id) {
        return executionRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Exécution introuvable, id=" + id));
    }

    // Créée typiquement par le job qui déclenche k6, avant que le rapport ne soit disponible.
    public Execution create(Execution payload) {
        payload.setId(null);
        if (payload.getTestcase() != null && payload.getTestcase().getId() != null) {
            payload.setTestcase(resolveTestCase(payload.getTestcase()));
        }
        return executionRepository.save(payload);
    }

    // Utilisée pour enregistrer le rapport k6 une fois le test terminé.
    public Execution update(Long id, Execution payload) {
        Execution existing = findById(id);

        existing.setCorrelationId(payload.getCorrelationId());
        existing.setDateDebut(payload.getDateDebut());
        existing.setDateFin(payload.getDateFin());
        existing.setStatut(payload.getStatut());
        existing.setP95MesureMs(payload.getP95MesureMs());
        existing.setTauxErreurMesure(payload.getTauxErreurMesure());
        existing.setReqTotal(payload.getReqTotal());
        existing.setRpsMoyen(payload.getRpsMoyen());
        existing.setRapportK6Json(payload.getRapportK6Json());
        if (payload.getTestcase() != null && payload.getTestcase().getId() != null) {
            existing.setTestcase(resolveTestCase(payload.getTestcase()));
        }

        return executionRepository.save(existing);
    }

    public void delete(Long id) {
        if (!executionRepository.existsById(id)) {
            throw new ResponseStatusException(
                    HttpStatus.NOT_FOUND, "Exécution introuvable, id=" + id);
        }
        executionRepository.deleteById(id);
    }

    private TestCase resolveTestCase(TestCase ref) {
        return testCaseRepository.findById(ref.getId())
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Cas de test introuvable, id=" + ref.getId()));
    }
}