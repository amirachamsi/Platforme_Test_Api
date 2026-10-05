package com.bct.back.services;

import com.bct.back.DTO.TestCaseSnapshot;
import com.bct.back.entities.ApiTarget;
import com.bct.back.entities.Endpoint;
import com.bct.back.entities.TestCase;
import com.bct.back.enums.AuthType;
import com.bct.back.enums.ExecutionMode;
import com.bct.back.enums.HttpMethodType;
import com.bct.back.enums.KeyLocation;
import com.bct.back.repositories.ExecutionRepository;
import com.bct.back.repositories.TestCaseRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/**
 * Tests unitaires de la préparation d'une exécution (URL, authentification, valeurs par défaut).
 * La base de données et k6 sont remplacés par des mocks : aucun accès réel n'est effectué.
 */
class ExecutionServiceTest {

    private TestCaseRepository testCaseRepository;
    private ExecutionService service;

    @BeforeEach
    void setUp() {
        testCaseRepository = mock(TestCaseRepository.class);
        service = new ExecutionService(testCaseRepository, mock(ExecutionRepository.class),
                mock(K6Runner.class), mock(K6ResultParser.class));
    }

    private ApiTarget cible(AuthType auth) {
        return ApiTarget.builder().nom("API Clients").urlBase("https://api-recette.local")
                .authType(auth).keyIn(KeyLocation.HEADER).build();
    }

    private TestCase casDeTest(ApiTarget target) {
        Endpoint ep = Endpoint.builder().nom("Consulter client").methode(HttpMethodType.GET)
                .chemin("/clients/42").target(target).codeAttendu(200).build();
        TestCase tc = TestCase.builder().id(1L).nom("Charge consultation").endpoint(ep).build();
        when(testCaseRepository.findById(1L)).thenReturn(Optional.of(tc));
        return tc;
    }

    @Test
    @DisplayName("L'URL complète = URL de base + chemin de l'endpoint")
    void urlComplete() {
        casDeTest(cible(AuthType.NONE));

        TestCaseSnapshot s = service.buildSnapshot(1L);

        assertEquals("https://api-recette.local/clients/42", s.url());
        assertEquals("GET", s.method());
    }

    @Test
    @DisplayName("Authentification Bearer → en-tête Authorization")
    void authBearer_ajouteEnTeteAuthorization() {
        ApiTarget t = cible(AuthType.BEARER);
        t.setSecretRef("jeton-test");
        casDeTest(t);

        TestCaseSnapshot s = service.buildSnapshot(1L);

        assertTrue(s.headersJson().contains("\"Authorization\":\"Bearer jeton-test\""));
    }

    @Test
    @DisplayName("Clé d'API dans l'en-tête → en-tête personnalisé")
    void apiKeyHeader_ajouteEnTete() {
        ApiTarget t = cible(AuthType.API_KEY);
        t.setKeyName("X-API-KEY");
        t.setSecretRef("cle-test");
        casDeTest(t);

        TestCaseSnapshot s = service.buildSnapshot(1L);

        assertTrue(s.headersJson().contains("\"X-API-KEY\":\"cle-test\""));
        assertFalse(s.url().contains("cle-test"));
    }

    @Test
    @DisplayName("Clé d'API dans l'URL → paramètre de requête")
    void apiKeyQuery_ajouteParametreUrl() {
        ApiTarget t = cible(AuthType.API_KEY);
        t.setKeyIn(KeyLocation.QUERY);
        t.setKeyName("apikey");
        t.setSecretRef("cle-test");
        casDeTest(t);

        TestCaseSnapshot s = service.buildSnapshot(1L);

        assertEquals("https://api-recette.local/clients/42?apikey=cle-test", s.url());
    }

    @Test
    @DisplayName("Champs non renseignés → valeurs par défaut")
    void valeursParDefaut() {
        TestCase tc = casDeTest(cible(AuthType.NONE));
        tc.setVus(null);
        tc.setDureeSec(null);
        tc.setExecutionMode(null);

        TestCaseSnapshot s = service.buildSnapshot(1L);

        assertEquals(5000, s.timeoutMs());
        assertEquals(1000, s.thresholdMs());
        assertEquals(0.05, s.maxErrorRate(), 0.0001);
        assertEquals(1, s.vus());
        assertEquals(ExecutionMode.DUREE, s.executionMode());
        assertEquals(10, s.durationSeconds());
        assertNull(s.requestCount());
    }

    @Test
    @DisplayName("Mode « nombre de requêtes » → pas de durée")
    void modeRequetes() {
        TestCase tc = casDeTest(cible(AuthType.NONE));
        tc.setExecutionMode(ExecutionMode.REQUETES);
        tc.setNombreRequetes(500);

        TestCaseSnapshot s = service.buildSnapshot(1L);

        assertEquals(500, s.requestCount());
        assertNull(s.durationSeconds());
    }

    @Test
    @DisplayName("Code attendu « 2xx » non numérique → repli sur le code de l'endpoint")
    void codeAttenduNonNumerique_repliSurEndpoint() {
        TestCase tc = casDeTest(cible(AuthType.NONE));
        tc.setExpectedCode("2xx");
        tc.getEndpoint().setCodeAttendu(201);

        assertEquals(201, service.buildSnapshot(1L).expectedStatus());
    }

    @Test
    @DisplayName("Taux d'erreur saisi en pourcentage (10) → converti en ratio (0.10)")
    void tauxErreurConverti() {
        TestCase tc = casDeTest(cible(AuthType.NONE));
        tc.setTauxErreurMax(10.0);

        assertEquals(0.10, service.buildSnapshot(1L).maxErrorRate(), 0.0001);
    }

    @Test
    @DisplayName("Cas de test inexistant → erreur 404")
    void casDeTestInexistant_404() {
        when(testCaseRepository.findById(99L)).thenReturn(Optional.empty());

        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> service.buildSnapshot(99L));
        assertEquals(HttpStatus.NOT_FOUND, ex.getStatusCode());
    }
}